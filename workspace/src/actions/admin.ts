"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";

const email = z.string().trim().toLowerCase().email("That does not look like an email address.");

/**
 * Invite-only (§2). An invite is a row, not an email — the coach signs in with
 * a magic link and the invite is redeemed on first login. No public signup.
 */
export async function inviteCoach(_prev: { error?: string; ok?: string } | null, form: FormData) {
  const admin = await requireAdmin();
  const parsed = email.safeParse(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const role = (String(form.get("role") ?? "COACH") === "ADMIN" ? "ADMIN" : "COACH") as Role;

  const existingUser = await db.user.findUnique({ where: { email: parsed.data } });
  if (existingUser) return { error: `${parsed.data} already has an account.` };

  await db.invite.upsert({
    where: { email: parsed.data },
    create: { email: parsed.data, role, invitedById: admin.id },
    update: { role, revokedAt: null, invitedById: admin.id },
  });
  revalidatePath("/settings/coaches");
  return { ok: `Invited ${parsed.data}. They can sign in with a magic link.` };
}

export async function revokeInvite(inviteId: string) {
  await requireAdmin();
  await db.invite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
  revalidatePath("/settings/coaches");
  return { error: undefined };
}

export async function setUserRole(userId: string, role: Role) {
  const admin = await requireAdmin();
  if (admin.id === userId) return { error: "You cannot change your own role." };

  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/settings/coaches");
  return { error: undefined };
}

export async function updateOwnName(form: FormData) {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "A name is required." };

  await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/settings");
  return { error: undefined };
}
