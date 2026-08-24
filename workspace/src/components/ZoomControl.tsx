"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ZOOM_LEVELS } from "@/components/PageGrid";

/**
 * Thumbnail size for the page grids, stored as a column count. Casebook slides
 * are dense — a grid that finds a case boundary is useless for reading an
 * exhibit, so the coach picks. Remembered per browser under `key`.
 */
export function useZoom(key: string, fallback = 4) {
  const [columns, setColumns] = useState(fallback);

  useEffect(() => {
    const stored = window.localStorage.getItem(`casedesk.zoom.${key}`);
    const n = Number(stored);
    // Older builds stored a pixel width here; ignore anything out of range.
    if (n >= 1 && n <= 8) setColumns(n);
  }, [key]);

  function choose(next: number) {
    setColumns(next);
    window.localStorage.setItem(`casedesk.zoom.${key}`, String(next));
  }

  return { columns, choose };
}

export function ZoomControl({
  columns,
  onChange,
}: {
  columns: number;
  onChange: (columns: number) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded border border-rule"
      role="group"
      aria-label="Thumbnail size"
    >
      {ZOOM_LEVELS.map((z) => (
        <button
          key={z.label}
          type="button"
          title={z.title}
          aria-pressed={columns === z.columns}
          onClick={() => onChange(z.columns)}
          className={clsx(
            "tabular border-r border-rule px-2 py-1 text-2xs last:border-r-0",
            columns === z.columns ? "bg-accent/20 text-ink" : "text-faint hover:text-ink",
          )}
        >
          {z.label}
        </button>
      ))}
    </div>
  );
}
