"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Dimension, SectionKind, TakeawayKind } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { draftTakeaways, extractStarred } from "@/lib/draft";

/** Guard: a shared session is read-only until explicitly reopened (§8.1). */
async function assertUnlocked(sessionId: string) {
  const s = await db.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { locked: true },
  });
  if (s.locked) throw new Error("This session is locked. Reopen it to make changes.");
}

export async function startSession(caseId: string, candidateId: string) {
  const user = await requireUser();

  // A case with no sections is still runnable (§4.4); give it somewhere to
  // write, and point it at the whole case's pages so the runner shows the
  // casebook rather than an empty pane.
  const sectionCount = await db.section.count({ where: { caseId } });
  if (sectionCount === 0) {
    const kase = await db.case.findUniqueOrThrow({
      where: { id: caseId },
      select: { startPage: true, endPage: true },
    });
    await db.section.create({
      data: {
        caseId,
        kind: "PROMPT",
        label: "Whole case",
        order: 0,
        startPage: kase.startPage,
        endPage: kase.endPage ?? kase.startPage,
      },
    });
  }

  const created = await db.session.create({
    data: { caseId, candidateId, coachId: user.id },
  });

  // Opening a case to run it means the coach has at least read it (§5).
  await db.coachCase.upsert({
    where: { userId_caseId: { userId: user.id, caseId } },
    create: { userId: user.id, caseId, state: "READ" },
    update: {},
  });

  redirect(`/sessions/${created.id}/run`);
}

/**
 * Autosave (§6.2). Called on a 500ms debounce from the runner; the client has
 * already written optimistically, so this is allowed to be slow and is never
 * allowed to interrupt.
 */
export async function saveSectionNote(input: {
  sessionId: string;
  sectionId: string;
  whatWasSaid?: string;
  feedback?: string;
  secondsSpent?: number;
}) {
  const user = await requireUser();
  const session = await db.session.findUniqueOrThrow({
    where: { id: input.sessionId },
    select: { locked: true, coachId: true },
  });
  if (session.locked) return { ok: false as const, reason: "locked" as const };
  if (session.coachId !== user.id && user.role !== "ADMIN") {
    return { ok: false as const, reason: "forbidden" as const };
  }

  const data = {
    ...(input.whatWasSaid !== undefined ? { whatWasSaid: input.whatWasSaid } : {}),
    ...(input.feedback !== undefined ? { feedback: input.feedback } : {}),
    ...(input.secondsSpent !== undefined ? { secondsSpent: input.secondsSpent } : {}),
  };

  await db.sectionNote.upsert({
    where: { sessionId_sectionId: { sessionId: input.sessionId, sectionId: input.sectionId } },
    create: {
      sessionId: input.sessionId,
      sectionId: input.sectionId,
      whatWasSaid: input.whatWasSaid ?? "",
      feedback: input.feedback ?? "",
      secondsSpent: input.secondsSpent ?? 0,
    },
    update: data,
  });
  return { ok: true as const, savedAt: Date.now() };
}

export async function saveElapsed(sessionId: string, totalSeconds: number) {
  const session = await db.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { locked: true },
  });
  if (session.locked) return { ok: false as const };
  await db.session.update({ where: { id: sessionId }, data: { totalSeconds } });
  return { ok: true as const };
}

