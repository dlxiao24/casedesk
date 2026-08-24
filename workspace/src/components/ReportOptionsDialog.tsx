"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReportOptions } from "@/actions/sessions";

export type ReportOptions = {
  includeScores: boolean;
  includeTakeaways: boolean;
  includeOverall: boolean;
  includeFeedback: boolean;
  includeWhatWasSaid: boolean;
  hideSource: boolean;
};

const SECTIONS: {
  key: keyof ReportOptions;
  label: string;
  hint: string;
  /** Stored inverted — the field says "hide", the switch says "include". */
  inverted?: boolean;
}[] = [
  { key: "includeScores", label: "Rubric scores", hint: "The five dimensions, as bars." },
  {
    key: "includeTakeaways",
    label: "Takeaways",
    hint: "Keep doing, and work on. The deliverable.",
  },
  { key: "includeOverall", label: "Overall note", hint: "Your closing paragraph." },
  {
    key: "includeFeedback",
    label: "Feedback during the case",
    hint: "What you told them to change, section by section.",
  },
  {
    key: "includeWhatWasSaid",
    label: "What was said",
    hint: "The record of the candidate's own answers.",
  },
  {
    key: "hideSource",
    label: "Casebook source",
    hint: "Which casebook and year the case came from.",
    inverted: true,
  },
];

/**
 * Asked before a report is produced, so the coach decides what the candidate
 * receives rather than discovering it afterwards. Choices persist on the
 * session, so reopening the dialog shows what was chosen last time.
 */
export function ReportOptionsDialog({
  sessionId,
  initial,
  open,
  onClose,
  onConfirm,
  confirmLabel = "Generate report",
}: {
  sessionId: string;
  initial: ReportOptions;
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => setOptions(initial), [initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const nothingLeft =
    !options.includeScores &&
    !options.includeTakeaways &&
    !options.includeOverall &&
    !options.includeFeedback &&
    !options.includeWhatWasSaid;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-[30rem] max-w-full overflow-hidden rounded border border-rule bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Report options"
      >
        <div className="border-b border-rule px-4 py-3">
          <h2 className="text-sm text-ink">What goes in this report?</h2>
          <p className="mt-0.5 text-2xs text-faint">
            The candidate sees exactly what you leave on. Interviewer solutions and your private
            notes are never included, whatever you pick here.
          </p>
        </div>

        <ul className="divide-y divide-rule">
          {SECTIONS.map((s) => {
            const on = s.inverted ? !options[s.key] : options[s.key];
            return (
              <li key={s.key}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-paper/40">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={on}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        [s.key]: s.inverted ? !e.target.checked : e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <span className="block text-sm text-ink">{s.label}</span>
                    <span className="block text-2xs text-faint">{s.hint}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {nothingLeft && (
          <p className="border-t border-rule px-4 py-2 text-2xs text-warn">
            Everything is switched off — the report would be a name and a date.
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-rule px-4 py-3">
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setReportOptions(sessionId, options);
                router.refresh();
                onClose();
                onConfirm?.();
              })
            }
          >
            {pending ? "Saving…" : confirmLabel}
          </button>
          <button className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
