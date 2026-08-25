import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSessionAccess } from "@/lib/viewer";
import { loadReportModel } from "@/lib/loadReport";
import { reportToMarkdown } from "@/lib/report";
import { Report } from "@/components/Report";
import { ReportToolbar } from "./ReportToolbar";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ options?: string }>;
}) {
  const { id } = await params;
  const { options } = await searchParams;
  const viewer = await requireSessionAccess(id);

  const [model, session] = await Promise.all([
    loadReportModel({ id }),
    db.session.findUnique({
      where: { id },
      select: {
        id: true,
        locked: true,
        includeScores: true,
        includeTakeaways: true,
        includeOverall: true,
        includeFeedback: true,
        includeWhatWasSaid: true,
        hideSource: true,
        shareToken: true,
        reopenedAt: true,
        candidate: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!model || !session) notFound();

  return (
    <div className="min-h-screen bg-neutral-100">
      <ReportToolbar
        sessionId={session.id}
        locked={session.locked}
        options={{
          includeScores: session.includeScores,
          includeTakeaways: session.includeTakeaways,
          includeOverall: session.includeOverall,
          includeFeedback: session.includeFeedback,
          includeWhatWasSaid: session.includeWhatWasSaid,
          hideSource: session.hideSource,
        }}
        shareToken={session.shareToken}
        isCoach={viewer.kind === "user"}
        candidateId={session.candidate.id}
        markdown={reportToMarkdown(model)}
        /* Arriving from "Generate report" opens the dialog straight away. */
        openOptionsOnLoad={options === "1"}
      />
      <div className="pb-16">
        <div className="mx-auto max-w-[46rem] bg-white shadow-sm print:shadow-none">
          <Report model={model} />
        </div>
      </div>
    </div>
  );
}
