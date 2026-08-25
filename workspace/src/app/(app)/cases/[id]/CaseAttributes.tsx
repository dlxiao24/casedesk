"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rateCase } from "@/actions/cases";
import { Segmented } from "@/components/Segmented";
import { ScoreBar, formatScore } from "@/components/ScoreBar";
import { CASE_ATTRIBUTES } from "@/lib/constants";
import type { RatedKey, RatingValues } from "@/lib/caseRatings";

/**
 * The six attributes, then the verdict — which is about the case as a teaching
 * tool rather than about its content. `name` is the short form read aloud,
 * since "Would you give this again?: 4 of 5" is not a sentence.
 */
const ROWS: { key: RatedKey; label: string; name?: string; verdict?: boolean }[] = [
  ...CASE_ATTRIBUTES.map((a) => ({ key: a.key as RatedKey, label: a.label })),
  { key: "caseQuality", label: "Would you give this again?", name: "Give again", verdict: true },
];

/**
 * What the club thinks of a case, and what you think of it.
 *
 * Ratings used to belong to whoever added the case, which made these numbers
 * one person's taste — and left every other coach looking at a control that
 * would not work. Any coach rates now; the bars show the average, and your own
 * answer sits beside it so you can tell whether you are the outlier.
 */
export function CaseAttributes({
  caseId,
  averages,
  ratingCount,
  mine: initialMine,
}: {
  caseId: string;
  averages: Partial<Record<RatedKey, number | null>>;
  ratingCount: number;
  mine: RatingValues;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<RatingValues>(initialMine);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function update(key: RatedKey, value: number | null) {
    setMine((v) => ({ ...v, [key]: value }));
    start(async () => {
      await rateCase(caseId, { [key]: value });
      // The averages are computed on the server; pull them back rather than
      // trying to recompute the mean in the browser from data it does not have.
      router.refresh();
    });
  }

  const iRated = ROWS.some((r) => typeof mine[r.key] === "number");

  return (
    <section className="rounded border border-rule bg-panel p-3">
      <h2 className="text-sm text-ink">Case attributes</h2>
      <p className="mt-0.5 text-2xs text-faint">
        {ratingCount === 0
          ? "Nobody has rated this case yet."
          : `Averaged over ${ratingCount} coach${ratingCount === 1 ? "" : "es"}.`}
        {pending && " Saving…"}
      </p>

      <dl className="mt-3 space-y-2">
        {ROWS.map(({ key, label, name, verdict }) => {
          const average = averages[key] ?? null;
          const yours = mine[key];

          return (
            <div
              key={key}
              className={verdict ? "border-t border-rule pt-2" : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="flex items-center gap-2">
                  {editing ? (
                    <Segmented
                      name={label}
                      value={yours ?? null}
                      onChange={(v) => update(key, v)}
                    />
                  ) : (
                    <>
                      <ScoreBar
                        value={average}
                        name={name ?? label}
                        ratingCount={ratingCount}
                        tone={verdict ? "good" : "default"}
                      />
                      <span className="tabular w-6 text-right text-2xs text-faint">
                        {formatScore(average) ?? "—"}
                      </span>
                    </>
                  )}
                </dd>
              </div>
              {/* Only worth saying when it differs from the average, or when
                  the control that would have shown it is hidden. */}
              {typeof yours === "number" && (
                <p className="mt-0.5 text-right text-2xs text-faint">
                  {editing ? "your rating" : `you gave ${yours}`}
                </p>
              )}
            </div>
          );
        })}
      </dl>

      <button
        className="btn btn-quiet mt-3 w-full justify-center py-0.5"
        onClick={() => {
          setEditing((e) => !e);
          if (editing) router.refresh();
        }}
      >
        {editing ? "Done" : iRated ? "Change your rating" : "Rate case"}
      </button>
    </section>
  );
}
