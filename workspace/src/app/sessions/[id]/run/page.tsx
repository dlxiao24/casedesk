import { notFound, redirect } from "next/navigation";
import type { Section } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSessionAccess } from "@/lib/viewer";
import { signedFileUrl } from "@/actions/casebooks";
import { Runner } from "./Runner";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireSessionAccess(id);

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
  const kase = session.case;

  /**
   * A section with neither pages nor typed text would render an empty pane. That
   * happens whenever a case was created from a page range but never split, so
   * fall back to the whole case's range — the coach wants to see the casebook,
   * not a blank column.
   */
  function withFallbackPages(s: Section) {
    const hasOwn = s.startPage !== null || Boolean(s.bodyText?.trim());
    return {
      startPage: hasOwn ? s.startPage : kase.startPage,
      endPage: hasOwn ? s.endPage : (kase.endPage ?? kase.startPage),
    };
  }

  function shape(s: Section) {
    const pages = withFallbackPages(s);
    return {
      id: s.id,
      kind: s.kind,
      label: s.label,
      startPage: pages.startPage,
      endPage: pages.endPage,
      bodyText: s.bodyText,
      isSolution: s.isSolution,
      targetMins: s.targetMins,
      whatWasSaid: notesBySection.get(s.id)?.whatWasSaid ?? "",
      feedback: notesBySection.get(s.id)?.feedback ?? "",
      secondsSpent: notesBySection.get(s.id)?.secondsSpent ?? 0,
    };
  }

  // A companion section rides along with its partner instead of taking its own
  // slot in the sequence.
  const companions = new Map<string, ReturnType<typeof shape>[]>();
  for (const s of kase.sections) {
    if (!s.pairedWithId) continue;
    const list = companions.get(s.pairedWithId) ?? [];
    list.push(shape(s));
    companions.set(s.pairedWithId, list);
  }

  const sequence = kase.sections
    .filter((s) => !s.pairedWithId)
    .map((s) => ({ ...shape(s), companions: companions.get(s.id) ?? [] }));

  return (
    <Runner
      sessionId={session.id}
      caseId={kase.id}
      caseTitle={kase.title}
      candidateName={session.candidate.name}
      startedAt={session.startedAt.toISOString()}
      resumedSeconds={session.totalSeconds ?? 0}
      fileUrl={fileUrl}
      casePages={
        kase.startPage ? { start: kase.startPage, end: kase.endPage ?? kase.startPage } : null
      }
      sections={sequence}
      canEditCase={viewer.kind === "user"}
    />
  );
}
