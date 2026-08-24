"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { SectionKind } from "@prisma/client";

export type ViewSection = {
  id: string;
  kind: SectionKind;
  label: string;
  startPage: number | null;
  endPage: number | null;
  bodyText: string | null;
  /** Attached beneath another step rather than standing on its own. */
  nested: boolean;
};

// react-pdf reaches for DOMMatrix on import, which server rendering does not have.
const CaseSlides = dynamic(() => import("./CaseSlides").then((m) => m.CaseSlides), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-faint">Loading slides…</p>,
});

/**
 * Every slide of the case, in the order the runner will present them — so a
 * coach can read the case through before agreeing to administer it.
 *
 * Collapsed by default: a sectioned casebook case is a couple of dozen pages,
 * and rendering them all on every visit to the case page would make it crawl.
 */
export function CaseView({
  fileUrl,
  sections,
}: {
  fileUrl: string | null;
  sections: ViewSection[];
}) {
  const [open, setOpen] = useState(false);
  const pageCount = sections.reduce(
    (n, s) => n + (s.startPage ? (s.endPage ?? s.startPage) - s.startPage + 1 : 0),
    0,
  );

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-ink">Case view</h2>
        <button className="btn btn-quiet py-0.5" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide slides" : `Show ${pageCount || sections.length} slides`}
        </button>
      </div>
      <p className="mt-0.5 text-2xs text-faint">
        Every slide in delivery order, including interviewer solutions. Read it through before you
        administer the case.
      </p>

      {open &&
        (sections.length === 0 ? (
          <p className="mt-2 text-sm text-faint">
            This case has no sections yet, so there is nothing to lay out.
          </p>
        ) : (
          <div className="mt-3">
            <CaseSlides fileUrl={fileUrl} sections={sections} />
          </div>
        ))}
    </section>
  );
}
