"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCase, setArchived } from "@/actions/cases";

/**
 * Per-case controls inside a casebook. Archiving is the everyday move; deleting
 * exists because splitting a casebook produces the occasional case that was
 * never real, and archiving those would leave the list full of noise.
 */
export function CaseRowActions({
  caseId,
  title,
  archived,
  sessionCount,
  canEdit,
}: {
  caseId: string;
  title: string;
  archived: boolean;
  sessionCount: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canEdit) return null;

  return (
    <>
      <button
        className="btn btn-quiet py-0 text-2xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setArchived(caseId, !archived);
            if (result?.error) return setError(result.error);
            setError(null);
            router.refresh();
          })
        }
      >
        {archived ? "Restore" : "Archive"}
      </button>

      {/* Only offered when it is actually safe. A case with sessions behind it
          shows nothing here, so the impossible action is never presented. */}
      {sessionCount === 0 && (
        <button
          className="btn btn-quiet py-0 text-2xs hover:text-bad"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Delete “${title}” for good? It has never been run.`)) return;
            start(async () => {
              const result = await deleteCase(caseId);
              if (result?.error) return setError(result.error);
              setError(null);
              router.refresh();
            });
          }}
        >
          Delete
        </button>
      )}

      {error && <span className="w-full text-2xs text-bad">{error}</span>}
    </>
  );
}
