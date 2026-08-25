import type { Prisma, ReadinessState } from "@prisma/client";
import { db } from "@/lib/db";
import { CASE_ATTRIBUTES, type CaseAttributeKey } from "@/lib/constants";
import { GUEST_CASE_LIMIT } from "@/lib/guest";

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
    include: { ...LIBRARY_INCLUDE, coachCases: { where: { userId }, take: 1 } },
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

/** What every library row needs, coach or guest. */
const LIBRARY_INCLUDE = {
  casebook: { select: { id: true, title: true, school: true, year: true } },
  owner: { select: { id: true, name: true } },
  _count: { select: { sessions: true, sections: true } },
} satisfies Prisma.CaseInclude;

/**
 * The shop window a signed-out visitor sees: the first few cases by title, and
 * an honest count of the rest.
 *
 * Alphabetical because a guest has no history to sort by — and fixed, with no
 * filters offered, because filtering is enumeration. A guest who could search
 * would see five cases at a time until they had seen them all, which is not a
 * sample of the library but a slow copy of it.
 */
export async function guestLibrary() {
  const [cases, total] = await Promise.all([
    db.case.findMany({
      where: GUEST_VISIBLE,
      include: LIBRARY_INCLUDE,
      orderBy: { title: "asc" },
      take: GUEST_CASE_LIMIT,
    }),
    db.case.count({ where: { archived: false } }),
  ]);

  return {
    rows: cases.map((c) => ({
      ...c,
      readiness: "UNREAD" as ReadinessState,
      // Widened so a coach's row, which carries real values here, is still
      // assignable to this shape when both feed the same table.
      lastDeliveredAt: null as Date | null,
      personalNotes: null as string | null,
      deliveredCount: c._count.sessions,
    })),
    lockedCount: Math.max(0, total - cases.length),
    total,
  };
}

/**
 * Sectioned cases only.
 *
 * Running an unsectioned case creates a "Whole case" section as a side effect,
 * which is a write to the shared library — fine when a coach does it, not
 * something a passing visitor should be able to cause. Offering only cases
 * that are already split avoids the question, and an unsectioned case makes a
 * poor demonstration anyway.
 */
const GUEST_VISIBLE = { archived: false, sections: { some: {} } } satisfies Prisma.CaseWhereInput;

/**
 * The casebook files behind the guest-visible cases.
 *
 * A signed storage URL is minted from a key the caller supplies, so for a
 * guest the key has to be checked against the shelf rather than taken at its
 * word — otherwise the sample library would be a key-guessing game for the
 * whole bucket.
 */
export async function guestReadableFileKeys(): Promise<string[]> {
  const cases = await db.case.findMany({
    where: GUEST_VISIBLE,
    orderBy: { title: "asc" },
    take: GUEST_CASE_LIMIT,
    select: { casebook: { select: { fileKey: true, imageKeys: true } } },
  });
  return cases.flatMap((c) =>
    c.casebook ? [c.casebook.fileKey, ...c.casebook.imageKeys] : [],
  );
}

/** Ids of the cases a guest is allowed to open. */
export async function guestVisibleCaseIds(): Promise<string[]> {
  const cases = await db.case.findMany({
    where: GUEST_VISIBLE,
    orderBy: { title: "asc" },
    take: GUEST_CASE_LIMIT,
    select: { id: true },
  });
  return cases.map((c) => c.id);
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
