"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Document, Page, pdfjs } from "react-pdf";
import { configureWorker } from "@/lib/pdf";
import { sectionKindMeta } from "@/lib/constants";
import type { ViewSection } from "./CaseView";

configureWorker(pdfjs);

/**
 * The measured width sets render resolution only; the canvases are scaled to
 * fit with CSS. That is deliberate — if layout changes re-rendered pages, a
 * scrollbar appearing would restart the whole cycle.
 *
 * One <Document> for the whole case rather than one per section — pdf.js opens
 * the file once and every page draws from the same handle, which is the
 * difference between a case page that loads and one that spawns twenty parsers.
 */
export function CaseSlides({
  fileUrl,
  sections,
}: {
  fileUrl: string | null;
  sections: ViewSection[];
}) {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  /**
   * Callback ref, not a mount effect: this lives inside <Document>, which shows
   * a placeholder until the file is open, so the node arrives late.
   *
   * The width only ever ratchets upward, and only in steps larger than a
   * scrollbar. Tracking it exactly created a loop: rendering pages makes the
   * document taller, which brings in the window scrollbar, which narrows this
   * container, which re-renders every canvas and changes the height again. The
   * page flickered open and shut until the tab stopped responding.
   */
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    const read = () =>
      setWidth((prev) => {
        const next = el.clientWidth;
        return next > prev + 32 ? next : prev;
      });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    observer.current = ro;
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  let step = 0;
  let sub = 0;

  const body = (
    <div ref={measure} className="space-y-4 rounded border border-rule bg-panel p-3">
      {sections.map((s) => {
        if (s.nested) sub += 1;
        else {
          step += 1;
          sub = 0;
        }
        const number = s.nested ? `${step}.${sub}` : String(step);
        const meta = sectionKindMeta(s.kind);
        const pages = s.startPage
          ? Array.from(
              { length: (s.endPage ?? s.startPage) - s.startPage + 1 },
              (_, i) => s.startPage! + i,
            )
          : [];

        return (
          <div key={s.id} className={clsx(s.nested && "ml-5 border-l border-rule pl-3")}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="tabular text-2xs text-faint">{number}</span>
              <span className={clsx("h-4 w-1 rounded-sm", meta.spine)} />
              <span className="text-sm text-ink">{s.label}</span>
              <span className={clsx("chip", meta.chip)}>{meta.label}</span>
              {pages.length > 0 && (
                <span className="tabular ml-auto text-2xs text-faint">
                  {pages.length === 1 ? `p. ${pages[0]}` : `pp. ${pages[0]}–${pages[pages.length - 1]}`}
                </span>
              )}
            </div>

            {s.bodyText ? (
              <pre className="prose-notes whitespace-pre-wrap rounded border border-rule bg-paper p-3 text-sm leading-relaxed text-muted">
                {s.bodyText}
              </pre>
            ) : fileUrl && pages.length > 0 && width > 0 ? (
              <div className="space-y-2 [&_canvas]:!h-auto [&_canvas]:!w-full">
                {pages.map((p) => (
                  <Page
                    key={p}
                    pageNumber={p}
                    width={width - 24}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading=""
                    className="overflow-hidden rounded border border-rule"
                  />
                ))}
              </div>
            ) : (
              <p className="text-2xs text-faint">
                {pages.length > 0
                  ? "The casebook file is not available in this environment."
                  : "No pages or text for this section."}
              </p>
            )}
          </div>
        );
      })}
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
