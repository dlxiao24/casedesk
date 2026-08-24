"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCase } from "@/actions/cases";
import { CASE_FORMATS, CASE_TYPES, TARGET_ROUNDS } from "@/lib/constants";
import { FirmField } from "@/components/FirmField";

export function NewCaseForm({
  casebooks,
}: {
  casebooks: { id: string; title: string; pageCount: number }[];
}) {
  const [state, action] = useActionState(createCase, null);

  return (
    <form action={action} className="space-y-4 rounded border border-rule bg-panel p-4">
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" required autoFocus className="field mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="caseType">
            Case type
          </label>
          <select id="caseType" name="caseType" className="field mt-1" defaultValue="PROFITABILITY">
            {CASE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="format">
            Format
          </label>
          <select id="format" name="format" className="field mt-1" defaultValue="INTERVIEWER_LED">
            {CASE_FORMATS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="industry">
            Industry
          </label>
          <input id="industry" name="industry" className="field mt-1" placeholder="Optional" />
        </div>
        <FirmField />
        <div>
          <label className="label" htmlFor="targetRound">
            Target round
          </label>
          <select id="targetRound" name="targetRound" className="field mt-1" defaultValue="">
            <option value="">Any</option>
            {TARGET_ROUNDS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {casebooks.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <div>
            <label className="label" htmlFor="casebookId">
              Source casebook
            </label>
            <select id="casebookId" name="casebookId" className="field mt-1" defaultValue="">
              <option value="">None — typed case</option>
              {casebooks.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.pageCount}pp)
                </option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="label" htmlFor="startPage">
              First page
            </label>
            <input
              id="startPage"
              name="startPage"
              type="number"
              min={1}
              className="field tabular mt-1"
            />
          </div>
          <div className="w-20">
            <label className="label" htmlFor="endPage">
              Last page
            </label>
            <input
              id="endPage"
              name="endPage"
              type="number"
              min={1}
              className="field tabular mt-1"
            />
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="notes">
          Shared prep notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="field prose-notes mt-1"
          placeholder="Visible to every coach. Markdown is fine."
        />
      </div>

      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save case"}
    </button>
  );
}
