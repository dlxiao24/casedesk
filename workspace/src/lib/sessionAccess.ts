import type { Prisma, User } from "@prisma/client";

/**
 * Sessions are private to the coach who ran them; admins see every one.
 *
 * This narrows spec §2, which had every coach reading every session so that
 * "she already did Market Entry last week" was visible club-wide. That was
 * survivable while every account belonged to a club member. It stops being
 * survivable the moment anyone who confirms an email becomes a coach, because
 * a session is not a neutral record: the report carries the candidate's name,
 * the notes taken while they were being cased, and the feedback written about
 * them afterwards. A candidate agreed to be cased by a club coach, not to be
 * read by whoever signs up.
 *
 * Writing already drew this exact line — `inspectSession` in
 * `src/actions/sessions.ts` has been refusing writes to other coaches'
 * sessions for the same reason. Reading now agrees with writing.
 *
 * The repeat-case warning (§9) survives the narrowing: it fires off the
 * candidate, and candidates are already private to the coach who added them
 * (`candidateAccess.ts`), so the coach who needs the warning still gets it.
 */
export function sessionScope(user: Pick<User, "id" | "role">): Prisma.SessionWhereInput {
  return user.role === "ADMIN" ? {} : { coachId: user.id };
}

export function canSeeSession(user: Pick<User, "id" | "role">, session: { coachId: string }) {
  return user.role === "ADMIN" || session.coachId === user.id;
}