/** Sections are addable mid-session (§4.4). */
export async function addSection(caseId: string, kind: SectionKind, label: string) {
  await requireUser();
  const last = await db.section.findFirst({
    where: { caseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const section = await db.section.create({
    data: {
      caseId,
      kind,
      label: label.trim() || kind,
      order: (last?.order ?? -1) + 1,
      isSolution: kind === "INTERVIEWER_GUIDE",
    },
  });
  revalidatePath(`/cases/${caseId}`);
  return { section };
}

export async function endSession(sessionId: string, totalSeconds: number) {
  const user = await requireUser();
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.locked) redirect(`/sessions/${sessionId}/wrap`);

  await db.session.update({
    where: { id: sessionId },
    data: { status: "COMPLETE", endedAt: new Date(), totalSeconds },
  });

  // Readiness auto-advance on delivery (§5).
  await db.coachCase.upsert({
    where: { userId_caseId: { userId: user.id, caseId: session.caseId } },
    create: {
      userId: user.id,
      caseId: session.caseId,
      state: "DELIVERED",
      lastDeliveredAt: new Date(),
    },
    update: { state: "DELIVERED", lastDeliveredAt: new Date() },
  });

  revalidatePath("/library");
  redirect(`/sessions/${sessionId}/wrap`);
}

export async function setScore(sessionId: string, dimension: Dimension, value: number | null) {
  await requireUser();
  await assertUnlocked(sessionId);

  if (value === null) {
    await db.score.deleteMany({ where: { sessionId, dimension } });
  } else {
    await db.score.upsert({
      where: { sessionId_dimension: { sessionId, dimension } },
      create: { sessionId, dimension, value },
      update: { value },
    });
  }
  return { ok: true as const };
}

export async function setTakeaway(
  sessionId: string,
  kind: TakeawayKind,
  rank: number,
  text: string,
) {
  await requireUser();
  await assertUnlocked(sessionId);

  const trimmed = text.trim();
  if (!trimmed) {
    await db.takeaway.deleteMany({ where: { sessionId, kind, rank } });
    return { ok: true as const };
  }
  await db.takeaway.upsert({
    where: { sessionId_kind_rank: { sessionId, kind, rank } },
    create: { sessionId, kind, rank, text: trimmed },
    update: { text: trimmed },
  });
  return { ok: true as const };
}

export async function setOverallNote(sessionId: string, overallNote: string) {
  await requireUser();
  await assertUnlocked(sessionId);
  await db.session.update({ where: { id: sessionId }, data: { overallNote } });
  return { ok: true as const };
}

export async function setReportOptions(
  sessionId: string,
  options: { includeRecord?: boolean; hideSource?: boolean },
) {
  await requireUser();
  await db.session.update({ where: { id: sessionId }, data: options });
  revalidatePath(`/sessions/${sessionId}/report`);
  return { ok: true as const };
}

/** §7.1 — deterministic, phrase-bank driven. No LLM, no network, no cost. */
export async function draftForSession(sessionId: string) {
  await requireUser();
  await assertUnlocked(sessionId);

  const [scores, phrases, notes] = await Promise.all([
    db.score.findMany({ where: { sessionId } }),
    db.phrase.findMany({ where: { active: true } }),
    db.sectionNote.findMany({ where: { sessionId }, select: { feedback: true } }),
  ]);

  const starred = notes.flatMap((n) => extractStarred(n.feedback));
  const draft = draftTakeaways({
    scores: scores.map((s) => ({ dimension: s.dimension, value: s.value })),
    phrases,
    starred,
  });

  // Only fill empty slots — a coach who already wrote something keeps it.
  const existing = await db.takeaway.findMany({ where: { sessionId } });
  const taken = new Set(existing.map((t) => `${t.kind}:${t.rank}`));

  const writes = (["CONTINUE", "IMPROVE"] as TakeawayKind[]).flatMap((kind) =>
    draft[kind]
      .map((text, i) => ({ kind, rank: i + 1, text }))
      .filter((t) => !taken.has(`${t.kind}:${t.rank}`)),
  );

  await db.$transaction(
    writes.map((w) =>
      db.takeaway.upsert({
        where: { sessionId_kind_rank: { sessionId, kind: w.kind, rank: w.rank } },
        create: { sessionId, ...w },
        update: { text: w.text },
      }),
    ),
  );

  revalidatePath(`/sessions/${sessionId}/wrap`);

  // Hand back the full set so the caller can render it without a round trip.
  const takeaways = await db.takeaway.findMany({
    where: { sessionId },
    orderBy: { rank: "asc" },
    select: { kind: true, rank: true, text: true },
  });
  return { drafted: writes.length, starred: starred.length, takeaways };
}

// ---------- Lifecycle (§8.1) ----------

/** Sharing locks the session: printing, copying markdown, or minting a link. */
export async function markShared(sessionId: string) {
  await requireUser();
  const session = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.locked) return { ok: true as const };

  await db.session.update({
    where: { id: sessionId },
    data: {
      locked: true,
      sharedAt: session.sharedAt ?? new Date(),
      status: session.status === "IN_PROGRESS" ? "COMPLETE" : session.status,
    },
  });
  revalidatePath(`/sessions/${sessionId}/report`);
  revalidatePath(`/sessions/${sessionId}/wrap`);
  return { ok: true as const };
}

export async function createShareLink(sessionId: string) {
  await requireUser();
  const token = randomBytes(24).toString("base64url");
  await db.session.update({
    where: { id: sessionId },
    data: {
      shareToken: token,
      locked: true,
      sharedAt: new Date(),
      status: "COMPLETE",
    },
  });
  revalidatePath(`/sessions/${sessionId}/report`);
  return { token };
}

export async function revokeShareLink(sessionId: string) {
  await requireUser();
  await db.session.update({ where: { id: sessionId }, data: { shareToken: null } });
  revalidatePath(`/sessions/${sessionId}/report`);
  return { ok: true as const };
}

/** Explicit, one-line confirm in the UI. Stamps the report "Revised". */
export async function reopenSession(sessionId: string) {
  await requireUser();
  await db.session.update({
    where: { id: sessionId },
    data: { locked: false, reopenedAt: new Date() },
  });
  revalidatePath(`/sessions/${sessionId}/wrap`);
  revalidatePath(`/sessions/${sessionId}/report`);
  return { ok: true as const };
}

export async function setSessionArchived(sessionId: string, archived: boolean) {
  await requireUser();
  await db.session.update({ where: { id: sessionId }, data: { archived } });
  revalidatePath("/sessions");
  return { ok: true as const };
}

export async function abandonSession(sessionId: string) {
  await requireUser();
  await db.session.update({ where: { id: sessionId }, data: { status: "ABANDONED" } });
  revalidatePath("/sessions");
  redirect("/sessions");
}

/**
 * Leave a case without producing feedback.
 *
 * Distinct from finishing: nothing is scored and no report is drafted. Elapsed
 * time and every note are kept, so the record of what happened survives even
 * though the session is closed out as abandoned.
 */
export async function exitSession(sessionId: string, totalSeconds: number) {
  await requireUser();
  const session = await db.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { locked: true },
  });
  if (!session.locked) {
    await db.session.update({
      where: { id: sessionId },
      data: { status: "ABANDONED", endedAt: new Date(), totalSeconds },
    });
  }
  revalidatePath("/sessions");
  redirect("/library");
}
