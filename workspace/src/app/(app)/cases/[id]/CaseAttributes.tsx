"use client";

import { useState, useTransition } from "react";
import { setCaseAttribute } from "@/actions/cases";
import { Segmented } from "@/components/Segmented";
import { ScoreBar } from "@/components/ScoreBar";
import { CASE_ATTRIBUTES } from "@/lib/constants";

type Values = Record<string, number | null>;

/**
 * Case ratings are single-owner (§14). A non-owner sees them read-only and is
 * pointed at their own notes instead of at an edit control that would not work.
 */
export function CaseAttributes({
  caseId,
  isOwner,
  ownerName,
  values,
}: {
  caseId: string;
  isOwner: boolean;
  ownerName: string;
  values: Values;
}) {
  const [local, setLocal] = useState<Values>(values);
  const [, start] = useTransition();

  function update(key: string, value: number | null) {
    setLocal((v) => ({ ...v, [key]: value }));
    start(async () => {
      await setCaseAttribute(caseId, key, value);
    });
  }

  return (
    <section className="rounded border border-rule bg-panel p-3">
      <h2 className="text-sm text-ink">Case attributes</h2>
      <p className="mt-0.5 text-2xs text-faint">
        {isOwner
          ? "Yours to set — you added this case."
          : `Set by ${ownerName}. Disagree in your own notes.`}
      </p>

      <dl className="mt-3 space-y-2">
        {CASE_ATTRIBUTES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <dt className="text-sm text-muted">{label}</dt>
            <dd>
              {isOwner ? (
                <Segmented
                  name={label}
                  value={local[key] ?? null}
                  onChange={(v) => update(key, v)}
                />
              ) : (
                <ScoreBar value={local[key]} />
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 border-t border-rule pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted" title="1 = don't give this again, 5 = go-to case.">
            Would you give this again?
          </span>
          {isOwner ? (
            <Segmented
              name="Case quality"
              value={local.caseQuality ?? null}
              onChange={(v) => update("caseQuality", v)}
            />
          ) : (
            <ScoreBar value={local.caseQuality} tone="good" />
          )}
        </div>
        <p className="mt-1 text-2xs text-faint">
          A verdict on the case as a teaching tool, not on its content. Never shown to candidates.
        </p>
      </div>
    </section>
  );
}
