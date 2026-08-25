"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import type { CaseFormat, CaseType, ReadinessState, TargetRound } from "@prisma/client";
import { ScoreBar } from "@/components/ScoreBar";
import { CASE_ATTRIBUTES, CASE_TYPES, READINESS } from "@/lib/constants";
import { ago } from "@/lib/format";
import { deleteCase } from "@/actions/cases";
import { DeleteForever } from "@/components/DeleteForever";
import { placeholderRow } from "@/lib/guest";

export type Row = {
  id: string;
  title: string;
  caseType: CaseType;
  industry: string | null;
  firm: string | null;
  format: CaseFormat;
  targetRound: TargetRound | null;
  source: string;
  overallDifficulty: number | null;
  quantIntensity: number | null;
  creativityLoad: number | null;
  caseQuality: number | null;
  structureDifficulty: number | null;
  ambiguity: number | null;
  dataDensity: number | null;
  notes: string | null;
  readiness: ReadinessState;
  personalNotes: string | null;
  deliveredCount: number;
  sectionCount: number;
  lastDeliveredAt: string | null;
  ownerName: string;
  archived: boolean;
};

type SortKey =
  | "title"
  | "caseType"
  | "overallDifficulty"
  | "quantIntensity"
  | "creativityLoad"
  | "caseQuality"
  | "readiness"
  | "deliveredCount";

type Sort = { key: SortKey; dir: "asc" | "desc" };

/**
 * Names go A-Z on the first click; everything scored goes highest first,
 * because "which is the hardest?" is the question a rating column gets asked.
 */
const TEXT_COLUMNS = new Set<SortKey>(["title", "caseType"]);

function defaultDirection(key: SortKey): Sort["dir"] {
  return TEXT_COLUMNS.has(key) ? "asc" : "desc";
}

/** How an active sort reads in prose: A-Z for names, high/low for numbers. */
function directionLabel(sort: Sort) {
  if (TEXT_COLUMNS.has(sort.key)) return sort.dir === "asc" ? "A to Z" : "Z to A";
  return sort.dir === "asc" ? "lowest first" : "highest first";
}

const SORT_LABELS: Record<SortKey, string> = {
  title: "case",
  caseType: "type",
  overallDifficulty: "difficulty",
  quantIntensity: "quant intensity",
  creativityLoad: "creativity load",
  caseQuality: "quality",
  readiness: "readiness",
  deliveredCount: "times delivered",
};

function typeLabel(value: CaseType) {
  return CASE_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** The one value a column sorts on. `null` means unrated, not zero. */
function cellValue(row: Row, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return row.title;
    case "caseType":
      return typeLabel(row.caseType);
    case "readiness":
      // READINESS is listed in order of progress, so its index is the rank.
      return READINESS.findIndex((r) => r.value === row.readiness);
    case "deliveredCount":
      return row.deliveredCount;
    default:
      return row[key];
  }
}

