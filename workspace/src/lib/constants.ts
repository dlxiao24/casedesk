import type {
  Band,
  CaseFormat,
  CaseType,
  Dimension,
  ReadinessState,
  SectionKind,
  TargetRound,
} from "@prisma/client";

export const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: "PROFITABILITY", label: "Profitability" },
  { value: "MARKET_ENTRY", label: "Market entry" },
  { value: "MA", label: "M&A" },
  { value: "GROWTH", label: "Growth" },
  { value: "PRICING", label: "Pricing" },
  { value: "COST_REDUCTION", label: "Cost reduction" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "MARKET_SIZING", label: "Market sizing" },
  { value: "NEW_PRODUCT", label: "New product" },
  { value: "OTHER", label: "Other" },
];

export const TARGET_ROUNDS: { value: TargetRound; label: string }[] = [
  { value: "SCREENING", label: "Screening" },
  { value: "FIRST_ROUND", label: "First round" },
  { value: "FINAL_ROUND", label: "Final round" },
];

export const CASE_FORMATS: { value: CaseFormat; label: string }[] = [
  { value: "INTERVIEWER_LED", label: "Interviewer-led" },
  { value: "INTERVIEWEE_LED", label: "Interviewee-led" },
];

export const READINESS: { value: ReadinessState; label: string }[] = [
  { value: "UNREAD", label: "Unread" },
  { value: "READ", label: "Read" },
  { value: "PRACTICED", label: "Practiced" },
  { value: "DELIVERED", label: "Delivered" },
];

/** The 1-5 attributes of a case. Owner-only (§14). */
export const CASE_ATTRIBUTES = [
  { key: "quantIntensity", label: "Quant intensity" },
  { key: "creativityLoad", label: "Creativity load" },
  { key: "structureDifficulty", label: "Structure difficulty" },
  { key: "ambiguity", label: "Ambiguity" },
  { key: "dataDensity", label: "Data density" },
  { key: "overallDifficulty", label: "Overall difficulty" },
] as const;

export type CaseAttributeKey = (typeof CASE_ATTRIBUTES)[number]["key"];

/**
 * Section kinds. `hotkey` is the number pressed in the sectioning grid (§4.3);
 * kinds without one are reachable from the menu.
 */
export const SECTION_KINDS: {
  value: SectionKind;
  label: string;
  hotkey?: string;
  /** Tailwind class for the colored spine. */
  spine: string;
  chip: string;
  hidden?: boolean;
}[] = [
  { value: "PROMPT", label: "Prompt", hotkey: "1", spine: "bg-sky-500", chip: "text-sky-300 border-sky-900" },
  { value: "EXHIBIT_PROMPT", label: "Prompt for exhibit", hotkey: "2", spine: "bg-violet-300", chip: "text-violet-200 border-violet-900" },
  { value: "EXHIBIT", label: "Exhibit (show to interviewee)", hotkey: "3", spine: "bg-violet-500", chip: "text-violet-300 border-violet-900" },
  { value: "MATH", label: "Math", hotkey: "4", spine: "bg-amber-500", chip: "text-amber-300 border-amber-900" },
  { value: "BRAINSTORM", label: "Brainstorm", hotkey: "5", spine: "bg-teal-500", chip: "text-teal-300 border-teal-900" },
  { value: "SYNTHESIS", label: "Synthesis/Recommendation", hotkey: "6", spine: "bg-emerald-500", chip: "text-emerald-300 border-emerald-900" },
  { value: "INTERVIEWER_GUIDE", label: "Interviewer solution", hotkey: "7", spine: "bg-rose-700", chip: "text-rose-300 border-rose-900", hidden: true },
  { value: "CLARIFYING", label: "Clarifying", spine: "bg-slate-500", chip: "text-slate-300 border-slate-700" },
  { value: "STRUCTURE", label: "Structure", spine: "bg-indigo-500", chip: "text-indigo-300 border-indigo-900" },
];

/**
 * Kinds that lead a step. Anything the coach marks after one of these — an
 * interviewee exhibit, an interviewer solution — attaches to it rather than
 * claiming a step of its own (§ sectioning).
 */
export const LEADING_KINDS: SectionKind[] = [
  "PROMPT",
  "EXHIBIT_PROMPT",
  "EXHIBIT",
  "MATH",
  "BRAINSTORM",
  "SYNTHESIS",
];

