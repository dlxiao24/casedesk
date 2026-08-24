import { ScoreBar } from "@/components/ScoreBar";
import { clock, longDate } from "@/lib/format";
import type { ReportModel } from "@/lib/report";

/**
 * The feedback report (§8). The only artifact a non-coach ever sees, so it
 * should read as a document: generous margins, clear hierarchy, one or two
 * pages before the appendix.
 */
export function Report({ model }: { model: ReportModel }) {
  // A section earns a place if anything was captured against it at all.
  const showDetail = model.includeFeedback || model.includeWhatWasSaid;
  const detail = model.sections.filter(
    (s) =>
      (model.includeFeedback && s.feedback.trim()) ||
      (model.includeWhatWasSaid && s.whatWasSaid.trim()) ||
      s.secondsSpent > 0,
  );

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

      {model.includeScores && model.scores.length > 0 && (
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

      {model.includeTakeaways && model.continueItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Keep doing</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.95rem] leading-relaxed">
            {model.continueItems.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {model.includeTakeaways && model.improveItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Work on</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.95rem] leading-relaxed">
            {model.improveItems.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {model.includeOverall && model.overallNote?.trim() && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Overall</h2>
          <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed">
            {model.overallNote.trim()}
          </p>
        </section>
      )}

      {/* Everything captured live, section by section: how long it took, what
          the coach said to change, and what the candidate actually said. It
          goes last, under its own heading and after a page break, so the
          judgment is read first and the record second (§8). */}
      {showDetail && detail.length > 0 && (
        <section className="page-break-before mt-12 border-t border-neutral-300 pt-8">
          <h2 className="text-lg">Section by section</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Taken live during the case. Supporting material for the takeaways above.
          </p>
          <div className="mt-5 space-y-6">
            {detail.map((s, i) => (
              <div key={i} className="break-inside-avoid">
                <h3 className="flex items-baseline gap-2 border-b border-neutral-200 pb-1 text-sm font-semibold">
                  {s.label}
                  <span className="tabular ml-auto font-normal text-neutral-500">
                    {clock(s.secondsSpent)}
                  </span>
                </h3>
                {model.includeFeedback && s.feedback.trim() && (
                  <div className="mt-2">
                    <div className="text-xs uppercase tracking-wider text-neutral-500">
                      What to change
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[0.9rem] leading-relaxed">
                      {s.feedback.trim()}
                    </p>
                  </div>
                )}
                {model.includeWhatWasSaid && s.whatWasSaid.trim() && (
                  <div className="mt-2">
                    <div className="text-xs uppercase tracking-wider text-neutral-500">
                      What was said
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-neutral-700">
                      {s.whatWasSaid.trim()}
                    </p>
                  </div>
                )}
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
