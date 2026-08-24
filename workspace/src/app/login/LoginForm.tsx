"use client";

import { useEffect, useState } from "react";
import { canRequestSignInLink } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";

/** Supabase's own limit is per hour; this only stops accidental double-sends. */
const RESEND_COOLDOWN_SECONDS = 60;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;

    const address = email.trim().toLowerCase();

    // Ask the database first. An uninvited address is turned away here rather
    // than burning one of the project's hourly emails on someone who would be
    // refused at the door anyway.
    setState("checking");
    const allowed = await canRequestSignInLink(address);
    if (!allowed.ok) {
      setState("error");
      setMessage(allowed.error);
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Safe now: only invited addresses reach this line.
        shouldCreateUser: true,
      },
    });

    if (error) {
      setState("error");
      setMessage(describeAuthError(error.message, error.status));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return;
    }
    setState("sent");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  if (state === "sent") {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded border border-rule bg-panel p-3 text-sm text-muted">
          Check {email} for a sign-in link. It expires within the hour.
        </p>
        <button
          className="btn btn-quiet w-full justify-center"
          disabled={cooldown > 0}
          onClick={() => {
            setState("idle");
            setMessage("");
          }}
        >
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Send another link"}
        </button>
      </div>
    );
  }

  const busy = state === "checking" || state === "sending";

  return (
    <form onSubmit={send} className="mt-6 space-y-3">
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
        placeholder="you@university.edu"
      />
      <button
        className="btn btn-primary w-full justify-center"
        disabled={busy || cooldown > 0}
      >
        {state === "checking"
          ? "Checking…"
          : state === "sending"
            ? "Sending…"
            : cooldown > 0
              ? `Wait ${cooldown}s`
              : "Email me a link"}
      </button>
      {state === "error" && <p className="whitespace-pre-line text-sm text-bad">{message}</p>}
    </form>
  );
}

/**
 * Supabase's raw auth errors are terse and, for the rate limit, actively
 * misleading — nothing is wrong with the address or the account.
 */
function describeAuthError(raw: string, status?: number): string {
  const lower = raw.toLowerCase();

  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return (
      "Too many sign-in emails have gone out from this project in the last hour, so Supabase is " +
      "holding the rest back. Wait a few minutes and try again — or, if this keeps happening, " +
      "connect a custom SMTP sender in Supabase to lift the limit."
    );
  }

  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return (
      "Supabase is refusing to create the account. Turn signups back on under " +
      "Authentication → Sign In / Providers — Case Desk does its own invite check before this point."
    );
  }

  return raw;
}
