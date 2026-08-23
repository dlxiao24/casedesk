"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { sectionKindMeta } from "@/lib/constants";
import type { RunnerSection } from "./Runner";

/** Jump-to-section palette (⌘K). Quiet, keyboard-only, dismissable with Escape. */
export function SectionPalette({
  sections,
  activeIndex,
  onPick,
  onClose,
}: {
  sections: RunnerSection[];
  activeIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(activeIndex);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .map((s, i) => ({ section: s, index: i }))
      .filter(
        ({ section }) =>
          !q ||
          section.label.toLowerCase().includes(q) ||
          sectionKindMeta(section.kind).label.toLowerCase().includes(q),
      );
  }, [query, sections]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/40 pt-24"
      onClick={onClose}
    >
      <div
        className="w-[28rem] overflow-hidden rounded border border-rule bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full border-b border-rule bg-transparent px-3 py-2 text-sm text-ink focus:outline-none"
          placeholder="Jump to section…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(matches.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = matches[highlight];
              if (pick) onPick(pick.index);
            }
          }}
        />
        <ul className="max-h-72 overflow-auto">
          {matches.map(({ section, index }, i) => (
            <li key={section.id}>
              <button
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                  i === highlight ? "bg-accent/15" : "",
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => onPick(index)}
              >
                <span className="tabular w-6 text-2xs text-faint">{index + 1}</span>
                <span className={clsx("h-4 w-1 rounded-sm", sectionKindMeta(section.kind).spine)} />
                <span className={index === activeIndex ? "text-ink" : "text-muted"}>
                  {section.label}
                </span>
                <span className="ml-auto text-2xs text-faint">
                  {sectionKindMeta(section.kind).label}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-3 text-sm text-faint">No section matches that.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