/**
 * Kinds that attach to whatever leading section came before them.
 *
 * Interviewee exhibits are deliberately NOT here: plenty of them stand on their
 * own as a step the candidate is walked through, and guessing wrong costs more
 * than the occasional drag to attach one.
 */
export const ATTACHING_KINDS: SectionKind[] = ["INTERVIEWER_GUIDE"];

/**
 * Kinds where consecutive pages stay separate steps instead of merging.
 * Exhibit 4 and Exhibit 5 usually sit back to back and are two things, not one.
 */
export const NON_MERGING_KINDS: SectionKind[] = ["EXHIBIT"];

/** Only interviewee exhibits are safe to put on a shared screen. */
export function isCandidateSafeKind(kind: SectionKind) {
  return kind === "EXHIBIT";
}

export function sectionKindMeta(kind: SectionKind) {
  return SECTION_KINDS.find((k) => k.value === kind) ?? SECTION_KINDS[0];
}

/**
 * Kinds the candidate must never see. They still open unblurred in the runner —
 * the coach is the only person looking at that screen, and blurring the answer
 * key mid-case cost a keystroke for no protection. What actually keeps these
 * away from a candidate is the exhibit view, which filters on
 * `isCandidateSafeKind`, and the report, which drops them outright.
 */
export function isHiddenKind(kind: SectionKind) {
  return kind === "INTERVIEWER_GUIDE";
}

/**
 * The rubric (§7). Anchors are shown on hover so scoring is consistent across
 * coaches — the wording is the shared standard, not decoration.
 */
export const DIMENSIONS: {
  value: Dimension;
  label: string;
  anchor: string;
}[] = [
  {
    value: "STRUCTURE",
    label: "Structure",
    anchor: "Issue tree quality, MECE-ness, prioritization, hypothesis-driven.",
  },
  {
    value: "QUANTITATIVE",
    label: "Quantitative",
    anchor: "Setup, arithmetic accuracy, unit discipline, sanity-checking, interpreting the answer.",
  },
  {
    value: "JUDGMENT",
    label: "Business judgment",
    anchor: "Insight quality, creativity and idea breadth, awareness of real-world constraints.",
  },
  {
    value: "SYNTHESIS",
    label: "Synthesis & communication",
    anchor: "Top-down, signposting, concise recommendation with support and risks.",
  },
  {
    value: "PRESENCE",
    label: "Presence",
    anchor: "Poise under pushback, listening, pace, energy.",
  },
];

export const BANDS: { value: Band; label: string; range: string }[] = [
  { value: "LOW", label: "Low", range: "1–2" },
  { value: "MID", label: "Mid", range: "3" },
  { value: "HIGH", label: "High", range: "4–5" },
];

export function bandForScore(value: number): Band {
  if (value <= 2) return "LOW";
  if (value === 3) return "MID";
  return "HIGH";
}

export function dimensionLabel(d: Dimension) {
  return DIMENSIONS.find((x) => x.value === d)?.label ?? d;
}

/**
 * Kinds that make sense as a companion pinned to another section (§ runner):
 * the prompt that belongs with an exhibit, the sample framework that belongs
 * with a prompt, the interviewer guidance for a given step.
 */
export const PAIRABLE_KINDS: SectionKind[] = [
  "EXHIBIT_PROMPT",
  "PROMPT",
  "STRUCTURE",
  "INTERVIEWER_GUIDE",
  "MATH",
];

export function isPairableKind(kind: SectionKind) {
  return PAIRABLE_KINDS.includes(kind);
}

/**
 * Suggestions for "which firm's case is this?". Deliberately a datalist rather
 * than an enum — firms rebrand and merge, and a club will want entries for its
 * own alumni-written cases that no fixed list could anticipate.
 */
export const FIRM_SUGGESTIONS = [
  "McKinsey & Company",
  "Boston Consulting Group",
  "Bain & Company",
  "Deloitte",
  "EY-Parthenon",
  "Strategy& (PwC)",
  "KPMG",
  "Accenture",
  "Kearney",
  "Oliver Wyman",
  "L.E.K. Consulting",
  "Roland Berger",
  "Booz Allen Hamilton",
  "Alvarez & Marsal",
  "AlixPartners",
  "ZS Associates",
  "Simon-Kucher",
  "Analysis Group",
  "Cornerstone Research",
  "Charles River Associates",
  "Putnam Associates",
  "Clearview Healthcare Partners",
  "Health Advances",
  "Guidehouse",
  "Huron Consulting",
  "Capgemini Invent",
  "IBM Consulting",
  "Bridgespan",
  "Dalberg",
] as const;
