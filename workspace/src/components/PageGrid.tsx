"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Document, Page, pdfjs } from "react-pdf";
import { configureWorker } from "@/lib/pdf";

configureWorker(pdfjs);

export const ZOOM_LEVELS = [
  { label: "S", width: 120, title: "Small — most pages at once" },
  { label: "M", width: 190, title: "Medium" },
  { label: "L", width: 300, title: "Large — readable slides" },
  { label: "XL", width: 460, title: "Extra large — one or two per row" },
] as const;

export type PageMark = {
  /** Tailwind background class for the colored spine. */
  spine?: string;
  /** Short chip text, e.g. the section kind. */
  chip?: string;
  /** Subtle badge for a heuristic suggestion the coach has not confirmed. */
  hint?: string;
};

/**
 * A virtualized thumbnail grid of casebook pages (§4.2, §4.3).
 *
 * Only the rows near the viewport are mounted — a 200-page casebook would
 * otherwise ask pdf.js to render 200 canvases at once and lock the tab.
 */
export function PageGrid({
  fileUrl,
  pageCount,
  firstPage = 1,
  marks,
  selected,
  cursor,
  onPick,
  onKeyDown,
  thumbWidth = 190,
}: {
  fileUrl: string | null;
  pageCount: number;
  firstPage?: number;
  marks: Record<number, PageMark>;
  selected: (page: number) => boolean;
  cursor?: number | null;
  onPick: (page: number, shift: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  thumbWidth?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => firstPage + i),
    [firstPage, pageCount],
  );

  const rowHeight = thumbWidth * 1.45;
  const rows = Math.ceil(pages.length / columns);
  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + viewport) / rowHeight) + 2);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setColumns(Math.max(1, Math.floor(entry.contentRect.width / (thumbWidth + 12))));
      setViewport(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [thumbWidth]);

  // Keep the keyboard cursor on screen.
  useEffect(() => {
    if (!cursor || !scrollRef.current) return;
    const row = Math.floor((cursor - firstPage) / columns);
    const top = row * rowHeight;
    const el = scrollRef.current;
    if (top < el.scrollTop) el.scrollTo({ top });
    else if (top + rowHeight > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: top + rowHeight - el.clientHeight });
    }
  }, [columns, cursor, firstPage, rowHeight]);

  const visible = pages.slice(firstRow * columns, (lastRow + 1) * columns);

  const body = (
    <div
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="h-[70vh] overflow-auto rounded border border-rule bg-panel p-3 focus:outline-none focus-visible:border-accent"
    >
      <div style={{ height: rows * rowHeight, position: "relative" }}>
        <div
          className="absolute inset-x-0 grid gap-3"
          style={{
            top: firstRow * rowHeight,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {visible.map((page) => {
            const mark = marks[page];
            return (
              <button
                key={page}
                type="button"
                aria-pressed={selected(page)}
                onClick={(e) => onPick(page, e.shiftKey)}
                className={clsx(
                  "group relative flex flex-col items-stretch rounded border text-left transition-colors",
                  selected(page)
                    ? "border-accent bg-accent/10"
                    : "border-rule hover:border-faint",
                  cursor === page && "ring-1 ring-accent",
                )}
                style={{ height: rowHeight - 12 }}
              >
                {mark?.spine && (
                  <span
                    className={clsx("absolute left-0 top-0 h-full w-1 rounded-l", mark.spine)}
                  />
                )}
                <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white/90">
                  {fileUrl ? (
                    <Page
                      pageNumber={page}
                      width={thumbWidth - 10}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading=""
                    />
                  ) : (
                    <span className="tabular text-2xs text-neutral-400">p. {page}</span>
                  )}
                </span>
                <span className="flex items-center gap-1 px-1.5 py-1">
                  <span className="tabular text-2xs text-faint">{page}</span>
                  {mark?.chip && (
                    <span className="truncate text-2xs text-muted">{mark.chip}</span>
                  )}
                  {mark?.hint && !mark.chip && (
                    <span
                      className="ml-auto truncate text-2xs text-warn/80"
                      title="Suggested — confirm or override"
                    >
                      {mark.hint}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!fileUrl) return body;

  return (
    <Document
      file={fileUrl}
      loading={<p className="p-4 text-sm text-faint">Opening casebook…</p>}
      error={<p className="p-4 text-sm text-warn">Could not open the casebook file.</p>}
    >
      {body}
    </Document>
  );
}
