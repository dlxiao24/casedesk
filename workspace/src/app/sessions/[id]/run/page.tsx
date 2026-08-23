import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { signedFileUrl } from "@/actions/casebooks";
import { Runner } from "./Runner";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const session = await db.session.findUnique({
    where: { id },
    include: {
      candidate: { select: { name: true } },
      sectionNotes: true,
      case: {
        include: {
          casebook: { select: { fileKey: true, sourceKind: true, imageKeys: true } },
          sections: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!session) notFound();
  if (session.locked) redirect(`/sessions/${id}/report`);

  const fileUrl = session.case.casebook?.fileKey
    ? await signedFileUrl(session.case.casebook.fileKey)
    : null;

  const notesBySection = new Map(session.sectionNotes.map((n) => [n.sectionId, n]));

  return (
    <Runner
      sessionId={session.id}
      caseId={session.case.id}
      caseTitle={session.case.title}
      candidateName={session.candidate.name}
      startedAt={session.startedAt.toISOString()}
      resumedSeconds={session.totalSeconds ?? 0}
      fileUrl={fileUrl}
      sections={session.case.sections.map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label,
        startPage: s.startPage,
        endPage: s.endPage,
        bodyText: s.bodyText,
        isSolution: s.isSolution,
        targetMins: s.targetMins,
        whatWasSaid: notesBySection.get(s.id)?.whatWasSaid ?? "",
        feedback: notesBySection.get(s.id)?.feedback ?? "",
        secondsSpent: notesBySection.get(s.id)?.secondsSpent ?? 0,
      }))}
    />
  );
}
