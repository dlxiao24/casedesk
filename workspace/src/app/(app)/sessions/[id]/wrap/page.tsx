import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSessionAccess } from "@/lib/viewer";
import { RATED_KEYS, type RatingValues } from "@/lib/caseRatings";
import { clock } from "@/lib/format";
import { WrapUp } from "./WrapUp";
import { GenerateReport } from "./GenerateReport";

export const dynamic = "force-dynamic";

export default async function WrapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireSessionAccess(id);

  const session = await db.session.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, name: true } },
      case: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          caseQuality: true,
          ratingCount: true,
          owner: { select: { name: true } },
        },
      },
      scores: true,
      takeaways: { orderBy: { rank: "asc" } },
    },
  });
  if (!session) notFound();

  // A guest rates nothing and keeps no notes, so neither is looked up.
  const rating =
    viewer.kind === "user"
      ? await db.caseRating.findUnique({
          where: { userId_caseId: { userId: viewer.user.id, caseId: session.caseId } },
        })
      : null;
  const myRating: RatingValues = rating
    ? Object.fromEntries(RATED_KEYS.map((key) => [key, rating[key]]))
    : {};

  // A guest has no personal notes on a case, and never will.
  const mine =
    viewer.kind === "user"
      ? await db.coachCase.findUnique({
          where: { userId_caseId: { userId: viewer.user.id, caseId: session.caseId } },
          select: { personalNotes: true },
        })
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-base text-ink">Wrap up</h1>
          <p className="text-sm text-muted">
            {session.candidate.name} · {session.case.title} ·{" "}
            <span className="tabular">{clock(session.totalSeconds ?? 0)}</span>
          </p>
        </div>
        <GenerateReport
          sessionId={session.id}
          options={{
            includeScores: session.includeScores,
            includeTakeaways: session.includeTakeaways,
            includeOverall: session.includeOverall,
            includeFeedback: session.includeFeedback,
            includeWhatWasSaid: session.includeWhatWasSaid,
            hideSource: session.hideSource,
          }}
        />
      </div>

      <WrapUp
        sessionId={session.id}
        caseId={session.caseId}
        locked={session.locked}
        myRating={myRating}
        ratingCount={session.case.ratingCount}
        caseQuality={session.case.caseQuality}
        existingPersonalNotes={mine?.personalNotes ?? ""}
        canKeepNotes={viewer.kind === "user"}
        scores={Object.fromEntries(session.scores.map((s) => [s.dimension, s.value]))}
        takeaways={session.takeaways.map((t) => ({ kind: t.kind, rank: t.rank, text: t.text }))}
        overallNote={session.overallNote ?? ""}
      />
    </div>
  );
}
