"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createCaseFromRange } from "@/actions/casebooks";
import { PageGrid, type PageMark } from "@/components/PageGrid";
import { ZoomControl, useZoom } from "@/components/ZoomControl";

type ExistingCase = { id: string; title: string; startPage: number; endPage: number };

/**
 * Splitting a casebook into cases (§4.2).
 *
 * Speed is the whole point: click a start page, shift-click an end page, type a
 * name, Enter. The heuristic badge pre-fills the name when it can, and the
 * coach overrides it by typing. Nothing is ever auto-committed.
 */
export function SplitCasebook({
  casebookId,
  fileUrl,
  pageCount,
  suggestions,
  existing,
}: {
  casebookId: string;
  fileUrl: string | null;
  pageCount: number;
  suggestions: Record<number, string>;
  existing: ExistingCase[];
}) {
  const router = useRouter();
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [cursor, setCursor] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const zoom = useZoom("split");

  const claimed = useMemo(() => {
    const map: Record<number, ExistingCase> = {};
    for (const c of existing) {
      for (let p = c.startPage; p <= c.endPage; p += 1) map[p] = c;
    }
    return map;
  }, [existing]);

  const marks = useMemo(() => {
    const out: Record<number, PageMark> = {};
    for (let p = 1; p <= pageCount; p += 1) {
      const owner = claimed[p];
      if (owner) out[p] = { spine: "bg-accent/60", chip: owner.title };
      else if (suggestions[p]) out[p] = { hint: suggestions[p] };
    }
    return out;
  }, [claimed, pageCount, suggestions]);

  function pick(page: number, shift: boolean) {
    if (shift && start !== null) {
      setEnd(page);
    } else {
      setStart(page);
      setEnd(page);
      // Pre-fill from the heuristic, but only when the coach hasn't typed.
      if (!title.trim() && suggestions[page] && suggestions[page] !== "likely case start") {
        setTitle(suggestions[page]);
      }
    }
    setCursor(page);
  }

  const lo = start !== null && end !== null ? Math.min(start, end) : null;
  const hi = start !== null && end !== null ? Math.max(start, end) : null;

  function save() {
    if (lo === null || hi === null || !title.trim()) return;
    startTransition(async () => {
      const result = await createCaseFromRange({
        casebookId,
        title,
        startPage: lo,
        endPage: hi,
      });
      if ("error" in result && result.error) return setError(result.error);
      setTitle("");
      setStart(null);
      setEnd(null);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <ZoomControl columns={zoom.columns} onChange={zoom.choose} />
          <span className="text-2xs text-faint">Thumbnail size</span>
        </div>
      <PageGrid
        columns={zoom.columns}
        fileUrl={fileUrl}
        pageCount={pageCount}
        marks={marks}
        cursor={cursor}
        selected={(p) => lo !== null && hi !== null && p >= lo && p <= hi}
        onPick={pick}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setCursor((c) => Math.min(pageCount, c + 1));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setCursor((c) => Math.max(1, c - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(cursor, e.shiftKey);
          }
        }}
      />
      </div>

      <div className="space-y-4">
        <div className="space-y-2 rounded border border-rule bg-panel p-3">
          <h2 className="text-sm text-ink">New case</h2>
          <p className="text-2xs text-faint">
            Click the first page, shift-click the last. A badge means the text looked like a case
            start — confirm or ignore it.
          </p>
          <p className="tabular text-sm text-muted">
            {lo === null ? "No pages selected" : `Pages ${lo}–${hi}`}
          </p>
          <input
            className="field"
            placeholder="Case title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
          {error && <p className="text-sm text-bad">{error}</p>}
          <button
            className="btn btn-primary w-full justify-center"
            disabled={pending || lo === null || !title.trim()}
            onClick={save}
          >
            {pending ? "Saving…" : "Save case"}
          </button>
        </div>

        <div className="rounded border border-rule bg-panel p-3">
          <h2 className="text-sm text-ink">Cases in this casebook</h2>
          {existing.length === 0 ? (
            <p className="mt-1 text-2xs text-faint">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {existing.map((c) => (
                <li key={c.id} className="flex items-baseline gap-2 text-sm">
                  <Link href={`/cases/${c.id}`} className="text-ink hover:text-accent">
                    {c.title}
                  </Link>
                  <span className="tabular ml-auto text-2xs text-faint">
                    {c.startPage}–{c.endPage}
                  </span>
                  <Link href={`/cases/${c.id}/sections`} className="btn btn-quiet py-0 text-2xs">
                    Sections
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
