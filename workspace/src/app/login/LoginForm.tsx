"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    setError("");
    setUnconfirmed(false);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("not confirmed")) {
        setUnconfirmed(true);
        setError("That account has not been confirmed yet. Check your inbox for the link.");
        return;
      }
      setError(
        lower.includes("invalid login credentials")
          ? "That email and password do not match an account."
          : error.message,
      );
      return;
    }

    // The cookie is written by the browser client; refresh so the server sees
    // it on the next render rather than serving the guest view again.
    router.refresh();
    router.push("/library");
  }

  async function resend() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    setError("Sent again. Check your inbox.");
    setUnconfirmed(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          className="field mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">
            Password
          </label>
          <Link href="/auth/forgot" className="text-2xs text-faint hover:text-accent">
            Forgot it?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          className="field mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button className="btn btn-primary w-full justify-center" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>

      {error && <p className="whitespace-pre-line text-sm text-bad">{error}</p>}
      {unconfirmed && (
        <button type="button" onClick={resend} className="btn btn-quiet w-full justify-center">
          Send the confirmation email again
        </button>
      )}

      <p className="pt-2 text-sm text-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create one
        </Link>
        , or{" "}
        <Link href="/library" className="text-accent hover:underline">
          look around as a guest
        </Link>
        .
      </p>
    </form>
  );
}
