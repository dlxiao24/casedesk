import { db } from "@/lib/db";
import { CASE_ATTRIBUTES } from "@/lib/constants";

/** Everything a coach can rate: the six attributes plus the verdict. */
export const RATED_KEYS = [...CASE_ATTRIBUTES.map((a) => a.key), "caseQuality"] as const;

export type RatedKey = (typeof RATED_KEYS)[number];
export type RatingValues = Partial<Record<RatedKey, number | null>>;

/** 1-5, whole numbers, or nothing. Anything else is not an opinion. */
export function cleanRating(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
}

/**
 * Rewrite a case's cached averages from its ratings.
 *
 * Each attribute averages over the coaches who answered *that* attribute, not
 * over everyone who rated the case at all — leaving ambiguity blank should not
 * drag its average down, and rating one thing should not commit you to seven.
 *
 * Rounded to two places because the mean of 4 and 3 and 3 is otherwise
 * 3.3333333333333335, and nothing good comes of storing that.
 */
export async function recomputeCaseAverages(caseId: string) {
  const ratings = await db.caseRating.findMany({ where: { caseId } });

  const averages: Record<string, number | null> = {};
  for (const key of RATED_KEYS) {
    const given = ratings
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    averages[key] = given.length
      ? Math.round((given.reduce((sum, v) => sum + v, 0) / given.length) * 100) / 100
      : null;
  }

  await db.case.update({
    where: { id: caseId },
    data: { ...averages, ratingCount: ratings.length },
  });
}

/** True when a rating row has no opinion left in it — nothing to keep. */
export function isEmptyRating(rating: Record<string, unknown>) {
  return RATED_KEYS.every((key) => rating[key] === null || rating[key] === undefined);
}
