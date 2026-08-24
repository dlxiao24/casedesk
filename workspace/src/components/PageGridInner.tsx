"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Document, Page, pdfjs } from "react-pdf";
import { configureWorker } from "@/lib/pdf";

configureWorker(pdfjs);

/**
 * Zoom is expressed as "how many pages fit across", not a pixel width. The grid
 * then divides the real container width between them, so a thumbnail always
 * fills its cell exactly and no zoom level leaves dead space at the sides.
 */
import type { PageMark } from "./PageGrid";

const GAP = 8;
const PADDING = 8;
/** Slides are landscape; casebook pages are portrait. Split the difference. */
const DEFAULT_ASPECT = 1.3;

/**
 * A virtualized thumbnail grid of casebook pages (§4.2, §4.3).
 *
 * Only the rows near the viewport are mounted — a 200-page casebook would
 * otherwise ask pdf.js to render 200 canvases at once and lock the tab.
 */
export function PageGridInner({
  fileUrl,
  pageCount,
  firstPage = 1,
  marks,
  selected,
  cursor,
  onPick,
  onKeyDown,
  columns = 4,
}: {
  fileUrl: string | null;
  pageCount: number;
  firstPage?: number;
  marks: Record<number, PageMark>;
  selected: (page: number) => boolean;
  cursor?: number | null;
  onPick: (page: number, shift: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  columns?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  /** Measured from the first page pdf.js renders, so rows are the right height. */
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => firstPage + i),
    [firstPage, pageCount],
  );

  // Measured before paint: measuring in a normal effect leaves the first frame
  // laid out at a guessed width, which is why the grid used to look wrong until
  // the zoom was touched.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth - PADDING * 2);
      setHeight(el.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cellWidth = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;
  // Caption bar plus border.
  const rowHeight = Math.round(cellWidth * aspect) + 22 + GAP;
  const rows = Math.ceil(pages.length / columns);
  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
  const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + height) / rowHeight) + 1);

  // Keep the keyboard cursor on screen.
  useEffect(() => {
    if (!cursor || !scrollRef.current || rowHeight <= 0) return;
    const row = Math.floor((cursor - firstPage) / columns);
    const top = row * rowHeight;
    const el = scrollRef.current;
    if (top < el.scrollTop) el.scrollTo({ top });
    else if (top + rowHeight > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: top + rowHeight - el.clientHeight });
    }
  }, [columns, cursor, firstPage, rowHeight]);

  const visible =
    cellWidth > 0 ? pages.slice(firstRow * columns, (lastRow + 1) * columns) : [];

  const body = (
    <div
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ padding: PADDING }}
      className="h-[74vh] overflow-y-auto overflow-x-hidden rounded border border-rule bg-panel focus:outline-none focus-visible:border-accent"
    >
      <div style={{ height: rows * rowHeight, position: "relative" }}>
        <div
          className="absolute inset-x-0 grid"
          style={{
            top: firstRow * rowHeight,
            gap: GAP,
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
                  "relative flex flex-col items-stretch overflow-hidden rounded border text-left transition-colors",
                  selected(page) ? "border-accent" : "border-rule hover:border-faint",
                  cursor === page && "ring-1 ring-accent",
                )}
              >
                <span className="relative flex items-center justify-center overflow-hidden bg-white">
                  {fileUrl ? (
                    <Page
                      pageNumber={page}
                      width={cellWidth - 2}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading=""
                      onLoadSuccess={(p) => {
                        // Lock rows to the real page shape once we know it.
                        const next = p.height / p.width;
                        setAspect((a) => (Math.abs(a - next) > 0.02 ? next : a));
                      }}
                    />
                  ) : (
                    <span
                      className="tabular flex items-center justify-center text-2xs text-neutral-400"
                      style={{ width: cellWidth - 2, height: (cellWidth - 2) * aspect }}
                    >
                      p. {page}
                    </span>
                  )}
                  {mark?.spine && (
                    <span className={clsx("absolute left-0 top-0 h-full w-1", mark.spine)} />
                  )}
                </span>
                <span className="flex items-center gap-1 px-1.5 py-1">
                  <span className="tabular text-2xs text-faint">{page}</span>
                  {mark?.chip && <span className="truncate text-2xs text-muted">{mark.chip}</span>}
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
