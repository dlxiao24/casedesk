"use client";

import { useState, useTransition } from "react";
import { deleteCasebook } from "@/actions/casebooks";

/**
 * The one hard delete in the product (§8.1). Admin only, typed confirmation,
 * and the copy says plainly what it takes with it.
 */
export function DeleteCasebook({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button className="btn btn-quiet py-0.5" onClick={() => setOpen(true)}>
        Delete
      </button>
    );
  }

  return (
    <span className="flex w-full items-center gap-2 rounded border border-bad/40 bg-bad/5 p-2">
      <span className="text-2xs text-bad">
        Deletes every case and session from this casebook. Type “{title}” to confirm.
      </span>
      <input
        autoFocus
        className="field w-48"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      <button
        className="btn"
        disabled={pending || typed !== title}
        onClick={() =>
          start(async () => {
            const result = await deleteCasebook(id, typed);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button className="btn btn-quiet" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="text-2xs text-bad">{error}</span>}
    </span>
  );
}
