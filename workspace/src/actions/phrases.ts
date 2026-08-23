"use server";

import { revalidatePath } from "next/cache";
import type { Band, Dimension, TakeawayKind } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** Phrase bank administration (§7.1). Admin only. */

export async function createPhrase(input: {
  dimension: Dimension;
  band: Band;
  kind: TakeawayKind;
  text: string;
}) {
  await requireAdmin();
  const text = input.text.trim();
  if (!text) return { error: "A phrase needs text." };

  await db.phrase.create({ data: { ...input, text } });
  revalidatePath("/settings/phrases");
  return { error: undefined };
}

export async function updatePhrase(id: string, text: string) {
  await requireAdmin();
  const trimmed = text.trim();
  if (!trimmed) return { error: "A phrase needs text." };

  await db.phrase.update({ where: { id }, data: { text: trimmed } });
  revalidatePath("/settings/phrases");
  return { error: undefined };
}

/** Phrases are deactivated, not deleted — drafted sessions keep their wording. */
export async function setPhraseActive(id: string, active: boolean) {
  await requireAdmin();
  await db.phrase.update({ where: { id }, data: { active } });
  revalidatePath("/settings/phrases");
  return { error: undefined };
}
