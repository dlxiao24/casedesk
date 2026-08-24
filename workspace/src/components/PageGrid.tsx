"use client";

import dynamic from "next/dynamic";

/**
 * Zoom is expressed as "how many pages fit across", not a pixel width. The grid
 * divides the real container width between them, so a thumbnail always fills
 * its cell exactly and no zoom level leaves dead space at the sides.
 */
export const ZOOM_LEVELS = [
  { label: "S", columns: 6, title: "Six across" },
  { label: "M", columns: 4, title: "Four across" },
  { label: "L", columns: 3, title: "Three across" },
  { label: "XL", columns: 2, title: "Two across — readable slides" },
] as const;

export type PageMark = {
  /** Tailwind background class for the colored spine. */
  spine?: string;
  /** Short chip text, e.g. the section kind. */
  chip?: string;
  /** Subtle badge for a heuristic suggestion the coach has not confirmed. */
  hint?: string;
};

export type PageGridProps = {
  fileUrl: string | null;
  pageCount: number;
  firstPage?: number;
  marks: Record<number, PageMark>;
  selected: (page: number) => boolean;
  cursor?: number | null;
  onPick: (page: number, shift: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  columns?: number;
};

/**
 * Client-only wrapper. pdf.js reaches for DOMMatrix the moment it is imported,
 * which crashes server rendering — so the grid itself is never part of the
 * server bundle. This file deliberately imports nothing from react-pdf.
 */
const Inner = dynamic(() => import("./PageGridInner").then((m) => m.PageGridInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[74vh] items-center justify-center rounded border border-rule bg-panel text-sm text-faint">
      Loading pages…
    </div>
  ),
});

export function PageGrid(props: PageGridProps) {
  return <Inner {...props} />;
}
