"use client";

import { useState } from "react";
import { buildSlidesPdf, slidesFileName } from "@/lib/slidesPdf";
import type { ViewSection } from "./CaseView";

/**
 * Saves the case's slides as one PDF — the same pages the slides view shows,
 * in the same order, so a coach can read the case on a plane or print it.
 *
 * Deliberately not a link to the casebook file: that is the whole book, often
 * a couple of hundred pages, and this case is a dozen of them.
 */
export function DownloadSlides({
  title,
  fileUrl,
  sections,
}: {
  title: string;
  fileUrl: string | null;
  sections: ViewSection[];
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setWorking(true);
    setError(null);
    try {
      const blob = await buildSlidesPdf({ fileUrl, sections });
      // Revoked on the next tick rather than immediately: Safari cancels a
      // download whose blob URL disappears in the same frame as the click.
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = slidesFileName(title);
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The slides could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <button className="btn btn-quiet py-0.5" onClick={save} disabled={working}>
        {working ? "Preparing…" : "Download PDF"}
      </button>
      {error && <span className="text-2xs text-warn">{error}</span>}
    </>
  );
}
