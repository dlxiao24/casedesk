import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { canSeeSession } from "@/lib/sessionAccess";
import {
  GUEST_COOKIE,
  GUEST_USER_EMAIL,
  GUEST_USER_ID,
  SAMPLE_CANDIDATE_ID,
  SAMPLE_CANDIDATE_NAME,
} from "@/lib/guest";

/**
 * Who is looking at this page — a coach with an account, or a signed-out
 * visitor holding nothing but a cookie.
 *
 * Pages that only coaches may see keep calling `requireUser`. Pages a guest
 * may reach ask for a viewer instead and branch on `kind`.
 */
export type Viewer =
  | { kind: "user"; user: User; guestKey: null }
  | { kind: "guest"; user: null; guestKey: string | null };

export async function currentViewer(): Promise<Viewer> {
  const user = await currentUser();
  if (user) return { kind: "user", user, guestKey: null };

  const store = await cookies();
  return { kind: "guest", user: null, guestKey: store.get(GUEST_COOKIE)?.value ?? null };
}

/**
 * The guest's own id, for actions that write. Missing means the cookie never
 * arrived — a bot, or a browser refusing cookies — and there is nothing to
 * own a session with, so there is nothing to do but ask them to sign in.
 */
export async function requireGuestKey(): Promise<string> {
  const store = await cookies();
  const key = store.get(GUEST_COOKIE)?.value;
  if (!key) redirect("/login");
  return key;
}

/**
 * The two rows the guest flow needs but nobody creates by hand: the account
 * its sessions hang off, and the one candidate it runs them against. Made on
 * demand, so a fresh database needs no ceremony.
 */
export async function ensureGuestRecords() {
  await db.user.upsert({
    where: { id: GUEST_USER_ID },
    create: { id: GUEST_USER_ID, email: GUEST_USER_EMAIL, name: "Guest", role: "COACH" },
    update: {},
  });
  await db.candidate.upsert({
    where: { id: SAMPLE_CANDIDATE_ID },
    create: {
      id: SAMPLE_CANDIDATE_ID,
      name: SAMPLE_CANDIDATE_NAME,
      notes: "The practice candidate every signed-out visitor cases. Not a real person.",
    },
    update: {},
  });
}

/**
 * Coaches' lists hide the system rows. A guest's session is their own private
 * demo, not club activity, and "Sample User" is not somebody's candidate.
 */
export const REAL_SESSIONS = { guestKey: null } as const;
export const REAL_CANDIDATES = { id: { not: SAMPLE_CANDIDATE_ID } } as const;
export const REAL_USERS = { id: { not: GUEST_USER_ID } } as const;

/**
 * Who may open a session's pages — the runner, the wrap-up, the report.
 *
 * A coach reads the sessions they ran and nothing else; an admin reaches
 * anything. That is the rule the actions have always applied to writes, and
 * reading now agrees with writing — see `sessionAccess.ts` for why it narrows
 * §2. A guest sees only what their own cookie started, and a guest's session
 * is not club activity, so it stays out of coaches' sight — an admin
 * excepted, who can reach anything.
 *
 * Denial redirects rather than 404s. The session exists and its id came from
 * somewhere legitimate — a bookmark, a link from before the rule tightened —
 * so sending the coach to their own list is the honest answer.
 */
export async function requireSessionAccess(sessionId: string): Promise<Viewer> {
  const viewer = await currentViewer();
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { guestKey: true, coachId: true },
  });
  if (!session) notFound();

  if (viewer.kind === "user") {
    // A guest's run belongs to its cookie, not to the coach whose id sits on
    // it, so ownership says nothing here — only an admin may look.
    if (session.guestKey !== null) {
      if (viewer.user.role !== "ADMIN") redirect("/sessions");
      return viewer;
    }
    if (!canSeeSession(viewer.user, session)) redirect("/sessions");
    return viewer;
  }

  if (!viewer.guestKey || session.guestKey !== viewer.guestKey) redirect("/login");
  return viewer;
}
