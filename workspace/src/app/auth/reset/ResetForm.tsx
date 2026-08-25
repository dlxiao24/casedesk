"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

export function ResetForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirm) return setError("The two passwords do not match.");

    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      return setError(
        error.message.toLowerCase().includes("session")
          ? "That reset link has expired. Ask for a new one."
          : error.message,
      );
    }
    // Full load rather than router.push — see the note in LoginForm.
    window.location.assign("/library");
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label className="label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          autoFocus
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          className="field mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          Password again
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          className="field mt-1"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button className="btn btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
      <p className="pt-2 text-sm text-muted">
        <Link href="/auth/forgot" className="text-accent hover:underline">
          Send another link
        </Link>
      </p>
    </form>
  );
}
