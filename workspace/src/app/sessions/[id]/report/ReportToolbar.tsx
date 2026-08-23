"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createShareLink,
  markShared,
  reopenSession,
  revokeShareLink,
  setReportOptions,
} from "@/actions/sessions";

/**
 * Everything on this bar that puts the report in front of a candidate also
 * locks the session (§8.1). Printing counts — a printed PDF is a shared PDF.
 */
export function ReportToolbar({
  sessionId,
  locked,
  includeRecord,
  hideSource,
  shareToken,
  candidateId,
  markdown,
}: {
  sessionId: string;
  locked: boolean;
  includeRecord: boolean;
  hideSource: boolean;
  shareToken: string | null;
  candidateId: string;
  markdown: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [copied, setCopied] = useState(false);
  // Built after mount so the server and client agree on the first render.
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    setLink(shareToken ? `${window.location.origin}/share/${shareToken}` : null);
  }, [shareToken]);

  return (
    <div className="no-print sticky top-0 z-10 border-b border-neutral-300 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[46rem] flex-wrap items-center gap-2 px-4 py-2 text-sm text-neutral-700">
        <Link href={`/candidates/${candidateId}`} className="text-neutral-500 hover:text-neutral-900">
          ← Candidate
        </Link>
        <span className="flex-1" />

        <label className="flex items-center gap-1.5" title="The record goes last, under its own heading.">
          <input
            type="checkbox"
            checked={includeRecord}
            disabled={locked}
            onChange={(e) =>
              start(async () => {
                await setReportOptions(sessionId, { includeRecord: e.target.checked });
                router.refresh();
              })
            }
          />
          Session record
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={hideSource}
            disabled={locked}
            onChange={(e) =>
              start(async () => {
                await setReportOptions(sessionId, { hideSource: e.target.checked });
                router.refresh();
              })
            }
          />
          Hide source
        </label>

        <button
          className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500"
          onClick={() =>
            start(async () => {
              await navigator.clipboard.writeText(markdown);
              setCopied(true);
              await markShared(sessionId);
              router.refresh();
              setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          {copied ? "Copied" : "Copy as markdown"}
        </button>

        <button
          className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500"
          onClick={() =>
            start(async () => {
              await markShared(sessionId);
              router.refresh();
              window.print();
            })
          }
        >
          Print / save PDF
        </button>

        {link ? (
          <span className="flex items-center gap-1.5">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="w-52 rounded border border-neutral-300 px-1.5 py-1 text-xs"
            />
            <button
              className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500"
              onClick={() =>
                start(async () => {
                  await revokeShareLink(sessionId);
                  setLink(null);
                  router.refresh();
                })
              }
            >
              Revoke
            </button>
          </span>
        ) : (
          <button
            className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500"
            onClick={() =>
              start(async () => {
                const { token } = await createShareLink(sessionId);
                setLink(`${window.location.origin}/share/${token}`);
                router.refresh();
              })
            }
          >
            Create link
          </button>
        )}

        {locked ? (
          <button
            className="rounded border border-amber-500 bg-amber-50 px-2 py-1 text-amber-800"
            onClick={() => {
              if (window.confirm("The candidate may have already seen this version. Reopen anyway?")) {
                start(async () => {
                  await reopenSession(sessionId);
                  router.refresh();
                });
              }
            }}
          >
            Reopen
          </button>
        ) : (
          <Link
            href={`/sessions/${sessionId}/wrap`}
            className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500"
          >
            Edit
          </Link>
        )}
      </div>
    </div>
  );
}
