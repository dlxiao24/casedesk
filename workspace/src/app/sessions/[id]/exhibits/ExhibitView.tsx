"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const PdfPane = dynamic(() => import("../run/PdfPane").then((m) => m.PdfPane), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-neutral-500">Loading exhibits…</div>,
});

export type ExhibitSection = {
  id: string;
  label: string;
  startPage: number | null;
  endPage: number | null;
  bodyText: string | null;
};

/**
 * Deliberately plain and light: this is the surface a candidate looks at over a
 * screenshare, so it should read as a handout, not as the coach's tool. The
 * toolbar hides itself when printing.
 */
export function ExhibitView({
  caseTitle,
  fileUrl,
  exhibits,
}: {
  caseTitle: string;
  fileUrl: string | null;
  exhibits: ExhibitSection[];
}) {
  const [only, setOnly] = useState<string | "all">("all");
  const shown = only === "all" ? exhibits : exhibits.filter((e) => e.id === only);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="no-print sticky top-0 z-10 border-b border-neutral-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
          <span className="font-medium">{caseTitle}</span>
          <span className="text-neutral-500">
            · exhibits only — safe to share
          </span>
          <span className="flex-1" />
          {exhibits.length > 1 && (
            <select
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
              value={only}
              onChange={(e) => setOnly(e.target.value)}
            >
              <option value="all">All exhibits</option>
              {exhibits.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          )}
          <button
            className="rounded border border-neutral-300 px-2 py-1 hover:border-neutral-500"
            onClick={() => window.print()}
          >
            Print / save PDF
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {exhibits.length === 0 ? (
          <div className="rounded border border-neutral-300 bg-white p-8 text-center">
            <p className="text-sm text-neutral-600">
              This case has no interviewee exhibits yet.
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Mark pages with key 7 on the sectioning screen and they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {shown.map((e) => (
              <section
                key={e.id}
                className="page-break-before overflow-hidden rounded border border-neutral-300 bg-white first:break-before-auto"
              >
                <h2 className="border-b border-neutral-200 px-4 py-2 text-sm font-medium">
                  {e.label}
                </h2>
                {e.bodyText ? (
                  <pre className="whitespace-pre-wrap p-4 text-sm leading-relaxed">
                    {e.bodyText}
                  </pre>
                ) : fileUrl && e.startPage ? (
                  <ExhibitPages
                    fileUrl={fileUrl}
                    startPage={e.startPage}
                    endPage={e.endPage ?? e.startPage}
                  />
                ) : (
                  <p className="p-4 text-sm text-neutral-500">
                    No pages available for this exhibit.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExhibitPages({
  fileUrl,
  startPage,
  endPage,
}: {
  fileUrl: string;
  startPage: number;
  endPage: number;
}) {
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  return (
    <div className="bg-white [&_.react-pdf\\_\\_Page]:mx-auto">
      <PdfPane fileUrl={fileUrl} pages={pages} />
    </div>
  );
}
