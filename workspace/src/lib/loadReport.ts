import { db } from "@/lib/db";
import { dimensionLabel } from "@/lib/constants";
import type { ReportModel } from "@/lib/report";

/**
 * Assembles the candidate-facing report (§8).
 *
 * This is the only place session data crosses into something a non-coach sees,
 * so the exclusions live here and nowhere else: solution and interviewer-guide
 * sections are dropped, and `CoachCase.personalNotes` and `Case.caseQuality`
 * are never queried at all.
 */
export async function loadReportModel(
  where: { id: string } | { shareToken: string },
): Promise<ReportModel | null> {
  const session = await db.session.findUnique({
    where: where as { id: string },
    include: {
      candidate: { select: { name: true } },
      coach: { select: { name: true } },
      case: {
        select: {
          title: true,
          casebook: { select: { title: true, year: true, school: true } },
          sections: { orderBy: { order: "asc" } },
        },
      },
      scores: true,
      takeaways: { orderBy: { rank: "asc" } },
      sectionNotes: true,
    },
  });
  if (!session) return null;

  const notes = new Map(session.sectionNotes.map((n) => [n.sectionId, n]));
  const visible = session.case.sections.filter(
    (s) => s.kind !== "SOLUTION" && s.kind !== "INTERVIEWER_GUIDE" && !s.isSolution,
  );

  const source = session.case.casebook
    ? [session.case.casebook.school, session.case.casebook.title, session.case.casebook.year]
        .filter(Boolean)
        .join(" ")
    : null;

  const order = ["STRUCTURE", "QUANTITATIVE", "JUDGMENT", "SYNTHESIS", "PRESENCE"];

  return {
    candidateName: session.candidate.name,
    caseTitle: session.case.title,
    source: session.hideSource ? null : source,
    coachName: session.coach.name,
    date: session.startedAt,
    totalSeconds: session.totalSeconds,
    revisedAt: session.reopenedAt,
    scores: [...session.scores]
      .sort((a, b) => order.indexOf(a.dimension) - order.indexOf(b.dimension))
      .map((s) => ({
        dimension: s.dimension,
        label: dimensionLabel(s.dimension),
        value: s.value,
      })),
    continueItems: session.takeaways
      .filter((t) => t.kind === "CONTINUE")
      .sort((a, b) => a.rank - b.rank)
      .map((t) => t.text),
    improveItems: session.takeaways
      .filter((t) => t.kind === "IMPROVE")
      .sort((a, b) => a.rank - b.rank)
      .map((t) => t.text),
    overallNote: session.overallNote,
    sections: visible.map((s) => ({
      label: s.label,
      kind: s.kind,
      feedback: stripStars(notes.get(s.id)?.feedback ?? ""),
      whatWasSaid: notes.get(s.id)?.whatWasSaid ?? "",
      secondsSpent: notes.get(s.id)?.secondsSpent ?? 0,
    })),
    includeRecord: session.includeRecord,
  };
}

/** The leading "*" is a coach's own flag, not something a candidate should read. */
function stripStars(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^(\s*(?:\[\d{1,2}:\d{2}\]\s*)?)\*+\s*/, "$1"))
    .join("\n");
}
