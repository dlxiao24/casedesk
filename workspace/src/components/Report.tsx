import { ScoreBar } from "@/components/ScoreBar";
import { clock, longDate } from "@/lib/format";
import type { ReportModel } from "@/lib/report";

/**
 * The feedback report (§8). The only artifact a non-coach ever sees, so it
 * should read as a document: generous margins, clear hierarchy, one or two
 * pages before the appendix.
 */
export function Report({ model }: { model: ReportModel }) {
  const withFeedback = model.sections.filter((s) => s.feedback.trim());
  const record = model.sections.filter((s) => s.whatWasSaid.trim());

  return (
    <article className="report mx-auto max-w-[46rem] px-10 py-12">
      <header className="border-b border-neutral-300 pb-4">
        <h1 className="text-2xl font-normal tracking-tight">Case feedback</h1>
        <p className="mt-1 text-lg">{model.candidateName}</p>
        <p className="mt-2 text-sm text-neutral-600">
          {[
            model.caseTitle,
            model.source,
            longDate(model.date),
            `Coach: ${model.coachName}`,
            model.totalSeconds ? `${Math.round(model.totalSeconds / 60)} minutes` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {model.scores.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Scores</h2>
          <dl className="mt-3 space-y-1.5">
            {model.scores.map((s) => (
              <div key={s.dimension} className="flex items-center gap-3">
                <dt className="w-56 text-sm">{s.label}</dt>
                <dd className="flex items-center gap-2">
                  <ScoreBar value={s.value} tone="print" label={`${s.label}: ${s.value} of 5`} />
                  <span className="tabular text-xs text-neutral-500">{s.value}/5</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {model.continueItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Keep doing</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.95rem] leading-relaxed">
            {model.continueItems.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {model.improveItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Work on</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.95rem] leading-relaxed">
            {model.improveItems.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {model.overallNote?.trim() && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Overall</h2>
          <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed">
            {model.overallNote.trim()}
          </p>
        </section>
      )}

      {withFeedback.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Section by section</h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="w-48 py-1.5 pr-3 font-normal">Section</th>
                <th className="w-16 py-1.5 pr-3 font-normal">Time</th>
                <th className="py-1.5 font-normal">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {withFeedback.map((s, i) => (
                <tr key={i} className="border-b border-neutral-200 align-top">
                  <td className="py-2 pr-3">{s.label}</td>
                  <td className="tabular py-2 pr-3 text-neutral-500">{clock(s.secondsSpent)}</td>
                  <td className="whitespace-pre-wrap py-2 leading-relaxed">{s.feedback.trim()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* The appendix goes last and under its own heading, so the judgment is
          read first and the transcript second (§8). */}
      {model.includeRecord && record.length > 0 && (
        <section className="page-break-before mt-12 border-t border-neutral-300 pt-8">
          <h2 className="text-lg">Session record</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Notes taken during the case, section by section. Supporting material for the takeaways
            above.
          </p>
          <div className="mt-5 space-y-5">
            {record.map((s, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold">
                  {s.label}
                  <span className="tabular ml-2 font-normal text-neutral-500">
                    {clock(s.secondsSpent)}
                  </span>
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-neutral-700">
                  {s.whatWasSaid.trim()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {model.revisedAt && (
        <footer className="mt-10 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
          Revised {longDate(model.revisedAt)}.
        </footer>
      )}
    </article>
  );
}
