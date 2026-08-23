"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import type { ReadinessState } from "@prisma/client";
import { setReadiness } from "@/actions/cases";
import { READINESS } from "@/lib/constants";

/** Auto-advances, but a coach can always override (§5). */
export function ReadinessPicker({
  caseId,
  state,
}: {
  caseId: string;
  state: ReadinessState;
}) {
  const [value, setValue] = useState(state);
  const [pending, start] = useTransition();

  return (
    <div
      className={clsx("inline-flex overflow-hidden rounded border border-rule", pending && "opacity-70")}
      role="radiogroup"
      aria-label="My readiness"
    >
      {READINESS.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          className={clsx(
            "border-r border-rule px-2 py-1 text-2xs last:border-r-0",
            value === r.value ? "bg-accent/20 text-ink" : "text-faint hover:text-ink",
          )}
          onClick={() => {
            setValue(r.value);
            start(async () => {
              await setReadiness(caseId, r.value);
            });
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
