"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { GUEST_USER_ID } from "@/lib/guest";

/**
 * Sign-up is open and everyone lands as a COACH. Admin is the one thing that
 * cannot be self-served: an existing admin grants it here, and nowhere else.
 */
export async function setUserRole(userId: string, role: Role) {
  const admin = await requireAdmin();
  if (admin.id === userId) return { error: "You cannot change your own role." };
  if (userId === GUEST_USER_ID) return { error: "The guest account has no role to change." };

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
