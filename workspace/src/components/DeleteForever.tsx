"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";

/**
 * Permanent deletion, everywhere it appears.
 *
 * Two levels of friction, chosen by what the delete would actually destroy. A
 * record nothing hangs off takes a plain confirm; one that would carry a
 * candidate's scores and written feedback with it makes you type its name, the
 * same bar the casebook delete has always used (§8.1).
 */
export function DeleteForever({
  name,
  /** What else disappears, e.g. "3 sessions and their reports". Empty = nothing. */
  carries,
  onDelete,
  label = "Delete",
}: {
  name: string;
  carries?: string;
  onDelete: (typedName: string) => Promise<{ error?: string } | void>;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const needsTyping = Boolean(carries);

  function run(value: string) {
    start(async () => {
      const result = await onDelete(value);
      if (result && "error" in result && result.error) return setError(result.error);
      setOpen(false);
      setTyped("");
      setError(null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        className="btn btn-quiet py-0.5 text-2xs hover:text-bad"
        onClick={() => {
          if (needsTyping) return setOpen(true);
          if (window.confirm(`Delete “${name}” permanently? This cannot be undone.`)) run("");
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 rounded border border-bad/40 bg-bad/5 p-2">
      <span className="text-2xs text-bad">
        Deleting “{name}” also deletes {carries}. Type the name to confirm.
      </span>
      <input
        autoFocus
        className="field w-44 py-0.5 text-2xs"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label={`Type ${name} to confirm deletion`}
      />
      <button
        className={clsx("btn py-0.5 text-2xs", typed.trim() === name && "text-bad")}
        disabled={pending || typed.trim() !== name}
        onClick={() => run(typed)}
      >
        {pending ? "Deleting…" : "Delete forever"}
      </button>
      <button
        className="btn btn-quiet py-0.5 text-2xs"
        onClick={() => {
          setOpen(false);
          setTyped("");
          setError(null);
        }}
      >
        Cancel
      </button>
      {error && <span className="w-full text-2xs text-bad">{error}</span>}
    </span>
  );
}
