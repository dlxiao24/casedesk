"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { configureWorker } from "@/lib/pdf";

configureWorker(pdfjs);

/**
 * The current section's pages, scrollable (§6.1). Width tracks the pane so the
 * coach can resize without losing the exhibit.
 */
export function PdfPane({
  fileUrl,
  pages,
  /** "dark" fills the runner's own pane; "light" is for the shared exhibit view. */
  tone = "dark",
}: {
  fileUrl: string;
  pages: number[];
  tone?: "dark" | "light";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, entry.contentRect.width - 24));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Jump back to the top when the section changes.
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pages[0]]);

  return (
    <div
      ref={ref}
      className={
        tone === "light"
          ? "overflow-x-auto bg-white p-2"
          : "h-full overflow-auto bg-[#1a1d22] px-3 py-1.5"
      }
    >
      {error ? (
        <p className="p-4 text-sm text-warn">{error}</p>
      ) : (
        <Document
          file={fileUrl}
          loading={<p className="p-4 text-sm text-faint">Loading pages…</p>}
          onLoadError={(e) => setError(`Could not open the casebook: ${e.message}`)}
          externalLinkTarget="_blank"
        >
          {pages.map((p) => (
            <div key={p} className="mb-2 last:mb-0">
              <Page
                pageNumber={p}
                width={width}
                renderAnnotationLayer={false}
                className="mx-auto"
              />
              {tone === "dark" && (
                <div className="tabular pt-1 text-center text-2xs text-faint">p. {p}</div>
              )}
            </div>
          ))}
        </Document>
      )}
    </div>
  );
}
