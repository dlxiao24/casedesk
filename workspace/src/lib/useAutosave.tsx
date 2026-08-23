"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "offline";

/**
 * Debounced optimistic autosave (§6.2).
 *
 * The caller owns the value; this only schedules the network write. A failure
 * degrades to "offline — changes kept locally" and retries on the next
 * keystroke or when the browser comes back online. It never throws at the user
 * and it never blocks typing.
 */
export function useAutosave<T>(
  save: (value: T) => Promise<unknown>,
  { delay = 500 }: { delay?: number } = {},
) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const inFlight = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const next = pending.current;
    if (!next) return;

    pending.current = null;
    inFlight.current = true;
    setState("saving");
    try {
      await saveRef.current(next.value);
      setState(pending.current ? "saving" : "saved");
    } catch {
      // Hold the value so the next attempt sends it rather than dropping it.
      if (!pending.current) pending.current = next;
      setState("offline");
    } finally {
      inFlight.current = false;
    }
    if (pending.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    }
  }, [delay]);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setState((s) => (s === "offline" ? "offline" : "saving"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  // Never lose unsent keystrokes to a closed tab without saying so.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { state, schedule, flush };
}

/** Small, persistent, never blocking (§6.2). */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const text =
    state === "saving"
      ? "saving…"
      : state === "saved"
        ? "saved"
        : "offline — changes kept locally";
  return (
    <span
      className={state === "offline" ? "text-2xs text-warn" : "text-2xs text-faint"}
      role="status"
      aria-live="polite"
    >
      {text}
    </span>
  );
}
