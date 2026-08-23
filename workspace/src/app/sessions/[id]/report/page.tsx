import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadReportModel } from "@/lib/loadReport";
import { reportToMarkdown } from "@/lib/report";
import { Report } from "@/components/Report";
import { ReportToolbar } from "./ReportToolbar";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [model, session] = await Promise.all([
    loadReportModel({ id }),
    db.session.findUnique({
      where: { id },
      select: {
        id: true,
        locked: true,
        includeRecord: true,
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
        includeRecord={session.includeRecord}
        hideSource={session.hideSource}
        shareToken={session.shareToken}
        candidateId={session.candidate.id}
        markdown={reportToMarkdown(model)}
      />
      <div className="pb-16">
        <div className="mx-auto max-w-[46rem] bg-white shadow-sm print:shadow-none">
          <Report model={model} />
        </div>
      </div>
    </div>
  );
}
