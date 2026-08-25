import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { currentViewer } from "@/lib/viewer";
import { ago } from "@/lib/format";
import { NavLink } from "@/components/NavLink";

export const dynamic = "force-dynamic";

/**
 * The shell around the signed-in app — and around the guest view of the
 * library, which is the one page inside it a signed-out visitor may reach.
 * Every other page in this group calls `requireUser` for itself, so the
 * layout can afford to be generous.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await currentViewer();
  const isGuest = viewer.kind === "guest";

  // §6.4 — an in-progress session survives a closed tab. A guest's belongs to
  // their cookie rather than to an account, but it survives the same way.
  const open =
    viewer.kind === "user"
      ? await db.session.findFirst({
          where: { coachId: viewer.user.id, status: "IN_PROGRESS", archived: false },
          orderBy: { startedAt: "desc" },
          include: { candidate: true, case: { select: { title: true } } },
        })
      : viewer.guestKey
        ? await db.session.findFirst({
            where: { guestKey: viewer.guestKey, status: "IN_PROGRESS", archived: false },
            orderBy: { startedAt: "desc" },
            include: { candidate: true, case: { select: { title: true } } },
          })
        : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
          {/* The landing page, not the library — it is the site's home, and it
              is where the wordmark belongs. Library has its own nav link. */}
          <Link href="/" className="mr-4 shrink-0" aria-label="casedesk — home">
            {/* The horizontal lockup, so the wordmark stays legible in a bar
                this short. `priority` because it is above the fold on every
                page and a flash of missing logo reads as a broken app. */}
            <Image
              src="/logo-wide.png"
              alt="Case Desk"
              width={1229}
              height={284}
              priority
              className="h-7 w-auto"
            />
          </Link>
          <NavLink href="/library">Library</NavLink>
          {!isGuest && (
            <>
              <NavLink href="/casebooks">Casebooks</NavLink>
              <NavLink href="/candidates">Candidates</NavLink>
              <NavLink href="/sessions">Sessions</NavLink>
            </>
          )}
          <div className="flex-1" />
          {isGuest ? (
            <div className="flex items-center gap-2">
              <span className="chip border-rule text-faint">Guest</span>
              <Link href="/login" className="btn btn-quiet py-1">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary py-1">
                Create account
              </Link>
            </div>
          ) : (
            <NavLink href="/settings">{viewer.user.name}</NavLink>
          )}
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
