"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { setSampleForGuests } from "@/actions/cases";

/**
 * The one control that decides what the outside world can read. Admin only,
 * and worded as what it does rather than what it is called in the database —
 * "shown to guests" is the fact an admin needs at a glance.
 */
export function SampleForGuests({
  caseId,
  sample,
  isAdmin,
  sectionCount,
  archived,
}: {
  caseId: string;
  sample: boolean;
  isAdmin: boolean;
  sectionCount: number;
  archived: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!isAdmin) return null;

  const blocked = !sample && (archived || sectionCount === 0);
  const why = archived
    ? "Restore this case first."
    : sectionCount === 0
      ? "Split it into sections first — a guest cannot be the one to create them."
      : undefined;

  return (
    <span className="flex items-center gap-2">
      <button
        className={clsx("btn py-0.5", sample ? "border-accent/50 text-accent" : "btn-quiet")}
        disabled={pending || blocked}
        title={why ?? (sample ? "Signed-out visitors can read this case" : "Open this case to signed-out visitors")}
        onClick={() =>
          start(async () => {
            const result = await setSampleForGuests(caseId, !sample);
            if (result?.error) return setError(result.error);
            setError(null);
            router.refresh();
          })
        }
      >
        {pending ? "Working…" : sample ? "Shown to guests" : "Show to guests"}
      </button>
      {error && <span className="text-2xs text-bad">{error}</span>}
      {!error && blocked && why && <span className="text-2xs text-faint">{why}</span>}
    </span>
  );
}
