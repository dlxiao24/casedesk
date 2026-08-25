"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ReadinessState } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  RATED_KEYS,
  type RatingValues,
  cleanRating,
  isEmptyRating,
  recomputeCaseAverages,
} from "@/lib/caseRatings";
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
  if (user.role !== "ADMIN") {
    return { error: "Only an admin can build the case library." };
  }
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
  if (user.role !== "ADMIN") {
    return { error: "Only an admin can build the case library." };
  }
  const existing = await db.case.findUniqueOrThrow({ where: { id: caseId } });
  if (existing.ownerId !== user.id && user.role !== "ADMIN") {
    return { error: "Only the case owner can edit these fields." };
  }

  /**
   * Only touch what was actually submitted.
   *
   * This used to read every field unconditionally, so a form carrying just the
   * prep notes — the Edit button on the case page does exactly that — sent null
   * for casebookId, the page range, industry, firm and round, wiping them and
   * dropping the case out of its casebook. An absent field now means "leave it
   * alone"; a present but empty one still means "clear it".
   */
  const submitted: Record<string, unknown> = {};
  for (const key of [
    "title",
    "casebookId",
    "startPage",
    "endPage",
    "caseType",
    "industry",
    "firm",
    "targetRound",
    "format",
  ]) {
    if (form.has(key)) submitted[key] = blank(form.get(key));
  }
  // A required field cannot be cleared to null; fall back to what it already is.
  if (form.has("title")) submitted.title = blank(form.get("title")) ?? existing.title;
  if (form.has("caseType")) submitted.caseType = blank(form.get("caseType")) ?? existing.caseType;
  if (form.has("format")) submitted.format = blank(form.get("format")) ?? existing.format;
  if (form.has("notes")) submitted.notes = String(form.get("notes"));

  const parsed = caseInput.partial().safeParse(submitted);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save." };

  await db.case.update({ where: { id: caseId }, data: parsed.data });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/library");
  return { error: undefined };
}

/** Owner-only 1-5 attributes and the quality verdict (§14). */
/**
 * Record one coach's rating of a case.
 *
 * Any coach may rate any case. Ratings used to belong to whoever added the
 * case, which made the library's numbers one person's taste; what the library
 * shows now is the average, and this is one vote in it.
 *
 * Only the keys present in `values` are touched, so the wrap-up page can set
 * the verdict alone without wiping the six attributes rated earlier.
 */
export async function rateCase(caseId: string, values: RatingValues) {
  const user = await requireUser();

  const clean: Record<string, number | null> = {};
  for (const key of RATED_KEYS) {
    if (!(key in values)) continue;
    clean[key] = cleanRating(values[key]);
  }
  if (Object.keys(clean).length === 0) return { error: undefined };

  const saved = await db.caseRating.upsert({
    where: { userId_caseId: { userId: user.id, caseId } },
    create: { userId: user.id, caseId, ...clean },
    update: clean,
    });

  // Clearing every field is how a coach withdraws a rating, and an empty row
  // would still be counted as one by ratingCount.
  if (isEmptyRating(saved)) {
    await db.caseRating.delete({ where: { id: saved.id } });
  }

  await recomputeCaseAverages(caseId);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/library");
  return { error: undefined };
}

/** One attribute at a time, for the controls that set exactly one. */
export async function setCaseAttribute(caseId: string, key: string, value: number | null) {
  if (!(RATED_KEYS as readonly string[]).includes(key)) return { error: "Unknown attribute." };
  return rateCase(caseId, { [key]: value } as RatingValues);
}

/** The signed-in coach's own rating, for pre-filling the controls. */
export async function myRating(caseId: string): Promise<RatingValues> {
  const user = await requireUser();
  const mine = await db.caseRating.findUnique({
    where: { userId_caseId: { userId: user.id, caseId } },
  });
  if (!mine) return {};
  return Object.fromEntries(RATED_KEYS.map((key) => [key, mine[key]])) as RatingValues;
}

export async function setArchived(caseId: string, archived: boolean) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "Only an admin can build the case library." };
  }
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

/**
 * Put a case in the shop window, or take it out.
 *
 * Admin only, and refused for a case a guest could not safely run: an archived
 * one is not in the library at all, and an unsectioned one would have a
 * section written into it by the first visitor who pressed start.
 */
export async function setSampleForGuests(caseId: string, sample: boolean) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "Only an admin chooses what guests see." };
  }

  const target = await db.case.findUnique({
    where: { id: caseId },
    select: { archived: true, _count: { select: { sections: true } } },
  });
  if (!target) return { error: "That case no longer exists." };

  if (sample) {
    if (target.archived) {
      return { error: "Restore this case before showing it to guests." };
    }
    if (target._count.sections === 0) {
      return { error: "Split this case into sections first. A guest cannot be the one to create them." };
    }
  }

  await db.case.update({ where: { id: caseId }, data: { sampleForGuests: sample } });
  revalidatePath("/library");
  revalidatePath(`/cases/${caseId}`);
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
 * Permanent delete, admin only.
 *
 * A case nobody has run goes immediately. One with sessions behind it has to be
 * archived first and then confirmed by typing its title, because deleting it
 * cascades to every session — a candidate's scores and their written report.
 * The spec's soft-delete default (§14) still holds for coaches; this is the
 * escape hatch for an admin clearing out genuinely dead records.
 */
export async function deleteCase(caseId: string, typedTitle = "") {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { error: "Only an admin can build the case library." };
  }
  const target = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    select: { ownerId: true, title: true, archived: true, _count: { select: { sessions: true } } },
  });
  const sessions = target._count.sessions;

  // A case nobody has run holds nothing worth protecting — the usual cause is a
  // mis-drawn page range, and making someone archive it first is friction for
  // no gain.
  if (sessions > 0) {
    if (!target.archived) {
      return {
        error: `“${target.title}” has ${sessions} session${sessions === 1 ? "" : "s"} against it. Archive it first if you really mean to delete it.`,
      };
    }
    // Archived and still deliberate: make them type the title, because this
    // takes every score and every written report down with it.
    if (typedTitle.trim() !== target.title) {
      return { error: "The typed title does not match. Nothing was deleted." };
    }
  }

  await db.case.delete({ where: { id: caseId } });
  revalidatePath("/casebooks");
  revalidatePath("/library");
  return { error: undefined };
}
