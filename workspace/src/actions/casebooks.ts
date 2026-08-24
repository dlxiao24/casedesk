"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SectionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { SUPABASE_BUCKET, STORAGE_QUOTA_BYTES } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Registers a casebook whose file the browser has already uploaded to Storage.
 * Text extraction happens in the browser with pdf.js and is persisted here so
 * sectioning never re-parses (§4.1).
 */
export async function registerCasebook(input: {
  title: string;
  school?: string | null;
  year?: number | null;
  fileKey: string;
  sourceKind: "PDF" | "IMAGES";
  imageKeys?: string[];
  pageCount: number;
  pageText: Record<string, string>;
  byteSize: number;
}) {
  const user = await requireUser();
  if (!input.title.trim()) return { error: "A casebook needs a title." };

  const casebook = await db.casebook.create({
    data: {
      title: input.title.trim(),
      school: input.school?.trim() || null,
      year: input.year ?? null,
      fileKey: input.fileKey,
      sourceKind: input.sourceKind,
      imageKeys: input.imageKeys ?? [],
      pageCount: input.pageCount,
      pageText: input.pageText,
      searchText: Object.values(input.pageText).join(" ").toLowerCase().slice(0, 900_000),
      byteSize: input.byteSize,
      uploadedBy: user.id,
    },
  });
  revalidatePath("/casebooks");
  return { id: casebook.id };
}

/** Bytes stored across all casebooks, for the free-tier capacity warning (§10). */
export async function storageUsage() {
  await requireUser();
  const agg = await db.casebook.aggregate({ _sum: { byteSize: true } });
  const used = agg._sum.byteSize ?? 0;
  return { used, quota: STORAGE_QUOTA_BYTES, ratio: used / STORAGE_QUOTA_BYTES };
}

/**
 * Splitting a casebook into cases (§4.2). The coach confirms a page range and a
 * title; nothing here is ever auto-committed.
 */
export async function createCaseFromRange(input: {
  casebookId: string;
  title: string;
  startPage: number;
  endPage: number;
}) {
  const user = await requireUser();
  if (!input.title.trim()) return { error: "Name the case before saving it." };

  const created = await db.case.create({
    data: {
      casebookId: input.casebookId,
      title: input.title.trim(),
      startPage: Math.min(input.startPage, input.endPage),
      endPage: Math.max(input.startPage, input.endPage),
      caseType: "OTHER",
      ownerId: user.id,
    },
  });
  revalidatePath(`/casebooks/${input.casebookId}/split`);
  revalidatePath("/library");
  return { id: created.id, title: created.title };
}

/**
 * Replaces a case's sections with the coach's page-kind assignments (§4.3).
 * Contiguous pages of the same kind arrive already merged from the client.
 */
export async function saveSections(
  caseId: string,
  sections: {
    kind: SectionKind;
    label: string;
    startPage: number;
    endPage: number;
    targetMins?: number | null;
    /**
     * Index into this same array of the section this one rides along with — an
     * exhibit prompt pinned to its exhibit, a sample framework pinned to its
     * prompt. Positional rather than by id because these rows may not exist yet.
     */
    pairedWithIndex?: number | null;
  }[],
) {
  const user = await requireUser();
  const target = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    select: { ownerId: true },
  });
  if (target.ownerId !== user.id && user.role !== "ADMIN") {
    return { error: "Only the case owner can re-section a case." };
  }

  // Re-sectioning keeps section ids stable wherever a page range survives, so
  // the notes past sessions wrote against them do not become orphans.
  const existing = await db.section.findMany({ where: { caseId } });
  const unmatched = new Set(existing.map((s) => s.id));

  const writes = sections.map((s, i) => {
    const match =
      existing.find((e) => unmatched.has(e.id) && e.startPage === s.startPage && e.kind === s.kind) ??
      existing.find((e) => unmatched.has(e.id) && e.startPage === s.startPage);
    const data = {
      kind: s.kind,
      label: s.label,
      order: i,
      startPage: s.startPage,
      endPage: s.endPage,
      targetMins: s.targetMins ?? null,
      isSolution: s.kind === "INTERVIEWER_GUIDE",
    };
    if (match) {
      unmatched.delete(match.id);
      return db.section.update({ where: { id: match.id }, data });
    }
    return db.section.create({ data: { caseId, ...data } });
  });

  const saved = await db.$transaction([
    ...writes,
    db.section.deleteMany({ where: { id: { in: [...unmatched] } } }),
  ]);

  // Pairing is resolved in a second pass, once every row has an id. Cleared
  // first so a pairing the coach removed does not survive the save.
  const ids = sections.map((_, i) => (saved[i] as { id: string }).id);
  const pairings = sections
    .map((s, i) => ({ id: ids[i], target: s.pairedWithIndex }))
    .filter((p) => p.target !== null && p.target !== undefined && ids[p.target] !== p.id);

  await db.$transaction([
    db.section.updateMany({ where: { caseId }, data: { pairedWithId: null } }),
    ...pairings.map((p) =>
      db.section.update({
        where: { id: p.id },
        data: { pairedWithId: ids[p.target as number] },
      }),
    ),
  ]);

  revalidatePath(`/cases/${caseId}`);
  return { error: undefined };
}

