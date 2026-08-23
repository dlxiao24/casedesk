"use client";

import type * as PdfJs from "pdfjs-dist";

type PdfJsModule = { GlobalWorkerOptions: { workerSrc: string } };

/**
 * pdf.js runs entirely in the browser (§4.1) — the worker is bundled with the
 * app rather than fetched from a CDN, so there is no third-party dependency at
 * runtime and nothing to pay for.
 */
export function configureWorker(pdfjs: PdfJsModule) {
  if (pdfjs.GlobalWorkerOptions.workerSrc) return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

export type ExtractedPages = {
  pageCount: number;
  /** Page number (1-based, as a string key) to its text layer. */
  pageText: Record<string, string>;
};

/**
 * Extracts per-page text once, at upload time. The result is persisted on the
 * Casebook so sectioning and search never re-parse the file (§4.1).
 */
export async function extractPdfText(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedPages> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as typeof PdfJs & PdfJsModule;
  configureWorker(pdfjs);

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = doc.numPages;
  const pageText: Record<string, string> = {};

  for (let n = 1; n <= pageCount; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Rebuild line breaks: pdf.js reports them as items with no string.
    const text = content.items
      .map((item) => {
        const anyItem = item as { str?: string; hasEOL?: boolean };
        if (anyItem.str === undefined) return "";
        return anyItem.hasEOL ? `${anyItem.str}\n` : `${anyItem.str} `;
      })
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    pageText[String(n)] = text;
    page.cleanup();
    onProgress?.(n, pageCount);
  }

  await doc.destroy();
  return { pageCount, pageText };
}
