import type { Dimension, SectionKind } from "@prisma/client";
import { dimensionLabel } from "@/lib/constants";
import { clock, longDate } from "@/lib/format";

/**
 * The shape the report page and the markdown copy both render from. Building it
 * once guarantees the two never drift — and guarantees, in one place, that
 * solutions, interviewer guides, personal notes and case quality never leak
 * into anything a candidate sees (§8).
 */
export type ReportModel = {
  candidateName: string;
  caseTitle: string;
  source: string | null;
  coachName: string;
  date: Date;
  totalSeconds: number | null;
  revisedAt: Date | null;
  scores: { dimension: Dimension; label: string; value: number }[];
  continueItems: string[];
  improveItems: string[];
  overallNote: string | null;
  sections: {
    label: string;
    kind: SectionKind;
    feedback: string;
    whatWasSaid: string;
    secondsSpent: number;
  }[];
  includeScores: boolean;
  includeTakeaways: boolean;
  includeOverall: boolean;
  includeFeedback: boolean;
  includeWhatWasSaid: boolean;
};

export function reportToMarkdown(m: ReportModel): string {
  const lines: string[] = [];
  lines.push(`# Case feedback — ${m.candidateName}`);
  lines.push("");
  const meta = [
    m.caseTitle,
    m.source ?? null,
    longDate(m.date),
    `Coach: ${m.coachName}`,
    m.totalSeconds ? `${Math.round(m.totalSeconds / 60)} min` : null,
  ].filter(Boolean);
  lines.push(meta.join(" · "));
  lines.push("");

  if (m.includeScores && m.scores.length) {
    lines.push("## Scores");
    lines.push("");
    for (const s of m.scores) {
      lines.push(`- **${s.label}** — ${"■".repeat(s.value)}${"□".repeat(5 - s.value)} ${s.value}/5`);
    }
    lines.push("");
  }

  if (m.includeTakeaways && m.continueItems.length) {
    lines.push("## Keep doing");
    lines.push("");
    m.continueItems.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }

  if (m.includeTakeaways && m.improveItems.length) {
    lines.push("## Work on");
    lines.push("");
    m.improveItems.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }

  if (m.includeOverall && m.overallNote?.trim()) {
    lines.push("## Overall");
    lines.push("");
    lines.push(m.overallNote.trim());
    lines.push("");
  }

  if (m.includeFeedback || m.includeWhatWasSaid) {
    const detail = m.sections.filter(
      (s) =>
        (m.includeFeedback && s.feedback.trim()) ||
        (m.includeWhatWasSaid && s.whatWasSaid.trim()) ||
        s.secondsSpent > 0,
    );
    if (detail.length) {
      lines.push("---");
      lines.push("");
      lines.push("## Section by section");
      lines.push("");
      for (const s of detail) {
        lines.push(`### ${s.label} — ${clock(s.secondsSpent)}`);
        lines.push("");
        if (m.includeFeedback && s.feedback.trim()) {
          lines.push(`**What to change:** ${s.feedback.trim()}`);
          lines.push("");
        }
        if (m.includeWhatWasSaid && s.whatWasSaid.trim()) {
          lines.push(`**What was said:** ${s.whatWasSaid.trim()}`);
          lines.push("");
        }
      }
    }
  }

  if (m.revisedAt) lines.push(`_Revised ${longDate(m.revisedAt)}._`);

  return lines.join("\n");
}


export { dimensionLabel };
