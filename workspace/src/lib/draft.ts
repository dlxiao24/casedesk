import type { Dimension, Phrase, TakeawayKind } from "@prisma/client";
import { bandForScore } from "@/lib/constants";
import { BULLET } from "@/lib/bullets";

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
 * Anything a line can carry before its actual content: the timestamp stamp
 * Cmd+Enter writes, and the bullet "- " turns into. Both land at the line
 * start, both can appear in either order, and neither says anything about
 * whether the coach starred the line.
 */
const LINE_FURNITURE = new RegExp(`^(?:\\[\\d{1,2}:\\d{2}\\]|${BULLET})\\s*`);

function stripFurniture(line: string): string {
  let out = line.trim();
  for (;;) {
    const next = out.replace(LINE_FURNITURE, "").trim();
    if (next === out) return out;
    out = next;
  }
}

/**
 * Feedback notes the coach flagged with a leading "*" (§7.1).
 *
 * The star has to be found underneath the stamp and the bullet, in whatever
 * order they ended up: a coach types "- " to start a list, stamps the moment,
 * and stars what matters, and the pipeline that turns starred notes into
 * drafted takeaways must not quietly lose a line because a bullet got there
 * first. Stripped repeatedly for the same reason.
 */
export function extractStarred(feedback: string): string[] {
  return feedback
    .split("\n")
    .map(stripFurniture)
    .filter((line) => line.startsWith("*"))
    .map((line) => stripFurniture(line.replace(/^\*+\s*/, "")))
    .filter(Boolean);
}
