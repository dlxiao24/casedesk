"use client";

import clsx from "clsx";

/** A 1-5 segmented control. Keyboard-operable: arrow keys move, digits jump. */
export function Segmented({
  value,
  onChange,
  disabled,
  name,
  max = 5,
  allowClear = true,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  name: string;
  max?: number;
  allowClear?: boolean;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded border border-rule"
      role="radiogroup"
      aria-label={name}
      onKeyDown={(e) => {
        if (disabled) return;
        if (/^[1-9]$/.test(e.key) && Number(e.key) <= max) {
          e.preventDefault();
          onChange(Number(e.key));
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(max, (value ?? 0) + 1));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = (value ?? max + 1) - 1;
          onChange(next < 1 ? (allowClear ? null : 1) : next);
        }
      }}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          disabled={disabled}
          tabIndex={value === n || (value === null && n === 1) ? 0 : -1}
          onClick={() => onChange(allowClear && value === n ? null : n)}
          className={clsx(
            "tabular w-7 border-r border-rule py-1 text-xs last:border-r-0",
            value !== null && n <= value
              ? "bg-accent/20 text-ink"
              : "text-faint hover:text-ink",
            disabled && "cursor-not-allowed opacity-60 hover:text-faint",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
