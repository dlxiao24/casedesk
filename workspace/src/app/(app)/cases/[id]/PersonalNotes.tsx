"use client";

import { useState } from "react";
import { savePersonalNotes } from "@/actions/cases";
import { SaveIndicator, useAutosave } from "@/lib/useAutosave";

/**
 * My notes (§5). Always editable, autosaved, no save button and no modal — it
 * should be as cheap to jot a note as it is to think of one. Visually distinct
 * from the shared notes because it is private and permanent (§14).
 */
export function PersonalNotes({ caseId, initial }: { caseId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const { state, schedule } = useAutosave<string>((v) => savePersonalNotes(caseId, v));

  return (
    <section className="rounded border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-ink">My notes</h2>
        <SaveIndicator state={state} />
      </div>
      <p className="mt-0.5 text-2xs text-faint">
        Private to you. Never shown to other coaches, never in a report.
      </p>
      <textarea
        value={value}
        rows={8}
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target.value);
        }}
        placeholder={"Exhibit 2 confuses everyone.\nCasebook math is wrong — answer is 4.2M, not 4.8M.\nGreat for finance kids, brutal for first-years."}
        className="prose-notes mt-2 w-full resize-y bg-transparent text-sm leading-relaxed text-ink placeholder:text-faint/70 focus:outline-none"
      />
    </section>
  );
}
