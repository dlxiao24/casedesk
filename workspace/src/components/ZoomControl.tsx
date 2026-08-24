"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ZOOM_LEVELS } from "@/components/PageGrid";

/**
 * Thumbnail size for the page grids. Casebook slides are dense — the default
 * grid is fine for finding a case boundary and useless for reading an exhibit,
 * so the coach picks. Remembered per browser under `key`.
 */
export function useZoom(key: string, fallback = 190) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const stored = window.localStorage.getItem(`casedesk.zoom.${key}`);
    if (stored) setWidth(Number(stored));
  }, [key]);

  function choose(next: number) {
    setWidth(next);
    window.localStorage.setItem(`casedesk.zoom.${key}`, String(next));
  }

  return { width, choose };
}

export function ZoomControl({
  width,
  onChange,
}: {
  width: number;
  onChange: (width: number) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-rule" role="group" aria-label="Thumbnail size">
      {ZOOM_LEVELS.map((z) => (
        <button
          key={z.label}
          type="button"
          title={z.title}
          aria-pressed={width === z.width}
          onClick={() => onChange(z.width)}
          className={clsx(
            "tabular border-r border-rule px-2 py-1 text-2xs last:border-r-0",
            width === z.width ? "bg-accent/20 text-ink" : "text-faint hover:text-ink",
          )}
        >
          {z.label}
        </button>
      ))}
    </div>
  );
}
