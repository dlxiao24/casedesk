"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import clsx from "clsx";
import type { CaseFormat, CaseType, ReadinessState, TargetRound } from "@prisma/client";
import { ScoreBar } from "@/components/ScoreBar";
import { CASE_ATTRIBUTES, CASE_TYPES, READINESS } from "@/lib/constants";
import { ago } from "@/lib/format";
import { deleteCase } from "@/actions/cases";
import { DeleteForever } from "@/components/DeleteForever";

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

/** The useful information is in the rows, not in stat cards above them (§11). */
export function LibraryTable({ rows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="overflow-x-auto rounded border border-rule">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-2xs uppercase tracking-wider text-faint">
            <th className="w-6 py-2 pl-2 font-normal" />
            <th className="px-3 py-2 font-normal">Case</th>
            <th className="px-3 py-2 font-normal">Type</th>
            <th className="px-3 py-2 font-normal">Diff</th>
            <th className="px-3 py-2 font-normal">Quant</th>
            <th className="px-3 py-2 font-normal">Creat</th>
            <th className="px-3 py-2 font-normal">Quality</th>
            <th className="px-3 py-2 font-normal">Readiness</th>
            <th className="px-3 py-2 text-right font-normal">Delivered</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
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
                <td className="px-3 py-2 text-muted">
                  {CASE_TYPES.find((t) => t.value === row.caseType)?.label ?? row.caseType}
                </td>
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
                    <Link href={`/sessions/new?caseId=${row.id}`} className="btn btn-primary py-1">
                      Administer
                    </Link>
                  )}
                </td>
              </tr>
              {isOpen && <CaseDetailRow row={row} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
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
      <td colSpan={8} className="px-3 pb-4 pt-1">
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_14rem]">
          <div>
            <h3 className="label">Shared prep notes</h3>
            {row.notes?.trim() ? (
              <p className="prose-notes mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {row.notes}
              </p>
            ) : (
              <p className="mt-1 text-sm text-faint">
                None. {row.ownerName} owns this case.
              </p>
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
            <Link href={`/cases/${row.id}`} className="btn btn-quiet mt-2 w-full justify-center py-0.5">
              Open case
            </Link>
          </div>
        </div>
      </td>
    </tr>
  );
}
