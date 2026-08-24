"use client";

import Link from "next/link";
import clsx from "clsx";
import type { CaseFormat, CaseType, ReadinessState, TargetRound } from "@prisma/client";
import { ScoreBar } from "@/components/ScoreBar";
import { CASE_TYPES, READINESS } from "@/lib/constants";
import { ago } from "@/lib/format";

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
  readiness: ReadinessState;
  personalNotes: string | null;
  deliveredCount: number;
  sectionCount: number;
  lastDeliveredAt: string | null;
  ownerName: string;
};

/** The useful information is in the rows, not in stat cards above them (§11). */
export function LibraryTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded border border-rule">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-2xs uppercase tracking-wider text-faint">
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
            return (
              <tr
                key={row.id}
                className={clsx(
                  "border-b border-rule/60 last:border-b-0 hover:bg-panel",
                  lowQuality && "opacity-55",
                )}
              >
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
                  <Link href={`/sessions/new?caseId=${row.id}`} className="btn btn-primary py-1">
                    Administer case
                  </Link>
                </td>
              </tr>
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
