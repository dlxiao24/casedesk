"use client";

import { useState } from "react";
import type { ReportModel } from "@/lib/report";

/**
 * Saves the report as a typeset PDF.
 *
 * Downloading one is sharing it — the same rule the print button has always
 * applied (§8.1) — so the caller locks the session before the file is built.
 */
export function DownloadReport({
  model,
  onDownloaded,
}: {
  model: ReportModel;
  onDownloaded: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setWorking(true);
    setError(null);
    try {
      const { buildReportPdf, reportFileName } = await import("@/lib/reportPdf");
      const blob = await buildReportPdf(model);
      // Revoked on a later tick: Safari cancels a download whose blob URL
      // disappears in the same frame as the click.
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = reportFileName(model);
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      onDownloaded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF could not be built.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <button
        className="rounded border border-neutral-400 bg-neutral-900 px-2 py-1 text-white hover:bg-neutral-700 disabled:opacity-60"
        onClick={save}
        disabled={working}
      >
        {working ? "Preparing…" : "Download PDF"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </>
  );
}
