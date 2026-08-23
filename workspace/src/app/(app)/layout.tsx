import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ago } from "@/lib/format";
import { NavLink } from "@/components/NavLink";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // §6.4 — an in-progress session survives a closed tab.
  const open = await db.session.findFirst({
    where: { coachId: user.id, status: "IN_PROGRESS", archived: false },
    orderBy: { startedAt: "desc" },
    include: { candidate: true, case: { select: { title: true } } },
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-1 px-4">
          <Link href="/library" className="mr-3 text-sm tracking-tight text-ink">
            Case&nbsp;Desk
          </Link>
          <NavLink href="/library">Library</NavLink>
          <NavLink href="/casebooks">Casebooks</NavLink>
          <NavLink href="/candidates">Candidates</NavLink>
          <NavLink href="/sessions">Sessions</NavLink>
          <div className="flex-1" />
          <NavLink href="/settings">{user.name}</NavLink>
        </div>
      </header>

      {open && (
        <div className="border-b border-rule bg-accent/10">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
            <span className="text-muted">
              Resume session with{" "}
              <span className="text-ink">{open.candidate.name}</span> — {open.case.title}, started{" "}
              {ago(open.startedAt)}.
            </span>
            <Link href={`/sessions/${open.id}/run`} className="btn btn-primary py-1">
              Resume
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
