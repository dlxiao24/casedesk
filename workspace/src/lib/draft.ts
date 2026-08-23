import type { Dimension, Phrase, TakeawayKind } from "@prisma/client";
import { bandForScore } from "@/lib/constants";

export type DraftInput = {
  scores: { dimension: Dimension; value: number }[];
  phrases: Phrase[];
  /** Feedback notes the coach starred with a leading "*" during the session. */
  starred: string[];
};

export type DraftResult = Record<TakeawayKind, string[]>;

/**
 * Non-AI draft generation (§7.1).
 *
 * Starred session notes come first — the coach already decided those matter.
 * Phrase-bank suggestions fill the remaining slots, ordered by how extreme the
 * score is: worst dimensions drive IMPROVE, best drive CONTINUE.
 */
export function draftTakeaways({ scores, phrases, starred }: DraftInput): DraftResult {
  const improve = pick("IMPROVE", [...scores].sort((a, b) => a.value - b.value));
  const carryOn = pick("CONTINUE", [...scores].sort((a, b) => b.value - a.value));

  // Starred notes are candidate takeaways and outrank the phrase bank. They are
  // ambiguous as to kind, so they lead the "work on" column, which is where a
  // coach's mid-session flag almost always belongs.
  const starredClean = starred.map((s) => s.replace(/^\s*\*\s*/, "").trim()).filter(Boolean);

  return {
    IMPROVE: [...starredClean, ...improve].slice(0, 3),
    CONTINUE: carryOn.slice(0, 3),
  };

  function pick(kind: TakeawayKind, ordered: { dimension: Dimension; value: number }[]) {
    const out: string[] = [];
    const used = new Set<string>();
    for (const score of ordered) {
      const band = bandForScore(score.value);
      // Every band carries phrases for both columns: even a weak dimension has
      // something worth keeping, and a strong one has a next level.
      const match = phrases.find(
        (p) =>
          p.active &&
          p.kind === kind &&
          p.dimension === score.dimension &&
          p.band === band &&
          !used.has(p.id),
      );
      if (match) {
        used.add(match.id);
        out.push(match.text);
      }
      if (out.length === 3) break;
    }
    return out;
  }
}

/**
 * Feedback notes the coach flagged with a leading "*" (§7.1). Tolerates a
 * timestamp stamp on either side of the star, since Cmd+Enter stamps the line
 * start and coaches star before or after.
 */
export function extractStarred(feedback: string): string[] {
  const stamp = /^\[\d{1,2}:\d{2}\]\s*/;
  return feedback
    .split("\n")
    .map((line) => line.trim().replace(stamp, "").trim())
    .filter((line) => line.startsWith("*"))
    .map((line) => line.replace(/^\*+\s*/, "").replace(stamp, "").trim())
    .filter(Boolean);
}
