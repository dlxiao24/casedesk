"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Is this address allowed to receive a sign-in link?
 *
 * Checked before Supabase is asked to send anything, for two reasons. It keeps
 * uninvited addresses from consuming the project's hourly email allowance —
 * which is small, and shared with every real coach trying to sign in — and it
 * lets a typo say so immediately instead of after a wait for a mail that never
 * arrives.
 *
 * This does reveal whether an address has been invited. For an invite-only club
 * tool that is the right trade: the alternative is a coach staring at "check
 * your inbox" for a link that was never sent.
 */
export async function canRequestSignInLink(rawEmail: string) {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false as const, error: "That does not look like an email address." };

  const email = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (user) return { ok: true as const };

  const invite = await db.invite.findUnique({ where: { email } });
  if (!invite || invite.revokedAt) {
    return {
      ok: false as const,
      error: "That email has not been invited. Ask a Case Desk admin to invite you first.",
    };
  }

  return { ok: true as const };
}
