import type { Prisma, User } from "@prisma/client";

/**
 * Candidates are private to the coach who added them; admins see everyone.
 *
 * This narrows spec §2, which had every coach seeing every candidate so that
 * "she already did Market Entry last week" was visible club-wide. The club
 * asked for the narrower rule, so the repeat-case warning now only fires for
 * your own candidates — an admin is the only person with the whole picture.
 */
export function candidateScope(user: Pick<User, "id" | "role">): Prisma.CandidateWhereInput {
  return user.role === "ADMIN" ? {} : { createdById: user.id };
}

export function canSeeCandidate(
  user: Pick<User, "id" | "role">,
  candidate: { createdById: string | null },
) {
  return user.role === "ADMIN" || candidate.createdById === user.id;
}

/**
 * What to show where a candidate's name would appear in a shared view — the
 * sessions list, or a case's recent activity. The fact that a case was run
 * stays visible to everyone; who it was run with does not.
 */
export const HIDDEN_CANDIDATE_LABEL = "Another coach's candidate";
