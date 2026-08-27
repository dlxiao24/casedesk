import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeCandidate } from "@/lib/candidateAccess";
import { sessionScope } from "@/lib/sessionAccess";
import { DIMENSIONS } from "@/lib/constants";
import { clock, shortDate } from "@/lib/format";
import { ScoreBar } from "@/components/ScoreBar";
import { ScoreTrend } from "./ScoreTrend";
import { CandidateMeta } from "./CandidateMeta";

export const dynamic = "force-dynamic";

/** §9 — the feature that compounds. */
export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      // Sessions you ran with them. An admin who cased your candidate keeps
      // that session to themselves, the same as any other coach — so the
      // trend below is the history you took part in, with no gaps you cannot
      // account for.
      sessions: {
        where: { archived: false, ...sessionScope(user) },
        orderBy: { startedAt: "desc" },
        include: {
          case: { select: { id: true, title: true, caseType: true } },
          coach: { select: { name: true } },
          scores: true,
        },
      },
    },
  });
  // Not found rather than forbidden: a coach has no business learning that a
  // given candidate id exists at all.
  if (!candidate || !canSeeCandidate(user, candidate)) notFound();

  const complete = [...candidate.sessions]
    .filter((s) => s.scores.length > 0)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  const trend = complete.map((s) => {
    const point: Record<string, string | number> = { date: shortDate(s.startedAt) };
    for (const d of DIMENSIONS) {
      const score = s.scores.find((x) => x.dimension === d.value);
      if (score) point[d.value] = score.value;
    }
    return point;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg text-ink">{candidate.name}</h1>
          <p className="text-sm text-muted">
            {[candidate.cohort, candidate.year, candidate.email].filter(Boolean).join(" · ") ||
              "No cohort recorded"}
          </p>
        </div>
        <CandidateMeta
          id={candidate.id}
          archived={candidate.archived}
          name={candidate.name}
          email={candidate.email ?? ""}
          cohort={candidate.cohort ?? ""}
          year={candidate.year ?? ""}
          notes={candidate.notes ?? ""}
        />
      </div>

      {trend.length >= 2 && (
        <section>
          <h2 className="text-sm text-ink">Scores over time</h2>
          <ScoreTrend data={trend} />
        </section>
      )}

      <section>
        <h2 className="text-sm text-ink">Sessions</h2>
        {candidate.sessions.length === 0 ? (
          <p className="mt-2 text-sm text-faint">No sessions yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded border border-rule">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-2xs uppercase tracking-wider text-faint">
                  <th className="px-3 py-2 font-normal">Date</th>
                  <th className="px-3 py-2 font-normal">Case</th>
                  <th className="px-3 py-2 font-normal">Coach</th>
                  {DIMENSIONS.map((d) => (
                    <th key={d.value} className="px-2 py-2 font-normal" title={d.label}>
                      {d.label.split(" ")[0].slice(0, 5)}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-normal">Time</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {candidate.sessions.map((s) => (
                  <tr key={s.id} className="border-b border-rule/60 last:border-b-0 hover:bg-panel">
                    <td className="tabular px-3 py-2 text-muted">{shortDate(s.startedAt)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/cases/${s.case.id}`} className="text-ink hover:text-accent">
                        {s.case.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted">{s.coach.name}</td>
                    {DIMENSIONS.map((d) => (
                      <td key={d.value} className="px-2 py-2">
                        <ScoreBar
                          size="xs"
                          value={s.scores.find((x) => x.dimension === d.value)?.value ?? null}
                          label={d.label}
                        />
                      </td>
                    ))}
                    <td className="tabular px-3 py-2 text-faint">
                      {s.totalSeconds ? clock(s.totalSeconds) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={
                          s.status === "IN_PROGRESS"
                            ? `/sessions/${s.id}/run`
                            : `/sessions/${s.id}/report`
                        }
                        className="btn btn-quiet py-0.5"
                      >
                        {s.status === "IN_PROGRESS" ? "Resume" : "Report"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm text-ink">Cases already administered</h2>
        <p className="mt-0.5 text-2xs text-faint">
          These surface as a warning in the case picker so nobody repeats one.
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {[...new Map(candidate.sessions.map((s) => [s.case.id, s.case])).values()].map((c) => (
            <li key={c.id}>
              <Link href={`/cases/${c.id}`} className="chip border-rule text-muted hover:text-ink">
                {c.title}
              </Link>
            </li>
          ))}
          {candidate.sessions.length === 0 && <li className="text-sm text-faint">None yet.</li>}
        </ul>
      </section>
    </div>
  );
}
