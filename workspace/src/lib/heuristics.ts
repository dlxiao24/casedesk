import type { SectionKind } from "@prisma/client";

/**
 * Free heuristic assists (§4.2, §4.3). These only ever *suggest* — nothing is
 * auto-committed, and every suggestion is one keypress away from being wrong.
 */

const CASE_START_PATTERNS = [
  /^case\s*\d+/i,
  /^\d+\.\s+[A-Z]/,
  /^case\s+\d+\s*[:.\u2014-]/i,
];

/** Does this page look like the first page of a new case? */
export function looksLikeCaseStart(pageText: string): boolean {
  const lines = pageText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;

  // A heading-shaped line near the top of the page.
  const head = lines.slice(0, 6);
  if (head.some((line) => CASE_START_PATTERNS.some((re) => re.test(line)))) return true;

  // A short title plus "prompt" / "case background" anywhere on the page.
  const lower = pageText.toLowerCase();
  const hasShortTitle = head.some((l) => l.length > 0 && l.length <= 60);
  if (hasShortTitle && (lower.includes("prompt") || lower.includes("case background"))) {
    return true;
  }
  return false;
}

/** A guessed case title from a page that looks like a case start. */
export function guessCaseTitle(pageText: string): string | null {
  const lines = pageText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);
  for (const line of lines) {
    const stripped = line.replace(/^case\s*\d+\s*[:.\u2014-]?\s*/i, "").replace(/^\d+\.\s*/, "");
    if (stripped.length >= 3 && stripped.length <= 60 && /[A-Za-z]/.test(stripped)) {
      return stripped;
    }
  }
  return null;
}

/**
 * Keyword match per page, most specific first — "interviewer guidance" must win
 * over a stray "exhibit" reference inside it.
 */
const KIND_RULES: { kind: SectionKind; patterns: RegExp[] }[] = [
  { kind: "INTERVIEWER_GUIDE", patterns: [/interviewer\s+guid(e|ance)/i, /notes\s+to\s+the\s+interviewer/i] },
  { kind: "SOLUTION", patterns: [/\bsolution\b/i, /\bsample\s+answer\b/i, /\banswer\s*:/i, /\bmodel\s+answer\b/i] },
  { kind: "EXHIBIT", patterns: [/\bexhibit\s*\d*/i, /\bappendix\s*\d*/i, /\bchart\s*\d/i] },
  { kind: "MATH", patterns: [/\bmath\b/i, /\bcalculation(s)?\b/i, /\bcompute\b/i, /\bquestion\s*\d+/i] },
  { kind: "BRAINSTORM", patterns: [/\bbrainstorm\b/i, /\bideation\b/i, /\bcreativity\b/i] },
  { kind: "STRUCTURE", patterns: [/\bsample\s+structure\b/i, /\bframework\b/i, /\bissue\s+tree\b/i] },
  { kind: "SYNTHESIS", patterns: [/\bsynthes(is|ize)\b/i, /\brecommendation\b/i, /\bconclusion\b/i] },
  { kind: "PROMPT", patterns: [/\bprompt\b/i, /\bcase\s+background\b/i, /\bclient\s+situation\b/i] },
];

export function guessSectionKind(pageText: string): SectionKind | null {
  if (!pageText.trim()) return null;
  for (const rule of KIND_RULES) {
    if (rule.patterns.some((re) => re.test(pageText))) return rule.kind;
  }
  return null;
}

/** A label for an auto-created section, e.g. "Exhibit 2 — Regional volumes". */
export function guessSectionLabel(kind: SectionKind, pageText: string): string | null {
  if (kind === "EXHIBIT") {
    const m = pageText.match(/exhibit\s*(\d+)\s*[:\u2014-]?\s*([^\n]{0,50})/i);
    if (m) {
      const caption = m[2]?.trim();
      return caption ? `Exhibit ${m[1]} — ${caption}` : `Exhibit ${m[1]}`;
    }
  }
  if (kind === "MATH") {
    const m = pageText.match(/question\s*(\d+)/i);
    if (m) return `Math — question ${m[1]}`;
  }
  return null;
}
