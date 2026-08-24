"use client";

import { deleteCandidate } from "@/actions/candidates";
import { DeleteForever } from "@/components/DeleteForever";

/** Permanent deletion for an archived candidate. Admins only. */
export function CandidateRowActions({
  id,
  name,
  sessionCount,
}: {
  id: string;
  name: string;
  sessionCount: number;
}) {
  return (
    <DeleteForever
      name={name}
      carries={
        sessionCount > 0
          ? `${sessionCount} session${sessionCount === 1 ? "" : "s"} and their reports`
          : undefined
      }
      onDelete={(typed) => deleteCandidate(id, typed)}
    />
  );
}
