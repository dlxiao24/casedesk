"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      // Through the callback rather than straight to /auth/reset: the callback
      // trades the code for a session cookie server-side, so the reset page
      // opens already signed in and only has to ask for the new password.
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setBusy(false);

    if (error) return setError(error.message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded border border-rule bg-panel p-3 text-sm text-muted">
          If {email} has an account, a reset link is on its way. It expires within the hour.
        </p>
        <Link href="/login" className="btn btn-quiet w-full justify-center">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label className="label" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        className="field"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="btn btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Sending…" : "Email me a reset link"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
      <p className="pt-2 text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
