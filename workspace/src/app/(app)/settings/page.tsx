import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { signOut } from "@/actions/auth";
import { supabaseConfigured } from "@/lib/env";
import { FEEDBACK_TO, mailConfigured } from "@/lib/mail";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [caseCount, sessionCount, phraseCount, stuckMessages] = await Promise.all([
    db.case.count({ where: { ownerId: user.id } }),
    db.session.count({ where: { coachId: user.id } }),
    db.phrase.count({ where: { active: true } }),
    // Contact-form messages that were stored but never made it out.
    isAdmin(user) ? db.feedbackMessage.count({ where: { sentAt: null } }) : 0,
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

      {/*
        * Mail failing is silent by design for whoever wrote in — they are told
        * their message was kept, which is true, and not told the server is
        * misconfigured, which is not theirs to fix. It has to be loud
        * somewhere, though, and this is the page belonging to the person who
        * can fix it.
        */}
      {isAdmin(user) && (
        <section
          className={`rounded border p-3 ${
            mailConfigured ? "border-rule bg-panel" : "border-warn/40 bg-warn/10"
          }`}
        >
          <h2 className="text-sm text-ink">Contact form</h2>
          <p className="mt-1 text-sm text-muted">
            Messages go to <span className="text-ink">{FEEDBACK_TO}</span>.{" "}
            {mailConfigured
              ? "Outgoing mail is configured."
              : "Outgoing mail is not configured, so messages are being stored and not sent. Set SMTP_USER and SMTP_PASS on the server — a Gmail address and an app password."}
          </p>
          {stuckMessages > 0 && (
            <p className="mt-1 text-sm text-warn">
              {stuckMessages} message{stuckMessages === 1 ? "" : "s"} stored but never emailed.
              {mailConfigured
                ? " They arrived before mail worked; they are in the FeedbackMessage table."
                : " They are safe in the FeedbackMessage table."}
            </p>
          )}
        </section>
      )}

      {isAdmin(user) && (
        <section className="space-y-2">
          <h2 className="text-sm text-ink">Admin</h2>
          <div className="flex gap-2">
            <Link href="/settings/coaches" className="btn">
              Coaches
            </Link>
            <Link href="/settings/phrases" className="btn">
              Phrase bank
            </Link>
          </div>
        </section>
      )}

      <section className="flex items-center justify-between rounded border border-rule p-3">
        <div>
          <h2 className="text-sm text-ink">Signed in as {user.email}</h2>
          <p className="text-2xs text-faint">
            Signing out returns you to the library, which guests can read.
          </p>
        </div>
        {/* A server action, so the session cookie is cleared where it lives. */}
        <form action={signOut}>
          <button className="btn btn-quiet">Sign out</button>
        </form>
      </section>

      <section className="rounded border border-dashed border-rule p-3">
        <h2 className="text-sm text-ink">Cost</h2>
        <p className="mt-1 text-sm text-muted">
          This app makes no paid API calls. Feedback drafting is deterministic: it reads the phrase
          bank and your starred session notes, and nothing leaves the server.
        </p>
        {!supabaseConfigured && (
          <p className="mt-2 text-2xs text-warn">
            Running without Supabase — file storage and account sign-in are inactive here.
          </p>
        )}
      </section>
    </div>
  );
}
