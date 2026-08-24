"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setArchived } from "@/actions/cases";

/**
 * Soft delete, per §14 — there is no hard delete for a case anywhere in the UI.
 * Archived cases drop out of the library's default view and come back through
 * its "Archived" filter, with every session they carry still intact.
 */
export function ArchiveCase({
  caseId,
  archived,
  canEdit,
  sessionCount,
}: {
  caseId: string;
  archived: boolean;
  canEdit: boolean;
  sessionCount: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canEdit) return null;

  function toggle() {
    if (!archived && sessionCount > 0) {
      const ok = window.confirm(
        `Archive this case? Its ${sessionCount} session${sessionCount === 1 ? "" : "s"} and every report stay exactly as they are — the case just stops showing up in the library.`,
      );
      if (!ok) return;
    }
    start(async () => {
      const result = await setArchived(caseId, !archived);
      if (result?.error) return setError(result.error);
      setError(null);
      router.refresh();
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button className="btn btn-quiet py-0.5" disabled={pending} onClick={toggle}>
        {pending ? "Working…" : archived ? "Restore" : "Archive"}
      </button>
      {error && <span className="text-2xs text-bad">{error}</span>}
    </span>
  );
}
