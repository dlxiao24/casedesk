"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import type { SectionKind } from "@prisma/client";
import { saveSections } from "@/actions/casebooks";
import { PageGrid, type PageMark } from "@/components/PageGrid";
import { SECTION_KINDS, sectionKindMeta } from "@/lib/constants";

type Existing = {
  kind: SectionKind;
  label: string;
  startPage: number | null;
  endPage: number | null;
  targetMins: number | null;
};

/**
 * Assigning section kinds to pages (§4.3).
 *
 * Click a page, press a number. Contiguous pages of the same kind merge into
 * one section automatically, so the coach never has to think about section
 * boundaries — only about what each page *is*.
 */
export function AssignSections({
  caseId,
  fileUrl,
  startPage,
  endPage,
  suggestions,
  existing,
}: {
  caseId: string;
  fileUrl: string | null;
  startPage: number;
  endPage: number;
  suggestions: Record<number, { kind: string; label: string | null }>;
  existing: Existing[];
}) {
  const router = useRouter();
  const pageCount = endPage - startPage + 1;

  // Seed from whatever is already saved, so re-sectioning is a nudge, not a redo.
  const [assigned, setAssigned] = useState<Record<number, SectionKind>>(() => {
    const out: Record<number, SectionKind> = {};
    for (const s of existing) {
      if (!s.startPage) continue;
      for (let p = s.startPage; p <= (s.endPage ?? s.startPage); p += 1) out[p] = s.kind;
    }
    return out;
  });
  // Labels already written by hand outrank anything the heuristics propose.
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existing
        .filter((s) => s.startPage !== null)
        .map((s) => [`${s.kind}:${s.startPage}`, s.label]),
    ),
  );
  const [cursor, setCursor] = useState(startPage);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function assign(page: number, kind: SectionKind | null) {
    setAssigned((a) => {
      const next = { ...a };
      if (kind === null) delete next[page];
      else next[page] = kind;
      return next;
    });
  }

  /** Contiguous pages of the same kind become one section. */
  const merged = useMemo(() => {
    const out: { kind: SectionKind; startPage: number; endPage: number }[] = [];
    for (let p = startPage; p <= endPage; p += 1) {
      const kind = assigned[p];
      if (!kind) continue;
      const last = out[out.length - 1];
      if (last && last.kind === kind && last.endPage === p - 1) last.endPage = p;
      else out.push({ kind, startPage: p, endPage: p });
    }
    return out;
  }, [assigned, endPage, startPage]);

  const marks = useMemo(() => {
    const out: Record<number, PageMark> = {};
    for (let p = startPage; p <= endPage; p += 1) {
      const kind = assigned[p];
      if (kind) out[p] = { spine: sectionKindMeta(kind).spine, chip: sectionKindMeta(kind).label };
      else if (suggestions[p]) {
        out[p] = { hint: sectionKindMeta(suggestions[p].kind as SectionKind).label };
      }
    }
    return out;
  }, [assigned, endPage, startPage, suggestions]);

  function acceptAllSuggestions() {
    setAssigned((a) => {
      const next = { ...a };
      const nextLabels: Record<string, string> = {};
      for (const [page, s] of Object.entries(suggestions)) {
        const p = Number(page);
        if (!next[p]) next[p] = s.kind as SectionKind;
        if (s.label) nextLabels[`${s.kind}:${p}`] = s.label;
      }
      setLabels((l) => ({ ...nextLabels, ...l }));
      return next;
    });
  }

  function labelFor(section: { kind: SectionKind; startPage: number }) {
    return (
      labels[`${section.kind}:${section.startPage}`] ??
      suggestions[section.startPage]?.label ??
      sectionKindMeta(section.kind).label
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <PageGrid
        fileUrl={fileUrl}
        pageCount={pageCount}
        firstPage={startPage}
        marks={marks}
        cursor={cursor}
        selected={(p) => p === cursor}
        onPick={(page) => setCursor(page)}
        onKeyDown={(e) => {
          const hotkey = SECTION_KINDS.find((k) => k.hotkey === e.key);
          if (hotkey) {
            e.preventDefault();
            assign(cursor, hotkey.value);
            setCursor((c) => Math.min(endPage, c + 1));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setCursor((c) => Math.min(endPage, c + 1));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setCursor((c) => Math.max(startPage, c - 1));
          } else if (e.key === "Backspace" || e.key === "0") {
            e.preventDefault();
            assign(cursor, null);
          }
        }}
      />

      <div className="space-y-4">
        <div className="rounded border border-rule bg-panel p-3">
          <h2 className="text-sm text-ink">Keys</h2>
          <p className="mt-0.5 text-2xs text-faint">
            Click the grid first, then press a number. The cursor advances on its own.
          </p>
          <ul className="mt-2 space-y-1">
            {SECTION_KINDS.filter((k) => k.hotkey).map((k) => (
              <li key={k.value} className="flex items-center gap-2 text-sm">
                <kbd className="tabular rounded border border-rule px-1.5 text-2xs text-muted">
                  {k.hotkey}
                </kbd>
                <span className={clsx("h-3 w-1 rounded-sm", k.spine)} />
                <button
                  className="text-muted hover:text-ink"
                  onClick={() => {
                    assign(cursor, k.value);
                    setCursor((c) => Math.min(endPage, c + 1));
                  }}
                >
                  {k.label}
                </button>
                {k.hidden && <span className="ml-auto text-2xs text-faint">hidden in runner</span>}
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm">
              <kbd className="tabular rounded border border-rule px-1.5 text-2xs text-muted">0</kbd>
              <span className="text-muted">Clear this page</span>
            </li>
          </ul>
          {Object.keys(suggestions).length > 0 && (
            <button className="btn mt-3 w-full justify-center" onClick={acceptAllSuggestions}>
              Accept {Object.keys(suggestions).length} suggestions
            </button>
          )}
        </div>

        <div className="rounded border border-rule bg-panel p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-ink">Sections</h2>
            <span className="text-2xs text-faint">{merged.length}</span>
          </div>
          {merged.length === 0 ? (
            <p className="mt-1 text-2xs text-faint">Nothing assigned yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {merged.map((s) => (
                <li key={`${s.kind}-${s.startPage}`} className="flex items-center gap-1.5">
                  <span className={clsx("h-5 w-1 rounded-sm", sectionKindMeta(s.kind).spine)} />
                  <input
                    className="field py-0.5 text-2xs"
                    value={labelFor(s)}
                    onChange={(e) =>
                      setLabels((l) => ({ ...l, [`${s.kind}:${s.startPage}`]: e.target.value }))
                    }
                  />
                  <span className="tabular shrink-0 text-2xs text-faint">
                    {s.startPage}
                    {s.endPage !== s.startPage ? `–${s.endPage}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {saved && <p className="mt-2 text-2xs text-good">{saved}</p>}
          <button
            className="btn btn-primary mt-3 w-full justify-center"
            disabled={pending || merged.length === 0}
            onClick={() =>
              start(async () => {
                await saveSections(
                  caseId,
                  merged.map((s) => ({
                    kind: s.kind,
                    label: labelFor(s),
                    startPage: s.startPage,
                    endPage: s.endPage,
                  })),
                );
                setSaved(`Saved ${merged.length} sections.`);
                router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Save sections"}
          </button>
          <p className="mt-1 text-2xs text-faint">
            Replaces the case&apos;s current sections. Sections that keep the same first page keep
            their notes from past sessions; ones you drop take their notes with them.
          </p>
        </div>
      </div>
    </div>
  );
}
