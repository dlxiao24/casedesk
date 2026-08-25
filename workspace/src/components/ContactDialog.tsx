"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendFeedback } from "@/actions/feedback";

/**
 * The way in for anything the app has no other button for: a case worth
 * adding, a change worth making, or a complaint. Open to guests as well as
 * coaches — someone who has not signed up yet is exactly the person whose
 * first impression is worth hearing.
 */
export function ContactDialog({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { delivered: boolean }>(null);
  const [pending, start] = useTransition();
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the first thing they have to fill in, and let Escape out.
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setError("");
    // Keep what they typed if it never sent, so reopening does not lose it.
    if (done) {
      setBody("");
      setDone(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const result = await sendFeedback({ email, body });
      if (!result.ok) return setError(result.error);
      setDone({ delivered: result.delivered });
    });
  }

  return (
    <>
      <button className="btn btn-quiet py-1" onClick={() => setOpen(true)}>
        Contact me
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-20"
          onClick={close}
        >
          <div
            className="w-[30rem] max-w-full overflow-hidden rounded border border-rule bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Contact casedesk"
          >
            {done ? (
              <div className="px-4 py-5">
                <h2 className="text-sm text-ink">Thank you — it came through.</h2>
                <p className="mt-1 text-sm text-muted">
                  {done.delivered
                    ? "Your message is on its way to the casedesk admin, and a reply will come to the address you gave."
                    : "Your message is saved. Mail is not sending from this deployment right now, so it will be read from the database rather than an inbox."}
                </p>
                <button className="btn btn-primary mt-4 w-full justify-center" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="border-b border-rule px-4 py-3">
                  <h2 className="text-sm text-ink">Contact casedesk</h2>
                  <p className="mt-0.5 text-2xs text-faint">
                    Goes straight to whoever runs this. Leave an address and you will get a reply.
                  </p>
                </div>

                <div className="space-y-3 px-4 py-3">
                  <div>
                    <label className="label" htmlFor="contact-email">
                      Your email
                    </label>
                    <input
                      id="contact-email"
                      ref={firstField}
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
                    <label className="label" htmlFor="contact-body">
                      Message
                    </label>
                    <textarea
                      id="contact-body"
                      required
                      rows={6}
                      className="field prose-notes mt-1 leading-relaxed"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Request a case be added, ask for website changes, or provide general feedback"
                    />
                  </div>

                  {error && <p className="text-sm text-bad">{error}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-rule px-4 py-3">
                  <button type="button" className="btn btn-quiet" onClick={close}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" disabled={pending}>
                    {pending ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
