import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "@/lib/db";
import { devCoachEmail, supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in coach.
 *
 * Invite-only (§2): a Supabase identity is only honoured if a matching User row
 * exists, or a live Invite does — in which case the invite is accepted and the
 * User row created on first login. There is no public signup path.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const email = await signedInEmail();
  if (!email) return null;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;

  const invite = await db.invite.findUnique({ where: { email } });
  if (!invite || invite.revokedAt) return null;

  const [user] = await db.$transaction([
    db.user.create({
      data: { email, name: email.split("@")[0], role: invite.role },
    }),
    db.invite.update({ where: { email }, data: { acceptedAt: new Date() } }),
  ]);
  return user;
});

async function signedInEmail(): Promise<string | null> {
  // A dev override, honoured even when Supabase is configured, so local work
  // does not need a magic-link round trip through a real inbox. `devCoachEmail`
  // is hard-wired to "" when NODE_ENV is production, so this cannot ship.
  if (devCoachEmail) return devCoachEmail.toLowerCase();
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.toLowerCase() ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/library");
  return user;
}

export function isAdmin(user: { role: Role }) {
  return user.role === "ADMIN";
}
