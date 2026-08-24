import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CASE_FORMATS, CASE_TYPES, TARGET_ROUNDS } from "@/lib/constants";
import { ago, shortDate } from "@/lib/format";
import { ReadinessChip } from "../../library/LibraryTable";
import { CaseAttributes } from "./CaseAttributes";
import { PersonalNotes } from "./PersonalNotes";
import { ReadinessPicker } from "./ReadinessPicker";
import { SectionList } from "./SectionList";
import { SharedNotes } from "./SharedNotes";
import { CaseFields } from "./CaseFields";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const kase = await db.case.findUnique({
    where: { id },
    include: {
      casebook: true,
      owner: { select: { id: true, name: true } },
      sections: { orderBy: { order: "asc" } },
      sessions: {
        where: { archived: false },
        orderBy: { startedAt: "desc" },
        take: 8,
        include: {
          candidate: { select: { id: true, name: true } },
          coach: { select: { name: true } },
        },
      },
    },
  });
  if (!kase) notFound();

  const casebooks = await db.casebook.findMany({
    select: { id: true, title: true, pageCount: true },
    orderBy: { createdAt: "desc" },
  });

  // Readiness auto-advance: opening the detail view means it has been read (§5).
  const mine = await db.coachCase.upsert({
    where: { userId_caseId: { userId: user.id, caseId: id } },
    create: { userId: user.id, caseId: id, state: "READ" },
    update: {},
  });
  const state = mine.state === "UNREAD" ? "READ" : mine.state;
  if (mine.state === "UNREAD") {
    await db.coachCase.update({
      where: { userId_caseId: { userId: user.id, caseId: id } },
      data: { state: "READ" },
    });
  }

  const isOwner = kase.ownerId === user.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg text-ink">{kase.title}</h1>
          <p className="text-sm text-muted">
            {CASE_TYPES.find((t) => t.value === kase.caseType)?.label}
            {kase.industry ? ` · ${kase.industry}` : ""} ·{" "}
            {CASE_FORMATS.find((f) => f.value === kase.format)?.label}
            {kase.targetRound
              ? ` · ${TARGET_ROUNDS.find((r) => r.value === kase.targetRound)?.label}`
              : ""}
          </p>
          <p className="text-2xs text-faint">
            {kase.casebook
              ? `${kase.casebook.title}${kase.startPage ? `, pp. ${kase.startPage}–${kase.endPage}` : ""}`
              : "Typed case"}{" "}
            · added by {kase.owner.name} {ago(kase.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CaseFields
            caseId={kase.id}
            canEdit={isOwner || user.role === "ADMIN"}
            casebooks={casebooks}
            initial={{
              title: kase.title,
              caseType: kase.caseType,
              industry: kase.industry,
              format: kase.format,
              targetRound: kase.targetRound,
              casebookId: kase.casebookId,
              startPage: kase.startPage,
              endPage: kase.endPage,
            }}
          />
          <ReadinessPicker caseId={kase.id} state={state} />
          <Link href={`/sessions/new?caseId=${kase.id}`} className="btn btn-primary">
            Administer case
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <SharedNotes
            caseId={kase.id}
            notes={kase.notes ?? ""}
            canEdit={isOwner || user.role === "ADMIN"}
            ownerName={kase.owner.name}
          />

          <SectionList
            caseId={kase.id}
            canEdit={isOwner || user.role === "ADMIN"}
            hasCasebook={Boolean(kase.casebookId)}
            sections={kase.sections.map((s) => ({
              id: s.id,
              kind: s.kind,
              label: s.label,
              startPage: s.startPage,
              endPage: s.endPage,
              targetMins: s.targetMins,
              bodyText: s.bodyText,
            }))}
          />

          <section>
            <h2 className="text-sm text-ink">Recent sessions</h2>
            {kase.sessions.length === 0 ? (
              <p className="mt-2 text-sm text-faint">
                Nobody has run this case yet. You would be the first.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-rule rounded border border-rule">
                {kase.sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="tabular w-24 text-faint">{shortDate(s.startedAt)}</span>
                    <Link
                      href={`/candidates/${s.candidate.id}`}
                      className="text-ink hover:text-accent"
                    >
                      {s.candidate.name}
                    </Link>
                    <span className="text-faint">with {s.coach.name}</span>
                    <span className="flex-1" />
                    <Link
                      href={
                        s.status === "IN_PROGRESS"
                          ? `/sessions/${s.id}/run`
                          : `/sessions/${s.id}/report`
                      }
                      className="btn btn-quiet py-0.5"
                    >
                      {s.status === "IN_PROGRESS" ? "Resume" : "Report"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <CaseAttributes
            caseId={kase.id}
            isOwner={isOwner}
            ownerName={kase.owner.name}
            values={{
              quantIntensity: kase.quantIntensity,
              creativityLoad: kase.creativityLoad,
              structureDifficulty: kase.structureDifficulty,
              ambiguity: kase.ambiguity,
              dataDensity: kase.dataDensity,
              overallDifficulty: kase.overallDifficulty,
              caseQuality: kase.caseQuality,
            }}
          />
          <PersonalNotes caseId={kase.id} initial={mine.personalNotes ?? ""} />
          <div className="text-2xs text-faint">
            <ReadinessChip state={state} /> is yours alone. Other coaches see their own.
          </div>
        </div>
      </div>
    </div>
  );
}
