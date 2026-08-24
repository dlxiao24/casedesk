"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { candidateScope, canSeeCandidate } from "@/lib/candidateAccess";

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
  const user = await requireUser();
  const parsed = schema.safeParse({
    name: input.name,
    email: input.email?.trim() || null,
    cohort: input.cohort?.trim() || null,
    year: input.year?.trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save that candidate." };
  }
  const candidate = await db.candidate.create({
    data: { ...parsed.data, createdById: user.id },
  });
  revalidatePath("/candidates");
  return { candidate: { id: candidate.id, name: candidate.name, cohort: candidate.cohort } };
}

/** Only the coach who added a candidate can edit them, plus admins. */
async function assertOwnCandidate(id: string) {
  const user = await requireUser();
  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!candidate || !canSeeCandidate(user, candidate)) {
    return { error: "That candidate belongs to another coach." as string };
  }
  return { error: undefined };
}

export async function updateCandidate(id: string, form: FormData) {
  const guard = await assertOwnCandidate(id);
  if (guard.error) return guard;

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
  const guard = await assertOwnCandidate(id);
  if (guard.error) return guard;

  await db.candidate.update({ where: { id }, data: { archived } });
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { error: undefined };
}

export async function searchCandidates(query: string) {
  const user = await requireUser();
  const q = query.trim();
  return db.candidate.findMany({
    where: {
      archived: false,
      ...candidateScope(user),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, cohort: true, year: true },
  });
}
