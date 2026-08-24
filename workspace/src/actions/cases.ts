"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ReadinessState } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CASE_ATTRIBUTES } from "@/lib/constants";

const caseInput = z.object({
  title: z.string().trim().min(1, "A case needs a title."),
  casebookId: z.string().optional().nullable(),
  startPage: z.coerce.number().int().positive().optional().nullable(),
  endPage: z.coerce.number().int().positive().optional().nullable(),
  caseType: z.enum([
    "PROFITABILITY", "MARKET_ENTRY", "MA", "GROWTH", "PRICING",
    "COST_REDUCTION", "OPERATIONS", "MARKET_SIZING", "NEW_PRODUCT", "OTHER",
  ]),
  industry: z.string().trim().optional().nullable(),
  firm: z.string().trim().optional().nullable(),
  targetRound: z.enum(["SCREENING", "FIRST_ROUND", "FINAL_ROUND"]).optional().nullable(),
  format: z.enum(["INTERVIEWER_LED", "INTERVIEWEE_LED"]),
  notes: z.string().optional().nullable(),
});

function blank(value: FormDataEntryValue | null) {
  const s = typeof value === "string" ? value.trim() : "";
  return s === "" ? null : s;
}

/**
 * §4.4 — a case is saveable with only a title. Everything else is optional and
 * addable later, including mid-session. Never block a save on empty fields.
 */
export async function createCase(_prev: { error?: string } | null, form: FormData) {
  const user = await requireUser();
  const parsed = caseInput.safeParse({
    title: form.get("title") ?? "",
    casebookId: blank(form.get("casebookId")),
    startPage: blank(form.get("startPage")),
    endPage: blank(form.get("endPage")),
    caseType: blank(form.get("caseType")) ?? "OTHER",
    industry: blank(form.get("industry")),
    firm: blank(form.get("firm")),
    targetRound: blank(form.get("targetRound")),
    format: blank(form.get("format")) ?? "INTERVIEWER_LED",
    notes: blank(form.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save that case." };
  }

  const created = await db.case.create({
    data: { ...parsed.data, ownerId: user.id },
  });
  revalidatePath("/library");
  redirect(`/cases/${created.id}`);
}

export async function updateCase(caseId: string, form: FormData) {
  const user = await requireUser();
  const existing = await db.case.findUniqueOrThrow({ where: { id: caseId } });
  if (existing.ownerId !== user.id && user.role !== "ADMIN") {
    return { error: "Only the case owner can edit these fields." };
  }

  const parsed = caseInput.partial().safeParse({
    title: form.get("title") ?? existing.title,
    casebookId: blank(form.get("casebookId")),
    startPage: blank(form.get("startPage")),
    endPage: blank(form.get("endPage")),
    caseType: blank(form.get("caseType")) ?? existing.caseType,
    industry: blank(form.get("industry")),
    firm: blank(form.get("firm")),
    targetRound: blank(form.get("targetRound")),
    format: blank(form.get("format")) ?? existing.format,
    notes: form.get("notes") === null ? existing.notes : String(form.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save." };

  await db.case.update({ where: { id: caseId }, data: parsed.data });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/library");
  return { error: undefined };
}

/** Owner-only 1-5 attributes and the quality verdict (§14). */
export async function setCaseAttribute(caseId: string, key: string, value: number | null) {
  const user = await requireUser();
  const known = [...CASE_ATTRIBUTES.map((a) => a.key), "caseQuality"] as string[];
  if (!known.includes(key)) return { error: "Unknown attribute." };

  const target = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    select: { ownerId: true },
  });
  if (target.ownerId !== user.id) {
    return { error: "Case ratings belong to the coach who added the case." };
  }
  if (value !== null && (value < 1 || value > 5)) return { error: "Ratings run 1 to 5." };

  await db.case.update({ where: { id: caseId }, data: { [key]: value } });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/library");
  return { error: undefined };
}

export async function setArchived(caseId: string, archived: boolean) {
  const user = await requireUser();
  const target = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    select: { ownerId: true },
  });
  if (target.ownerId !== user.id && user.role !== "ADMIN") {
    return { error: "Only the owner or an admin can archive a case." };
  }
  await db.case.update({ where: { id: caseId }, data: { archived } });
  revalidatePath("/library");
  return { error: undefined };
}

// ---------- CoachCase: everything personal to a coach about a case ----------

/** Created lazily on first interaction (§3). */
export async function ensureCoachCase(caseId: string, userId: string) {
  return db.coachCase.upsert({
    where: { userId_caseId: { userId, caseId } },
    create: { userId, caseId },
    update: {},
  });
}

export async function setReadiness(caseId: string, state: ReadinessState) {
  const user = await requireUser();
  await db.coachCase.upsert({
    where: { userId_caseId: { userId: user.id, caseId } },
    create: { userId: user.id, caseId, state },
    update: { state },
  });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/library");
  return { error: undefined };
}

/**
 * Autosaved from an always-editable textarea. No save button, no modal — it
 * should be as cheap to jot a note as it is to think of one (§5).
 */
export async function savePersonalNotes(caseId: string, personalNotes: string) {
  const user = await requireUser();
  await db.coachCase.upsert({
    where: { userId_caseId: { userId: user.id, caseId } },
    create: { userId: user.id, caseId, personalNotes },
    update: { personalNotes },
  });
  return { savedAt: Date.now() };
}

/** Appends a dated line, used by the wrap-up's "note to self" (§7). */
export async function appendPersonalNote(caseId: string, text: string) {
  const user = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) return { error: undefined };

  const existing = await db.coachCase.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `${stamp} — ${trimmed}`;
  const merged = existing?.personalNotes ? `${existing.personalNotes.trimEnd()}\n${line}` : line;

  await db.coachCase.upsert({
    where: { userId_caseId: { userId: user.id, caseId } },
    create: { userId: user.id, caseId, personalNotes: line },
    update: { personalNotes: merged },
  });
  revalidatePath(`/cases/${caseId}`);
  return { error: undefined };
}

/**
 * Hard delete, for a case that should never have existed — the usual cause is a
 * mis-drawn page range while splitting a casebook.
 *
 * Refused once anything has been run on it. Deleting would cascade to every
 * session, which means a candidate's scores and feedback, and no amount of
 * confirmation copy makes that a reasonable thing to do by accident. Archiving
 * is the answer there (§14).
 */
export async function deleteCase(caseId: string) {
  const user = await requireUser();
  const target = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    select: { ownerId: true, title: true, _count: { select: { sessions: true } } },
  });
  if (target.ownerId !== user.id && user.role !== "ADMIN") {
    return { error: "Only the owner or an admin can delete a case." };
  }
  if (target._count.sessions > 0) {
    return {
      error: `“${target.title}” has ${target._count.sessions} session${
        target._count.sessions === 1 ? "" : "s"
      } against it. Archive it instead — deleting would take that feedback with it.`,
    };
  }

  await db.case.delete({ where: { id: caseId } });
  revalidatePath("/casebooks");
  revalidatePath("/library");
  return { error: undefined };
}
