import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { candidateScope } from "@/lib/candidateAccess";
import { ago } from "@/lib/format";
import { NewCandidateInline } from "./NewCandidateInline";

export const dynamic = "force-dynamic";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const candidates = await db.candidate.findMany({
    where: { archived: showArchived, ...candidateScope(user) },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { sessions: true } },
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true, case: { select: { title: true } } },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-base text-ink">Candidates</h1>
          <p className="text-sm text-muted">
            {candidates.length} {showArchived ? "archived" : "active"}
            {user.role === "ADMIN" ? " · every coach's" : " · the ones you added"}
          </p>
        </div>
        <Link
          href={showArchived ? "/candidates" : "/candidates?archived=1"}
          className="btn btn-quiet"
        >
          {showArchived ? "Active" : "Archived"}
        </Link>
      </div>

      {!showArchived && <NewCandidateInline />}

      {candidates.length === 0 ? (
        <p className="rounded border border-rule bg-panel px-4 py-8 text-center text-sm text-muted">
          {showArchived
            ? "Nothing archived."
            : "No candidates yet. They get created as you start sessions."}
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded border border-rule">
          {candidates.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-panel">
              <Link href={`/candidates/${c.id}`} className="text-ink hover:text-accent">
                {c.name}
              </Link>
              <span className="text-2xs text-faint">
                {[c.cohort, c.year].filter(Boolean).join(" · ")}
              </span>
              <span className="flex-1" />
              <span className="tabular text-2xs text-faint">
                {c._count.sessions} session{c._count.sessions === 1 ? "" : "s"}
              </span>
              {c.sessions[0] && (
                <span className="text-2xs text-faint">
                  last: {c.sessions[0].case.title}, {ago(c.sessions[0].startedAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
