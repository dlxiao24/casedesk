"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "A candidate needs a name."),
  email: z.string().trim().email().optional().nullable().or(z.literal("").transform(() => null)),
  cohort: z.string().trim().optional().nullable(),
  year: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

/** Creating a candidate must not leave the session-start flow (§6.2). */
export async function createCandidate(input: {
  name: string;
  email?: string | null;
  cohort?: string | null;
  year?: string | null;
}) {
  await requireUser();
  const parsed = schema.safeParse({
    name: input.name,
    email: input.email?.trim() || null,
    cohort: input.cohort?.trim() || null,
    year: input.year?.trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save that candidate." };
  }
  const candidate = await db.candidate.create({ data: parsed.data });
  revalidatePath("/candidates");
  return { candidate: { id: candidate.id, name: candidate.name, cohort: candidate.cohort } };
}

export async function updateCandidate(id: string, form: FormData) {
  await requireUser();
  const parsed = schema.safeParse({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? "").trim() || null,
    cohort: String(form.get("cohort") ?? "").trim() || null,
    year: String(form.get("year") ?? "").trim() || null,
    notes: String(form.get("notes") ?? "").trim() || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save." };

  await db.candidate.update({ where: { id }, data: parsed.data });
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/candidates");
  return { error: undefined };
}

/** Soft delete everywhere (§14). */
export async function setCandidateArchived(id: string, archived: boolean) {
  await requireUser();
  await db.candidate.update({ where: { id }, data: { archived } });
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { error: undefined };
}

export async function searchCandidates(query: string) {
  await requireUser();
  const q = query.trim();
  return db.candidate.findMany({
    where: {
      archived: false,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, cohort: true, year: true },
  });
}
