import type { Prisma, ReadinessState } from "@prisma/client";
import { db } from "@/lib/db";
import { CASE_ATTRIBUTES, type CaseAttributeKey } from "@/lib/constants";

export type LibraryFilters = {
  q?: string;
  caseType?: string;
  industry?: string;
  firm?: string;
  format?: string;
  targetRound?: string;
  casebookId?: string;
  readiness?: string;
  quality?: string;
  archived?: boolean;
  /** Per-attribute minimums, e.g. { quantIntensity: 3 }. */
  attrMin: Partial<Record<CaseAttributeKey, number>>;
  attrMax: Partial<Record<CaseAttributeKey, number>>;
};

export function parseFilters(params: Record<string, string | string[] | undefined>): LibraryFilters {
  const one = (k: string) => {
    const v = params[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s !== "" ? s : undefined;
  };
  const attrMin: LibraryFilters["attrMin"] = {};
  const attrMax: LibraryFilters["attrMax"] = {};
  for (const { key } of CASE_ATTRIBUTES) {
    const lo = Number(one(`${key}Min`));
    const hi = Number(one(`${key}Max`));
    if (Number.isInteger(lo) && lo >= 1 && lo <= 5) attrMin[key] = lo;
    if (Number.isInteger(hi) && hi >= 1 && hi <= 5) attrMax[key] = hi;
  }
  return {
    q: one("q"),
    caseType: one("caseType"),
    industry: one("industry"),
    firm: one("firm"),
    format: one("format"),
    targetRound: one("targetRound"),
    casebookId: one("casebookId"),
    readiness: one("readiness"),
    quality: one("quality"),
    archived: one("archived") === "1",
    attrMin,
    attrMax,
  };
}

export type LibraryRow = Awaited<ReturnType<typeof libraryRows>>[number];

/**
 * The library query (§5).
 *
 * Filtering happens in Postgres; ordering happens here, because the default
 * sort — least recently delivered *by the current coach* — lives on CoachCase
 * and a club library is small enough that in-memory ordering costs nothing.
 */
export async function libraryRows(userId: string, filters: LibraryFilters) {
  const where: Prisma.CaseWhereInput = { archived: filters.archived };

  if (filters.caseType) where.caseType = filters.caseType as never;
  if (filters.format) where.format = filters.format as never;
  if (filters.targetRound) where.targetRound = filters.targetRound as never;
  if (filters.casebookId) where.casebookId = filters.casebookId;
  if (filters.industry) where.industry = { contains: filters.industry, mode: "insensitive" };
  if (filters.firm) where.firm = { contains: filters.firm, mode: "insensitive" };

  if (filters.quality) {
    if (filters.quality === "unrated") where.caseQuality = null;
    else where.caseQuality = { gte: Number(filters.quality) };
  }

  for (const { key } of CASE_ATTRIBUTES) {
    const lo = filters.attrMin[key];
    const hi = filters.attrMax[key];
    if (lo !== undefined || hi !== undefined) {
      (where as Record<string, unknown>)[key] = {
        ...(lo !== undefined ? { gte: lo } : {}),
        ...(hi !== undefined ? { lte: hi } : {}),
      };
    }
  }

  // Search spans title, shared notes, my personal notes, and extracted page text.
  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { industry: { contains: q, mode: "insensitive" } },
      { firm: { contains: q, mode: "insensitive" } },
      { coachCases: { some: { userId, personalNotes: { contains: q, mode: "insensitive" } } } },
      { casebook: { searchText: { contains: q.toLowerCase() } } },
      { casebook: { title: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (filters.readiness) {
    if (filters.readiness === "UNREAD") {
      // No row at all also means unread — CoachCase is created lazily.
      where.AND = [
        {
          OR: [
            { coachCases: { none: { userId } } },
            { coachCases: { some: { userId, state: "UNREAD" } } },
          ],
        },
      ];
    } else {
      where.coachCases = { some: { userId, state: filters.readiness as ReadinessState } };
    }
  }

  const cases = await db.case.findMany({
    where,
    include: {
      casebook: { select: { id: true, title: true, school: true, year: true } },
      owner: { select: { id: true, name: true } },
      coachCases: { where: { userId }, take: 1 },
      _count: { select: { sessions: true, sections: true } },
    },
    take: 500,
  });

  return cases
    .map((c) => {
      const mine = c.coachCases[0] ?? null;
      return {
        ...c,
        mine,
        readiness: (mine?.state ?? "UNREAD") as ReadinessState,
        lastDeliveredAt: mine?.lastDeliveredAt ?? null,
        personalNotes: mine?.personalNotes ?? null,
        deliveredCount: c._count.sessions,
      };
    })
    .sort((a, b) => {
      // Least recently delivered by me first; never-delivered leads.
      const at = a.lastDeliveredAt?.getTime() ?? 0;
      const bt = b.lastDeliveredAt?.getTime() ?? 0;
      if (at !== bt) return at - bt;
      return a.title.localeCompare(b.title);
    });
}

/** Distinct industries, for the filter dropdown. */
export async function knownIndustries(): Promise<string[]> {
  const rows = await db.case.findMany({
    where: { industry: { not: null } },
    select: { industry: true },
    distinct: ["industry"],
    orderBy: { industry: "asc" },
    take: 100,
  });
  return rows.map((r) => r.industry!).filter(Boolean);
}

/** Distinct firms already in use, for the filter dropdown. */
export async function knownFirms(): Promise<string[]> {
  const rows = await db.case.findMany({
    where: { firm: { not: null } },
    select: { firm: true },
    distinct: ["firm"],
    orderBy: { firm: "asc" },
    take: 100,
  });
  return rows.map((r) => r.firm!).filter(Boolean);
}
