import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSessionAccess } from "@/lib/viewer";
import { signedFileUrl } from "@/actions/casebooks";
import { isCandidateSafeKind } from "@/lib/constants";
import { ExhibitView } from "./ExhibitView";

export const dynamic = "force-dynamic";

/**
 * Exhibit view: only what the candidate is allowed to see.
 *
 * Opened in its own tab so it can be screenshared or printed to PDF without
 * exposing the rest of the runner. The filter is `isCandidateSafeKind`, which
 * admits interviewee exhibits and nothing else — prompts, interviewer
 * solutions and legacy solution pages never reach this page at all, so there
 * is nothing on screen to accidentally scroll into view.
 */
export default async function ExhibitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSessionAccess(id);

  const session = await db.session.findUnique({
    where: { id },
    select: {
      case: {
        select: {
          title: true,
          casebook: { select: { fileKey: true } },
          sections: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!session) notFound();

  const exhibits = session.case.sections.filter(
    (s) => isCandidateSafeKind(s.kind) && !s.isSolution,
  );
  const fileUrl = session.case.casebook?.fileKey
    ? await signedFileUrl(session.case.casebook.fileKey)
    : null;

  return (
    <ExhibitView
      caseTitle={session.case.title}
      fileUrl={fileUrl}
      exhibits={exhibits.map((s) => ({
        id: s.id,
        label: s.label,
        startPage: s.startPage,
        endPage: s.endPage,
        bodyText: s.bodyText,
      }))}
    />
  );
}
