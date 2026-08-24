import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { candidateScope } from "@/lib/candidateAccess";
import { shortDate } from "@/lib/format";
import { StartSessionForm } from "./StartSessionForm";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const user = await requireUser();
  const { caseId } = await searchParams;
  if (!caseId) notFound();

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
    where: { caseId, archived: false },
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
