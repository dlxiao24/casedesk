import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentViewer } from "@/lib/viewer";
import { guestVisibleCaseIds } from "@/lib/library";
import { SAMPLE_CANDIDATE_NAME } from "@/lib/guest";
import { candidateScope } from "@/lib/candidateAccess";
import { shortDate } from "@/lib/format";
import { StartSessionForm } from "./StartSessionForm";
import { StartGuestSession } from "./StartGuestSession";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const viewer = await currentViewer();
  const { caseId } = await searchParams;
  if (!caseId) notFound();
  if (viewer.kind === "guest") return <GuestStart caseId={caseId} />;
  const user = viewer.user;

  const kase = await db.case.findUnique({
    where: { id: caseId },
    include: { casebook: { select: { title: true } }, sections: { select: { id: true } } },
  });
  if (!kase) notFound();

  const candidates = await db.candidate.findMany({
    where: { archived: false, ...candidateScope(user) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, cohort: true, year: true },
    take: 500,
  });

  // Repeat-case warning (§9): who has already been given this case.
  const priorSessions = await db.session.findMany({
    where: { caseId, archived: false, guestKey: null },
    select: { candidateId: true, startedAt: true, coach: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
  });
  const seenBy = new Map<string, { when: string; coach: string }>();
  for (const s of priorSessions) {
    if (!seenBy.has(s.candidateId)) {
      seenBy.set(s.candidateId, { when: shortDate(s.startedAt), coach: s.coach.name });
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-base text-ink">Administer {kase.title}</h1>
        <p className="text-sm text-muted">
          {kase.casebook?.title ?? "Typed case"} ·{" "}
          {kase.sections.length > 0
            ? `${kase.sections.length} sections`
            : "no sections yet — you will get one page of notes"}
        </p>
      </div>

      <StartSessionForm
        caseId={kase.id}
        candidates={candidates}
        alreadySeen={Object.fromEntries(seenBy)}
      />

      <Link href={`/cases/${kase.id}`} className="btn btn-quiet">
        Back to case
      </Link>
    </div>
  );
}

/**
 * The guest's version: one case, one candidate, one button. No repeat-case
 * warning either — it reads from other coaches' sessions, and who has already
 * been given a case is not a visitor's business.
 */
async function GuestStart({ caseId }: { caseId: string }) {
  const open = await guestVisibleCaseIds();
  if (!open.includes(caseId)) redirect("/signup");

  const kase = await db.case.findUnique({
    where: { id: caseId },
    include: { casebook: { select: { title: true } }, sections: { select: { id: true } } },
  });
  if (!kase) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-base text-ink">Administer {kase.title}</h1>
        <p className="text-sm text-muted">
          {kase.casebook?.title ?? "Typed case"} · {kase.sections.length} sections
        </p>
      </div>

      <p className="rounded border border-rule bg-panel px-3 py-2 text-sm text-muted">
        As a guest you case {SAMPLE_CANDIDATE_NAME}, a stand-in nobody else can see. Everything
        else works as it does for a coach: the timer runs, notes save as you type, and you end with
        a report. Sign up to case real people and keep a record of them.
      </p>

      <StartGuestSession caseId={kase.id} />

      <Link href={`/cases/${kase.id}`} className="btn btn-quiet">
        Back to case
      </Link>
    </div>
  );
}