/** The useful information is in the rows, not in stat cards above them (§11). */
export function LibraryTable({
  rows,
  isAdmin,
  /** Rows the viewer may not have: drawn as blurred fiction, counted honestly. */
  lockedCount = 0,
  isGuest = false,
}: {
  rows: Row[];
  isAdmin: boolean;
  lockedCount?: number;
  isGuest?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<Sort | null>(null);

  /**
   * Sorting happens here rather than by reloading the page: every row is
   * already on the client, and the filters own the URL.
   */
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((x, y) => {
        const a = cellValue(x.row, sort.key);
        const b = cellValue(y.row, sort.key);
        // An unrated case has no value rather than the lowest one, so it sinks
        // to the bottom whichever way the arrow points.
        if (a === null || b === null) {
          if (a === b) return x.index - y.index;
          return a === null ? 1 : -1;
        }
        const gap = typeof a === "string" ? a.localeCompare(b as string) : a - (b as number);
        // Ties keep the order the server sent, which is the default sort.
        return gap !== 0 ? gap * dir : x.index - y.index;
      })
      .map((r) => r.row);
  }, [rows, sort]);

  /** A click sorts one way, then the other, then returns to the default order. */
  function cycle(key: SortKey) {
    setSort((current) => {
      const first = defaultDirection(key);
      if (current?.key !== key) return { key, dir: first };
      if (current.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
      return null;
    });
  }

  const head = { sort, onSort: cycle };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-2xs text-faint">
        {sort ? (
          <>
            <span>
              Sorted by {SORT_LABELS[sort.key]}, {directionLabel(sort)}.
            </span>
            <button onClick={() => setSort(null)} className="text-accent hover:underline">
              Default order
            </button>
          </>
        ) : isGuest ? (
          <span>
            {rows.length} of {rows.length + lockedCount} cases, in alphabetical order.
          </span>
        ) : (
          <span>Sorted by what you have run least recently.</span>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-rule">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-2xs uppercase tracking-wider text-faint">
              <th className="w-6 py-2 pl-2 font-normal" />
              <SortHeader label="Case" sortKey="title" {...head} />
              <SortHeader label="Type" sortKey="caseType" {...head} />
              <SortHeader label="Diff" sortKey="overallDifficulty" {...head} />
              <SortHeader label="Quant" sortKey="quantIntensity" {...head} />
              <SortHeader label="Creat" sortKey="creativityLoad" {...head} />
              <SortHeader label="Quality" sortKey="caseQuality" {...head} />
              <SortHeader label="Readiness" sortKey="readiness" {...head} />
              <SortHeader label="Delivered" sortKey="deliveredCount" align="right" {...head} />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const lowQuality = row.caseQuality !== null && row.caseQuality <= 2;
              const isOpen = Boolean(open[row.id]);
              return (
                <Fragment key={row.id}>
                  <tr
                    className={clsx(
                      "border-b border-rule/60 hover:bg-panel",
                      isOpen && "bg-panel",
                      lowQuality && "opacity-55",
                    )}
                  >
                    <td className="py-2 pl-2 align-top">
                      <button
                        onClick={() => setOpen((o) => ({ ...o, [row.id]: !o[row.id] }))}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${row.title}` : `Expand ${row.title}`}
                        className="tabular w-4 text-faint hover:text-ink"
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/cases/${row.id}`} className="text-ink hover:text-accent">
                          {row.title}
                        </Link>
                        {row.personalNotes?.trim() && (
                          <span
                            title={row.personalNotes}
                            aria-label={`Your note: ${row.personalNotes}`}
                            className="cursor-help text-accent"
                          >
                            ●
                          </span>
                        )}
                        {lowQuality && (
                          <span className="chip border-rule text-faint">low quality</span>
                        )}
                      </div>
                      <div className="text-2xs text-faint">
                        {row.source}
                        {row.industry ? ` · ${row.industry}` : ""}
                        {row.firm ? ` · ${row.firm}` : ""}
                        {row.sectionCount > 0 ? ` · ${row.sectionCount} sections` : " · unsectioned"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted">{typeLabel(row.caseType)}</td>
                    <td className="px-3 py-2">
                      <ScoreBar value={row.overallDifficulty} />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBar value={row.quantIntensity} size="xs" />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBar value={row.creativityLoad} size="xs" />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBar
                        value={row.caseQuality}
                        tone={lowQuality ? "warn" : "good"}
                        label={row.caseQuality ? `Quality ${row.caseQuality} of 5` : "Not yet rated"}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <ReadinessChip state={row.readiness} />
                      {row.lastDeliveredAt && (
                        <div className="text-2xs text-faint">{ago(row.lastDeliveredAt)}</div>
                      )}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted">{row.deliveredCount}</td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin && row.archived ? (
                        <DeleteForever
                          name={row.title}
                          carries={
                            row.deliveredCount > 0
                              ? `${row.deliveredCount} session${row.deliveredCount === 1 ? "" : "s"} and their reports`
                              : undefined
                          }
                          onDelete={(typed) => deleteCase(row.id, typed)}
                        />
                      ) : (
                        <Link
                          href={`/sessions/new?caseId=${row.id}`}
                          className="btn btn-primary py-1"
                        >
                          Administer
                        </Link>
                      )}
                    </td>
                  </tr>
                  {isOpen && <CaseDetailRow row={row} />}
                </Fragment>
              );
            })}
            {Array.from({ length: lockedCount }, (_, i) => (
              <LockedRow key={i} index={i} />
            ))}
          </tbody>
        </table>
      </div>

      {lockedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-rule bg-panel px-3 py-2">
          <span className="text-sm text-muted">
            {lockedCount} more {lockedCount === 1 ? "case is" : "cases are"} in the library.
          </span>
          <Link href="/signup" className="btn btn-primary py-0.5">
            Create a free account
          </Link>
          <Link href="/login" className="text-2xs text-faint hover:text-accent">
            or sign in
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * A case the viewer may not have.
 *
 * The text is invented. A blur is paint, not a lock — whatever is under it
 * still travels to the browser and sits in the page source — so the row is
 * given fiction to wear rather than a real title. Hidden from assistive
 * technology for the same reason it is hidden from the eye: there is nothing
 * here to read.
 */
function LockedRow({ index }: { index: number }) {
  const fake = placeholderRow(index);

  return (
    <tr aria-hidden className="border-b border-rule/60 select-none">
      <td className="py-2 pl-2" />
      <td className="px-3 py-2">
        <div className="blur-[3px]">
          <div className="text-ink">{fake.title}</div>
          <div className="text-2xs text-faint">{fake.source}</div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="text-muted blur-[3px]">{fake.caseType}</div>
      </td>
      <td className="px-3 py-2">
        <div className="blur-[3px]">
          <ScoreBar value={fake.overallDifficulty} />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="blur-[3px]">
          <ScoreBar value={fake.quantIntensity} size="xs" />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="blur-[3px]">
          <ScoreBar value={fake.creativityLoad} size="xs" />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="blur-[3px]">
          <ScoreBar value={fake.caseQuality} size="xs" tone="good" />
        </div>
      </td>
      <td className="px-3 py-2">
        <span className="chip border-rule text-faint blur-[3px]">Unread</span>
      </td>
      <td className="tabular px-3 py-2 text-right text-muted blur-[3px]">0</td>
      <td className="px-3 py-2 text-right">
        <span className="text-2xs text-faint">Locked</span>
      </td>
    </tr>
  );
}

/**
 * A column header that sorts. The arrow always occupies its place in the
 * layout and is merely invisible until it means something, so no header
 * shifts sideways under the pointer.
 */
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort | null;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const dir = sort?.key === sortKey ? sort.dir : null;

  return (
    <th
      className={clsx("px-3 py-2 font-normal", align === "right" && "text-right")}
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
    >
      <button
        onClick={() => onSort(sortKey)}
        title={
          dir
            ? `Sorted by ${SORT_LABELS[sortKey]} — click to ${
                dir === defaultDirection(sortKey)
                  ? "reverse it"
                  : "go back to the default order"
              }`
            : `Sort by ${SORT_LABELS[sortKey]}`
        }
        className={clsx(
          "group inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink",
          dir && "text-ink",
        )}
      >
        {label}
        <span
          aria-hidden
          className={clsx(
            "text-[0.85em] leading-none",
            dir ? "text-accent" : "text-transparent group-hover:text-faint",
          )}
        >
          {/* An idle column shows the arrow it would sort by, in invisible ink. */}
          {(dir ?? defaultDirection(sortKey)) === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

export function ReadinessChip({ state }: { state: ReadinessState }) {
  const label = READINESS.find((r) => r.value === state)?.label ?? state;
  return (
    <span
      className={clsx(
        "chip",
        state === "DELIVERED" && "border-good/40 text-good",
        state === "PRACTICED" && "border-accent/40 text-accent",
        state === "READ" && "border-rule text-muted",
        state === "UNREAD" && "border-rule text-faint",
      )}
    >
      {label}
    </span>
  );
}

/**
 * The expanded view of a row: everything a coach needs to decide whether to
 * pick this case, without leaving the library. Read-only on purpose — editing
 * lives on the case page, and a table row is the wrong place to lose work.
 */
function CaseDetailRow({ row }: { row: Row }) {
  const attributes = CASE_ATTRIBUTES.map((a) => ({
    label: a.label,
    value: row[a.key as keyof Row] as number | null,
  }));

  return (
    <tr className="border-b border-rule/60 bg-panel/60">
      <td />
      <td colSpan={9} className="px-3 pb-4 pt-1">
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_14rem]">
          <div>
            <h3 className="label">Shared prep notes</h3>
            {row.notes?.trim() ? (
              <p className="prose-notes mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {row.notes}
              </p>
            ) : (
              <p className="mt-1 text-sm text-faint">None. {row.ownerName} owns this case.</p>
            )}
          </div>

          <div>
            <h3 className="label">My notes</h3>
            {row.personalNotes?.trim() ? (
              <p className="prose-notes mt-1 whitespace-pre-wrap text-sm leading-relaxed text-accent/90">
                {row.personalNotes}
              </p>
            ) : (
              <p className="mt-1 text-sm text-faint">
                Nothing yet. Private to you, wherever you add it.
              </p>
            )}
          </div>

          <div>
            <h3 className="label">Ratings</h3>
            <dl className="mt-1 space-y-1">
              {attributes.map((a) => (
                <div key={a.label} className="flex items-center justify-between gap-2">
                  <dt className="text-2xs text-muted">{a.label}</dt>
                  <dd>
                    <ScoreBar value={a.value} size="xs" label={a.label} />
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t border-rule pt-1">
                <dt className="text-2xs text-muted">Give again?</dt>
                <dd>
                  <ScoreBar value={row.caseQuality} size="xs" tone="good" label="Case quality" />
                </dd>
              </div>
            </dl>
            <Link
              href={`/cases/${row.id}`}
              className="btn btn-quiet mt-2 w-full justify-center py-0.5"
            >
              Open case
            </Link>
          </div>
        </div>
      </td>
    </tr>
  );
}
