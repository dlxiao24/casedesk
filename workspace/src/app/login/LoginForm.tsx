"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Invite-only: never create an identity for an email nobody invited.
        shouldCreateUser: true,
      },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p className="mt-6 rounded border border-rule bg-panel p-3 text-sm text-muted">
        Check {email} for a sign-in link.
      </p>
    );
  }

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
        className="field"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@university.edu"
      />
      <button className="btn btn-primary w-full justify-center" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a link"}
      </button>
      {state === "error" && <p className="text-sm text-bad">{message}</p>}
    </form>
  );
}
