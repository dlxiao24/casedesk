"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import type { SectionKind } from "@prisma/client";
import { saveSections } from "@/actions/casebooks";
import { PageGrid, type PageMark } from "@/components/PageGrid";
import { ZoomControl, useZoom } from "@/components/ZoomControl";
import { ATTACHING_KINDS, LEADING_KINDS, SECTION_KINDS, sectionKindMeta } from "@/lib/constants";

type Existing = {
  id?: string;
  kind: SectionKind;
  label: string;
  startPage: number | null;
  endPage: number | null;
  targetMins: number | null;
  pairedWithId?: string | null;
};

type Merged = { kind: SectionKind; startPage: number; endPage: number };

/** A stable handle for a merged section, so edits survive re-merging. */
function signature(s: { kind: SectionKind; startPage: number }) {
  return `${s.kind}:${s.startPage}`;
}

/**
 * Assigning section kinds to pages (§4.3).
 *
 * Click a page, press a number. Contiguous pages of the same kind merge into
 * one section automatically.
 *
 * Nesting is inferred rather than configured: an interviewee exhibit or an
 * interviewer solution marked after a prompt, math or brainstorm attaches to
 * it, because that is the order a casebook is laid out in. Dragging overrides
 * the guess when a casebook disagrees.
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
  const zoom = useZoom("sections");

  const [assigned, setAssigned] = useState<Record<number, SectionKind>>(() => {
    const out: Record<number, SectionKind> = {};
    for (const s of existing) {
      if (!s.startPage) continue;
      for (let p = s.startPage; p <= (s.endPage ?? s.startPage); p += 1) out[p] = s.kind;
    }
    return out;
  });

  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existing
        .filter((s) => s.startPage !== null)
        .map((s) => [signature({ kind: s.kind, startPage: s.startPage! }), s.label]),
    ),
  );

  /** Explicit overrides only. `null` means "the coach pulled this back out". */
  const [manualNest, setManualNest] = useState<Record<string, string | null>>(() => {
    const sigById: Record<string, string> = {};
    for (const e of existing) {
      if (e.id && e.startPage) sigById[e.id] = signature({ kind: e.kind, startPage: e.startPage });
    }
    const out: Record<string, string | null> = {};
    for (const e of existing) {
      if (!e.startPage || !e.pairedWithId) continue;
      const parent = sigById[e.pairedWithId];
      if (parent) out[signature({ kind: e.kind, startPage: e.startPage })] = parent;
    }
    return out;
  });

  /** Explicit top-level ordering, when the coach has dragged something. */
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  const [cursor, setCursor] = useState(startPage);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ sig: string; nest: boolean } | null>(null);

  function assign(page: number, kind: SectionKind | null) {
    setAssigned((a) => {
      const next = { ...a };
      if (kind === null) delete next[page];
      else next[page] = kind;
      return next;
    });
  }

  /** Contiguous pages of the same kind become one section, in page order. */
  const merged = useMemo(() => {
    const out: Merged[] = [];
    for (let p = startPage; p <= endPage; p += 1) {
      const kind = assigned[p];
      if (!kind) continue;
      const last = out[out.length - 1];
      if (last && last.kind === kind && last.endPage === p - 1) last.endPage = p;
      else out.push({ kind, startPage: p, endPage: p });
    }
    return out;
  }, [assigned, endPage, startPage]);

  /** Attaching kinds fall in behind the most recent leading section. */
  const autoNest = useMemo(() => {
    const out: Record<string, string> = {};
    let lead: string | null = null;
    for (const s of merged) {
      if (LEADING_KINDS.includes(s.kind)) lead = signature(s);
      else if (ATTACHING_KINDS.includes(s.kind) && lead) out[signature(s)] = lead;
    }
    return out;
  }, [merged]);

  function parentOf(sig: string): string | null {
    const manual = manualNest[sig];
    if (manual !== undefined) return manual;
    return autoNest[sig] ?? null;
  }

  /** The displayed tree: top-level sections, each with its attached children. */
  const tree = useMemo(() => {
    const bySig = new Map(merged.map((s) => [signature(s), s]));
    const tops = merged.filter((s) => {
      const parent = parentOf(signature(s));
      return !parent || !bySig.has(parent);
    });
    const ordered = manualOrder
      ? [
          ...manualOrder.map((sig) => tops.find((t) => signature(t) === sig)).filter(Boolean),
          ...tops.filter((t) => !manualOrder.includes(signature(t))),
        ]
      : tops;

    return (ordered as Merged[]).map((top) => ({
      section: top,
      children: merged.filter((c) => parentOf(signature(c)) === signature(top)),
    }));
    // parentOf reads manualNest and autoNest, both listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged, manualNest, autoNest, manualOrder]);

  const marks = useMemo(() => {
    const out: Record<number, PageMark> = {};
    const numberOf = new Map<string, string>();
    tree.forEach((node, i) => {
      numberOf.set(signature(node.section), String(i + 1));
      node.children.forEach((c, j) => numberOf.set(signature(c), `${i + 1}.${j + 1}`));
    });
    for (let p = startPage; p <= endPage; p += 1) {
      const kind = assigned[p];
      if (kind) {
        // Find which merged section owns this page, for its number.
        const owner = merged.find((s) => p >= s.startPage && p <= s.endPage);
        const num = owner ? numberOf.get(signature(owner)) : undefined;
        out[p] = {
          spine: sectionKindMeta(kind).spine,
          chip: `${num ? `${num} · ` : ""}${sectionKindMeta(kind).label}`,
        };
      } else if (suggestions[p]) {
        out[p] = { hint: sectionKindMeta(suggestions[p].kind as SectionKind).label };
      }
    }
    return out;
  }, [assigned, endPage, merged, startPage, suggestions, tree]);

  function acceptAllSuggestions() {
    const nextLabels: Record<string, string> = {};
    setAssigned((a) => {
      const next = { ...a };
      for (const [page, s] of Object.entries(suggestions)) {
        const p = Number(page);
        if (!next[p]) next[p] = s.kind as SectionKind;
        if (s.label) nextLabels[`${s.kind}:${p}`] = s.label;
      }
      return next;
    });
    setLabels((l) => ({ ...nextLabels, ...l }));
  }

  function labelFor(section: Merged) {
    return (
      labels[signature(section)] ??
      suggestions[section.startPage]?.label ??
      sectionKindMeta(section.kind).label
    );
  }

  // ---- Drag and drop ----

  function handleDrop(targetSig: string, nest: boolean) {
    const source = dragging;
    setDragging(null);
    setDropHint(null);
    if (!source || source === targetSig) return;

    if (nest) {
      // Never nest something that already has children under it.
      const hasChildren = tree.some(
        (n) => signature(n.section) === source && n.children.length > 0,
      );
      if (hasChildren) return;
      setManualNest((m) => ({ ...m, [source]: targetSig }));
      return;
    }

    // Reorder at the top level; pull the section out of any nesting first.
    setManualNest((m) => ({ ...m, [source]: null }));
    setManualOrder(() => {
      const tops = tree.map((n) => signature(n.section));
      const without = tops.filter((s) => s !== source);
      const at = without.indexOf(targetSig);
      const insertAt = at < 0 ? without.length : at;
      return [...without.slice(0, insertAt), source, ...without.slice(insertAt)];
    });
  }

  function save() {
    start(async () => {
      // Flatten the tree: each parent followed by its children, so `order` in
      // the database matches what the coach sees.
      const flat: { section: Merged; parentIndex: number | null }[] = [];
      for (const node of tree) {
        const parentIndex = flat.length;
        flat.push({ section: node.section, parentIndex: null });
        for (const child of node.children) flat.push({ section: child, parentIndex });
      }

      await saveSections(
        caseId,
        flat.map((f) => ({
          kind: f.section.kind,
          label: labelFor(f.section),
          startPage: f.section.startPage,
          endPage: f.section.endPage,
          pairedWithIndex: f.parentIndex,
        })),
      );
      const nested = flat.filter((f) => f.parentIndex !== null).length;
      setSaved(
        `Saved ${tree.length} step${tree.length === 1 ? "" : "s"}${nested ? `, ${nested} attached` : ""}.`,
      );
      router.refresh();
    });
  }

  const numberedKeys = SECTION_KINDS.filter((k) => k.hotkey);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <ZoomControl columns={zoom.columns} onChange={zoom.choose} />
          <span className="text-2xs text-faint">Pages across</span>
        </div>
        <PageGrid
          columns={zoom.columns}
          fileUrl={fileUrl}
          pageCount={pageCount}
          firstPage={startPage}
          marks={marks}
          cursor={cursor}
          selected={(p) => p === cursor}
          onPick={(page) => setCursor(page)}
          onKeyDown={(e) => {
            const hotkey = numberedKeys.find((k) => k.hotkey === e.key);
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
            } else if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault();
              assign(cursor, null);
            }
          }}
        />
      </div>

      <div className="space-y-4">
        <div className="rounded border border-rule bg-panel p-3">
          <h2 className="text-sm text-ink">Keys</h2>
          <p className="mt-0.5 text-2xs text-faint">
            Click the grid, then press a number. The cursor advances on its own.
          </p>
          <ul className="mt-2 space-y-1">
            {numberedKeys.map((k) => (
              <li key={k.value} className="flex items-center gap-2 text-sm">
                <kbd className="tabular rounded border border-rule px-1.5 text-2xs text-muted">
                  {k.hotkey}
                </kbd>
                <span className={clsx("h-3 w-1 rounded-sm", k.spine)} />
                <button
                  className="text-left text-muted hover:text-ink"
                  onClick={() => {
                    assign(cursor, k.value);
                    setCursor((c) => Math.min(endPage, c + 1));
                  }}
                >
                  {k.label}
                </button>
                {ATTACHING_KINDS.includes(k.value) && (
                  <span className="ml-auto text-2xs text-faint">attaches</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-2xs text-faint">
            Keys 6 and 7 attach to whichever step you marked last.
          </p>
          {Object.keys(suggestions).length > 0 && (
            <button className="btn mt-3 w-full justify-center" onClick={acceptAllSuggestions}>
              Accept {Object.keys(suggestions).length} suggestions
            </button>
          )}
        </div>

        <div className="rounded border border-rule bg-panel p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-ink">Steps</h2>
            <span className="text-2xs text-faint">{tree.length}</span>
          </div>
          <p className="mt-0.5 text-2xs text-faint">
            Drag to reorder. Drop onto the right edge of a step to attach beneath it.
          </p>

          {tree.length === 0 ? (
            <p className="mt-2 text-2xs text-faint">Nothing assigned yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {tree.map((node, i) => (
                <li key={signature(node.section)}>
                  <SectionRow
                    number={String(i + 1)}
                    section={node.section}
                    label={labelFor(node.section)}
                    onLabel={(v) =>
                      setLabels((l) => ({ ...l, [signature(node.section)]: v }))
                    }
                    dragging={dragging === signature(node.section)}
                    hint={
                      dropHint?.sig === signature(node.section) ? dropHint.nest : null
                    }
                    onDragStart={() => setDragging(signature(node.section))}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropHint(null);
                    }}
                    onDragOver={(nest) =>
                      setDropHint({ sig: signature(node.section), nest })
                    }
                    onDrop={(nest) => handleDrop(signature(node.section), nest)}
                  />
                  {node.children.length > 0 && (
                    <ul className="ml-4 mt-1 space-y-1 border-l border-rule pl-2">
                      {node.children.map((child, j) => (
                        <li key={signature(child)}>
                          <SectionRow
                            number={`${i + 1}.${j + 1}`}
                            section={child}
                            label={labelFor(child)}
                            onLabel={(v) =>
                              setLabels((l) => ({ ...l, [signature(child)]: v }))
                            }
                            dragging={dragging === signature(child)}
                            hint={dropHint?.sig === signature(child) ? dropHint.nest : null}
                            onDragStart={() => setDragging(signature(child))}
                            onDragEnd={() => {
                              setDragging(null);
                              setDropHint(null);
                            }}
                            onDragOver={(nest) => setDropHint({ sig: signature(child), nest })}
                            onDrop={(nest) => handleDrop(signature(child), nest)}
                            onDetach={() =>
                              setManualNest((m) => ({ ...m, [signature(child)]: null }))
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          {saved && <p className="mt-2 text-2xs text-good">{saved}</p>}
          <button
            className="btn btn-primary mt-3 w-full justify-center"
            disabled={pending || tree.length === 0}
            onClick={save}
          >
            {pending ? "Saving…" : "Save sections"}
          </button>
          <p className="mt-1 text-2xs text-faint">
            Replaces the case&apos;s current sections. Steps that keep the same first page keep
            their notes from past sessions.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionRow({
  number,
  section,
  label,
  onLabel,
  dragging,
  hint,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDetach,
}: {
  number: string;
  section: Merged;
  label: string;
  onLabel: (value: string) => void;
  dragging: boolean;
  /** true = will nest here, false = will reorder here, null = not a target. */
  hint: boolean | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (nest: boolean) => void;
  onDrop: (nest: boolean) => void;
  onDetach?: () => void;
}) {
  const meta = sectionKindMeta(section.kind);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag without payload.
        e.dataTransfer.setData("text/plain", number);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDragOver(e.clientX > rect.left + rect.width * 0.62);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDrop(e.clientX > rect.left + rect.width * 0.62);
      }}
      className={clsx(
        "flex items-center gap-1.5 rounded border px-1.5 py-1 transition-colors",
        dragging ? "opacity-40" : "",
        hint === true && "border-accent bg-accent/10",
        hint === false && "border-accent border-dashed",
        hint === null && "border-transparent",
      )}
    >
      <span className="cursor-grab select-none text-2xs text-faint" aria-hidden>
        ⠿
      </span>
      <span className="tabular w-8 shrink-0 text-2xs text-muted">{number}</span>
      <span className={clsx("h-5 w-1 shrink-0 rounded-sm", meta.spine)} />
      <input
        className="field py-0.5 text-2xs"
        value={label}
        aria-label={`Name for step ${number}`}
        onChange={(e) => onLabel(e.target.value)}
      />
      <span className="tabular shrink-0 text-2xs text-faint">
        {section.startPage}
        {section.endPage !== section.startPage ? `–${section.endPage}` : ""}
      </span>
      {onDetach && (
        <button
          className="shrink-0 text-2xs text-faint hover:text-ink"
          title="Pull out to its own step"
          onClick={onDetach}
        >
          ↰
        </button>
      )}
    </div>
  );
}
