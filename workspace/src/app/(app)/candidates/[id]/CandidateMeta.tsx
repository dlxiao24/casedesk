"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCandidateArchived, updateCandidate } from "@/actions/candidates";

/** Edit and soft-delete. Nothing is ever hard-deleted from the UI (§8.1). */
export function CandidateMeta({
  id,
  archived,
  name,
  email,
  cohort,
  year,
  notes,
}: {
  id: string;
  archived: boolean;
  name: string;
  email: string;
  cohort: string;
  year: string;
  notes: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="flex gap-2">
        <button className="btn" onClick={() => setOpen(true)}>
          Edit
        </button>
        <button
          className="btn btn-quiet"
          onClick={() =>
            start(async () => {
              await setCandidateArchived(id, !archived);
              router.refresh();
            })
          }
        >
          {archived ? "Restore" : "Archive"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="w-80 space-y-2 rounded border border-rule bg-panel p-3"
      action={(form) =>
        start(async () => {
          const result = await updateCandidate(id, form);
          if (result?.error) return setError(result.error);
          setOpen(false);
          setError(null);
          router.refresh();
        })
      }
    >
      <input name="name" defaultValue={name} className="field" placeholder="Name" required />
      <input name="email" defaultValue={email} className="field" placeholder="Email (optional)" />
      <input name="cohort" defaultValue={cohort} className="field" placeholder="Cohort" />
      <input name="year" defaultValue={year} className="field" placeholder="Year" />
      <textarea name="notes" defaultValue={notes} rows={3} className="field" placeholder="Notes" />
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
