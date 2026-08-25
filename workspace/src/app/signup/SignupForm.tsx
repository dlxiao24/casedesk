"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Long enough to be worth having; short enough that nobody writes it down. */
const MIN_PASSWORD = 8;

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirm) return setError("The two passwords do not match.");

    const supabase = createClient();
    if (!supabase) return;
    const address = email.trim().toLowerCase();

    setBusy(true);
    setError("");
    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: {
        // Read back in `signedInIdentity` when the User row is created, so the
        // club sees a person's name rather than the front of their address.
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);

    if (error) return setError(error.message);

    // Supabase does not admit that an address is already taken — it returns a
    // user with no identities instead, to keep the form from being used as a
    // membership test. Say the useful thing without confirming anything: the
    // advice is the same either way.
    if (data.user && data.user.identities?.length === 0) {
      return setError(
        "If that address already has an account, use Sign in — or reset the password if you have forgotten it.",
      );
    }

    if (data.session) {
      router.refresh();
      router.push("/library");
      return;
    }
    setSentTo(address);
  }

  if (sentTo) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded border border-rule bg-panel p-3 text-sm text-muted">
          Check <span className="text-ink">{sentTo}</span> for a confirmation link. Once you follow
          it you are signed in and every case is yours to read.
        </p>
        <Link href="/library" className="btn btn-quiet w-full justify-center">
          Keep looking around meanwhile
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          required
          autoFocus
          autoComplete="name"
          className="field mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Chen"
        />
        <p className="mt-1 text-2xs text-faint">
          Shown on the sessions you run and the cases you rate.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="field mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
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
        {busy ? "Creating…" : "Create account"}
      </button>

      {error && <p className="whitespace-pre-line text-sm text-bad">{error}</p>}

      <p className="pt-2 text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}