/** A section typed or pasted by hand, for cases with no PDF behind them (§4.3). */
export async function saveTextSection(input: {
  caseId: string;
  sectionId?: string;
  kind: SectionKind;
  label: string;
  bodyText: string;
  targetMins?: number | null;
}) {
  await requireUser();
  const isHidden = input.kind === "INTERVIEWER_GUIDE";

  if (input.sectionId) {
    await db.section.update({
      where: { id: input.sectionId },
      data: {
        kind: input.kind,
        label: input.label.trim() || "Section",
        bodyText: input.bodyText,
        targetMins: input.targetMins ?? null,
        isSolution: isHidden,
      },
    });
  } else {
    const last = await db.section.findFirst({
      where: { caseId: input.caseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await db.section.create({
      data: {
        caseId: input.caseId,
        kind: input.kind,
        label: input.label.trim() || "Section",
        bodyText: input.bodyText,
        order: (last?.order ?? -1) + 1,
        targetMins: input.targetMins ?? null,
        isSolution: isHidden,
      },
    });
  }
  revalidatePath(`/cases/${input.caseId}`);
  return { error: undefined };
}

export async function deleteSection(sectionId: string) {
  await requireUser();
  const section = await db.section.findUniqueOrThrow({ where: { id: sectionId } });
  await db.section.delete({ where: { id: sectionId } });
  revalidatePath(`/cases/${section.caseId}`);
  return { error: undefined };
}

export async function reorderSection(sectionId: string, direction: -1 | 1) {
  await requireUser();
  const section = await db.section.findUniqueOrThrow({ where: { id: sectionId } });
  const neighbour = await db.section.findFirst({
    where: {
      caseId: section.caseId,
      order: direction === -1 ? { lt: section.order } : { gt: section.order },
    },
    orderBy: { order: direction === -1 ? "desc" : "asc" },
  });
  if (!neighbour) return { error: undefined };

  await db.$transaction([
    db.section.update({ where: { id: section.id }, data: { order: neighbour.order } }),
    db.section.update({ where: { id: neighbour.id }, data: { order: section.order } }),
  ]);
  revalidatePath(`/cases/${section.caseId}`);
  return { error: undefined };
}

/**
 * The one destructive delete in the product (§8.1): admin only, typed
 * confirmation, and it cascades to every case and session beneath it.
 */
export async function deleteCasebook(casebookId: string, typedTitle: string) {
  await requireAdmin();
  const casebook = await db.casebook.findUniqueOrThrow({ where: { id: casebookId } });
  if (typedTitle.trim() !== casebook.title) {
    return { error: "The typed title does not match. Nothing was deleted." };
  }

  const supabase = await createClient();
  if (supabase) {
    const keys = [casebook.fileKey, ...casebook.imageKeys].filter(Boolean);
    if (keys.length) await supabase.storage.from(SUPABASE_BUCKET).remove(keys);
  }

  await db.casebook.delete({ where: { id: casebookId } });
  revalidatePath("/casebooks");
  revalidatePath("/library");
  redirect("/casebooks");
}

/**
 * A short-lived signed URL for a stored casebook file. Returns null when
 * Supabase is not configured, which is the local-development case — the runner
 * falls back to typed section text.
 */
export async function signedFileUrl(key: string, expiresInSeconds = 60 * 60) {
  await requireUser();
  const supabase = await createClient();
  if (!supabase || !key) return null;

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(key, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
