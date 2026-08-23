import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clock, shortDate } from "@/lib/format";
import { SessionRowActions } from "./SessionRowActions";

export const dynamic = "force-dynamic";

/** All sessions are visible to all coaches — deliberately (§2). */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; mine?: string }>;
}) {
  const user = await requireUser();
  const { archived, mine } = await searchParams;
  const showArchived = archived === "1";
  const onlyMine = mine === "1";

  const sessions = await db.session.findMany({
    where: { archived: showArchived, ...(onlyMine ? { coachId: user.id } : {}) },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: {
      candidate: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
      coach: { select: { name: true } },
      _count: { select: { scores: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-base text-ink">Sessions</h1>
          <p className="text-sm text-muted">
            Everyone&apos;s sessions, so you can see what a candidate has already done.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={onlyMine ? "/sessions" : "/sessions?mine=1"}
            className={clsx("btn", onlyMine && "border-faint")}
          >
            {onlyMine ? "All coaches" : "Only mine"}
          </Link>
          <Link
            href={showArchived ? "/sessions" : "/sessions?archived=1"}
            className="btn btn-quiet"
          >
            {showArchived ? "Active" : "Archived"}
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded border border-rule bg-panel px-4 py-8 text-center text-sm text-muted">
          {showArchived ? "Nothing archived." : "No sessions yet. Administer a case to start one."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-rule">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-2xs uppercase tracking-wider text-faint">
                <th className="px-3 py-2 font-normal">Date</th>
                <th className="px-3 py-2 font-normal">Candidate</th>
                <th className="px-3 py-2 font-normal">Case</th>
                <th className="px-3 py-2 font-normal">Coach</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal">Time</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-rule/60 last:border-b-0 hover:bg-panel">
                  <td className="tabular px-3 py-2 text-muted">{shortDate(s.startedAt)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/candidates/${s.candidate.id}`} className="text-ink hover:text-accent">
                      {s.candidate.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/cases/${s.case.id}`} className="text-muted hover:text-accent">
                      {s.case.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{s.coach.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={clsx(
                        "chip",
                        s.status === "IN_PROGRESS" && "border-accent/40 text-accent",
                        s.status === "COMPLETE" && "border-rule text-muted",
                        s.status === "ABANDONED" && "border-rule text-faint",
                      )}
                    >
                      {s.status === "IN_PROGRESS"
                        ? "In progress"
                        : s.status === "COMPLETE"
                          ? s.locked
                            ? "Shared"
                            : "Complete"
                          : "Abandoned"}
                    </span>
                    {s._count.scores === 0 && s.status === "COMPLETE" && (
                      <span className="ml-1 text-2xs text-faint">unscored</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-faint">
                    {s.totalSeconds ? clock(s.totalSeconds) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <SessionRowActions
                      id={s.id}
                      status={s.status}
                      archived={s.archived}
                      canEdit={s.coachId === user.id || user.role === "ADMIN"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
