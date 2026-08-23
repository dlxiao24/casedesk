import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [caseCount, sessionCount, phraseCount] = await Promise.all([
    db.case.count({ where: { ownerId: user.id } }),
    db.session.count({ where: { coachId: user.id } }),
    db.phrase.count({ where: { active: true } }),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-base text-ink">Settings</h1>
        <p className="text-sm text-muted">
          {user.email} · {user.role === "ADMIN" ? "Admin" : "Coach"}
        </p>
      </div>

      <ProfileForm name={user.name} />

      <section className="rounded border border-rule bg-panel p-3 text-sm text-muted">
        <h2 className="text-sm text-ink">Your footprint</h2>
        <ul className="mt-2 space-y-1">
          <li>
            {caseCount} case{caseCount === 1 ? "" : "s"} you own — you set their ratings.
          </li>
          <li>
            {sessionCount} session{sessionCount === 1 ? "" : "s"} you have run.
          </li>
          <li>{phraseCount} active phrases in the bank.</li>
        </ul>
      </section>

      {isAdmin(user) && (
        <section className="space-y-2">
          <h2 className="text-sm text-ink">Admin</h2>
          <div className="flex gap-2">
            <Link href="/settings/coaches" className="btn">
              Coaches and invites
            </Link>
            <Link href="/settings/phrases" className="btn">
              Phrase bank
            </Link>
          </div>
        </section>
      )}

      <section className="rounded border border-dashed border-rule p-3">
        <h2 className="text-sm text-ink">Cost</h2>
        <p className="mt-1 text-sm text-muted">
          This app makes no paid API calls. Feedback drafting is deterministic: it reads the phrase
          bank and your starred session notes, and nothing leaves the server.
        </p>
        {!supabaseConfigured && (
          <p className="mt-2 text-2xs text-warn">
            Running without Supabase — file storage and magic-link sign-in are inactive here.
          </p>
        )}
      </section>
    </div>
  );
}
