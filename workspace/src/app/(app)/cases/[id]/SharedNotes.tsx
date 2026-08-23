"use client";

import { useState, useTransition } from "react";
import { updateCase } from "@/actions/cases";

/** Shared prep notes: owner-editable, visible to every coach (§3). */
export function SharedNotes({
  caseId,
  notes,
  canEdit,
  ownerName,
}: {
  caseId: string;
  notes: string;
  canEdit: boolean;
  ownerName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [pending, start] = useTransition();

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-ink">Shared prep notes</h2>
        {canEdit && !editing && (
          <button className="btn btn-quiet py-0.5" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            rows={8}
            className="field prose-notes leading-relaxed"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const form = new FormData();
                  form.set("notes", value);
                  await updateCase(caseId, form);
                  setSaved(value);
                  setEditing(false);
                })
              }
            >
              {pending ? "Saving…" : "Save notes"}
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => {
                setValue(saved);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : saved.trim() ? (
        <p className="prose-notes mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {saved}
        </p>
      ) : (
        <p className="mt-2 text-sm text-faint">
          {canEdit
            ? "No prep notes yet. Add what a coach needs to know before running this."
            : `No prep notes yet. ${ownerName} owns this case.`}
        </p>
      )}
    </section>
  );
}
