"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { candidateScope, canSeeCandidate } from "@/lib/candidateAccess";
import { REAL_CANDIDATES } from "@/lib/viewer";

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
      ...REAL_CANDIDATES,
      ...candidateScope(user),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, cohort: true, year: true },
  });
}

/**
 * Permanent delete, admin only, and only once archived.
 *
 * Archiving is the reversible step and stays the default (§14); this is the
 * escape hatch for a duplicate or a test record. Sessions are removed
 * explicitly rather than by a schema cascade, so that deleting a candidate is
 * the only thing that can ever take their sessions with them.
 */
export async function deleteCandidate(id: string, typedName = "") {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "Only an admin can permanently delete a candidate." };
  }

  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { name: true, archived: true, _count: { select: { sessions: true } } },
  });
  if (!candidate) return { error: "That candidate no longer exists." };
  if (!candidate.archived) {
    return { error: `Archive ${candidate.name} first if you really mean to delete them.` };
  }

  const sessions = candidate._count.sessions;
  if (sessions > 0 && typedName.trim() !== candidate.name) {
    return { error: "The typed name does not match. Nothing was deleted." };
  }

  await db.$transaction([
    db.session.deleteMany({ where: { candidateId: id } }),
    db.candidate.delete({ where: { id } }),
  ]);
  revalidatePath("/candidates");
  revalidatePath("/sessions");
  return { error: undefined };
}
