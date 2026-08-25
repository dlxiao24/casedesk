"use client";

import { useTransition } from "react";
import { startSession } from "@/actions/sessions";
import { SAMPLE_CANDIDATE_ID, SAMPLE_CANDIDATE_NAME } from "@/lib/guest";

/**
 * No candidate picker: a guest has exactly one person to case, and the server
 * ignores whatever is sent here anyway.
 */
export function StartGuestSession({ caseId }: { caseId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      className="btn btn-primary w-full justify-center"
      disabled={pending}
      onClick={() => start(() => startSession(caseId, SAMPLE_CANDIDATE_ID))}
    >
      {pending ? "Starting…" : `Start the case with ${SAMPLE_CANDIDATE_NAME}`}
    </button>
  );
}
