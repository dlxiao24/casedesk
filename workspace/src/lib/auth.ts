import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "@/lib/db";
import { devCoachEmail, supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in coach.
 *
 * Anyone who can prove an email address may hold a coach seat: sign-up is
 * open, and the User row is created the first time a confirmed identity turns
 * up here. ADMIN is never granted this way — only an existing admin can hand
 * it out, on the Coaches page.
 *
 * Visitors who are not signed in are not an error; they are guests. See
 * `currentViewer` in `viewer.ts`.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const identity = await signedInIdentity();
  if (!identity) return null;

  const existing = await db.user.findUnique({ where: { email: identity.email } });
  if (existing) return existing;

  // Upsert rather than create: two tabs opening at once would otherwise race
  // for the same unique email and one of them would throw.
  return db.user.upsert({
    where: { email: identity.email },
    create: {
      email: identity.email,
      name: identity.name || identity.email.split("@")[0],
      role: "COACH",
    },
    update: {},
  });
});

/** The proven address, plus whatever display name was given at sign-up. */
async function signedInIdentity(): Promise<{ email: string; name: string } | null> {
  // A dev override, honoured even when Supabase is configured, so local work
  // does not need a real inbox. `devCoachEmail` is hard-wired to "" when
  // NODE_ENV is production, so this cannot ship.
  if (devCoachEmail) {
    const email = devCoachEmail.toLowerCase();
    return { email, name: email.split("@")[0] };
  }
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const name = typeof data.user?.user_metadata?.name === "string"
    ? data.user.user_metadata.name.trim()
    : "";
  return { email, name };
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
