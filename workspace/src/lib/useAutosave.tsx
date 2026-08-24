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

/**
 * Autosave for a set of independent fields that share one debounce.
 *
 * `useAutosave` keeps a single pending value, which is right for one textarea
 * and wrong for six. Sharing one instance across the takeaway boxes meant
 * scheduling a save for box two discarded the unsent edit to box one, and a
 * later refresh reset those boxes to whatever the server still had — reading,
 * fairly, as "saving a note wiped my takeaways". Pending edits are keyed here,
 * so every field is sent.
 */
export function useKeyedAutosave<T>(
  save: (value: T) => Promise<unknown>,
  { delay = 500 }: { delay?: number } = {},
) {
  const [state, setState] = useState<SaveState>("idle");
  const pending = useRef(new Map<string, T>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (pending.current.size === 0) return;
    const batch = [...pending.current.entries()];
    pending.current.clear();
    setState("saving");
    try {
      await Promise.all(batch.map(([, value]) => saveRef.current(value)));
      setState(pending.current.size > 0 ? "saving" : "saved");
    } catch {
      // Put them back so the next attempt carries them rather than losing them.
      for (const [key, value] of batch) {
        if (!pending.current.has(key)) pending.current.set(key, value);
      }
      setState("offline");
    }
  }, []);

  const schedule = useCallback(
    (key: string, value: T) => {
      pending.current.set(key, value);
      setState((s) => (s === "offline" ? "offline" : "saving"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  /** True when nothing is waiting to be sent — safe to accept server state. */
  const isSettled = useCallback(() => pending.current.size === 0, []);

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { state, schedule, flush, isSettled };
}
