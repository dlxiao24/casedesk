"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  CASE_ATTRIBUTES,
  CASE_FORMATS,
  CASE_TYPES,
  READINESS,
  TARGET_ROUNDS,
} from "@/lib/constants";

export function LibraryFilterBar({
  casebooks,
  industries,
}: {
  casebooks: { id: string; title: string }[];
  industries: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [showAttrs, setShowAttrs] = useState(() =>
    CASE_ATTRIBUTES.some(({ key }) => params.get(`${key}Min`) || params.get(`${key}Max`)),
  );

  const set = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  const active = Array.from(params.keys()).filter((k) => params.get(k)).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field w-56"
          type="search"
          placeholder="Search titles, notes, page text…"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => set({ q: value || null }), 300);
          }}
        />

        <Select
          value={params.get("caseType") ?? ""}
          onChange={(v) => set({ caseType: v })}
          placeholder="Any type"
          options={CASE_TYPES}
        />
        <Select
          value={params.get("industry") ?? ""}
          onChange={(v) => set({ industry: v })}
          placeholder="Any industry"
          options={industries.map((i) => ({ value: i, label: i }))}
        />
        <Select
          value={params.get("format") ?? ""}
          onChange={(v) => set({ format: v })}
          placeholder="Any format"
          options={CASE_FORMATS}
        />
        <Select
          value={params.get("targetRound") ?? ""}
          onChange={(v) => set({ targetRound: v })}
          placeholder="Any round"
          options={TARGET_ROUNDS}
        />
        <Select
          value={params.get("casebookId") ?? ""}
          onChange={(v) => set({ casebookId: v })}
          placeholder="Any casebook"
          options={casebooks.map((c) => ({ value: c.id, label: c.title }))}
        />
        <Select
          value={params.get("readiness") ?? ""}
          onChange={(v) => set({ readiness: v })}
          placeholder="Any readiness"
          options={READINESS}
        />
        <Select
          value={params.get("quality") ?? ""}
          onChange={(v) => set({ quality: v })}
          placeholder="Any quality"
          options={[
            { value: "4", label: "Quality 4+" },
            { value: "3", label: "Quality 3+" },
            { value: "unrated", label: "Unrated" },
          ]}
        />

        <button
          type="button"
          className={clsx("btn", showAttrs && "border-faint")}
          onClick={() => setShowAttrs((s) => !s)}
        >
          Attributes
        </button>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={params.get("archived") === "1"}
            onChange={(e) => set({ archived: e.target.checked ? "1" : null })}
          />
          Archived
        </label>

        {active > 0 && (
          <button type="button" className="btn btn-quiet" onClick={() => set(clearAll(params))}>
            Clear
          </button>
        )}
        <span
          className={clsx("text-2xs text-faint transition-opacity", pending ? "opacity-100" : "opacity-0")}
        >
          filtering…
        </span>
      </div>

      {showAttrs && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded border border-rule bg-panel p-3 md:grid-cols-3">
          {CASE_ATTRIBUTES.map(({ key, label }) => (
            <RangeRow
              key={key}
              label={label}
              min={params.get(`${key}Min`)}
              max={params.get(`${key}Max`)}
              onChange={(lo, hi) => set({ [`${key}Min`]: lo, [`${key}Max`]: hi })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

let searchTimer = 0;

function clearAll(params: URLSearchParams) {
  const cleared: Record<string, null> = {};
  params.forEach((_, key) => {
    cleared[key] = null;
  });
  return cleared;
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      className={clsx("field w-auto py-1.5 text-sm", value ? "text-ink" : "text-faint")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="text-ink">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A 1-5 range, expressed as two bounds rather than a two-thumb slider. */
function RangeRow({
  label,
  min,
  max,
  onChange,
}: {
  label: string;
  min: string | null;
  max: string | null;
  onChange: (lo: string | null, hi: string | null) => void;
}) {
  const lo = min ? Number(min) : 1;
  const hi = max ? Number(max) : 5;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const inRange = n >= lo && n <= hi;
          const bounded = min !== null || max !== null;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label} ${n}`}
              aria-pressed={bounded && inRange}
              onClick={() => {
                // Click once to pin a value, again outside it to span a range,
                // again on the pinned value to clear.
                if (!bounded) return onChange(String(n), String(n));
                if (lo === n && hi === n) return onChange(null, null);
                if (n < lo) return onChange(String(n), String(hi));
                if (n > hi) return onChange(String(lo), String(n));
                return onChange(String(n), String(n));
              }}
              className={clsx(
                "tabular h-6 w-6 rounded border text-2xs",
                bounded && inRange
                  ? "border-accent/60 bg-accent/20 text-ink"
                  : "border-rule text-faint hover:text-ink",
              )}
            >
              {n}
            </button>
          );
        })}
      </span>
    </div>
  );
}
