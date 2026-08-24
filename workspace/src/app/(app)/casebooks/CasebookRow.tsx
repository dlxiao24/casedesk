"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { CaseRowActions } from "./CaseRowActions";

export type CasebookCase = {
  id: string;
  title: string;
  startPage: number | null;
  endPage: number | null;
  sectionCount: number;
  archived: boolean;
  sessionCount: number;
  canEdit: boolean;
};

/**
 * A casebook row that opens to show the cases split out of it — the fastest way
 * to answer "what did I already pull out of this one?" without a page load.
 */
export function CasebookRow({
  id,
  title,
  meta,
  footer,
  cases,
  children,
  /**
   * A grouping with no casebook behind it — the home for cases nobody has
   * attached to a source. There is nothing to split and nothing to delete, and
   * a case leaves on its own the moment it is given a casebook.
   */
  virtual = false,
}: {
  id: string;
  title: string;
  meta: string;
  footer: string;
  cases: CasebookCase[];
  children?: React.ReactNode;
  virtual?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Hide cases in ${title}` : `Show cases in ${title}`}
          className="tabular w-4 shrink-0 text-faint hover:text-ink"
        >
          {open ? "▾" : "▸"}
        </button>
        {virtual ? (
          <span className="text-ink">{title}</span>
        ) : (
          <Link href={`/casebooks/${id}/split`} className="text-ink hover:text-accent">
            {title}
          </Link>
        )}
        <span className="text-2xs text-faint">{meta}</span>
        <span className="flex-1" />
        <span className="text-2xs text-faint">{footer}</span>
        {!virtual && (
          <Link href={`/casebooks/${id}/split`} className="btn btn-quiet py-0.5">
            Split into cases
          </Link>
        )}
        {children}
      </div>

      {open && (
        <div className="ml-7 mt-2">
          {cases.length === 0 ? (
            <p className="text-2xs text-faint">
              {virtual ? (
                "Every case is attached to a casebook. Nothing to see here."
              ) : (
                <>
                  No cases pulled out of this casebook yet.{" "}
                  <Link href={`/casebooks/${id}/split`} className="text-accent">
                    Split it
                  </Link>
                  .
                </>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-rule/60 rounded border border-rule">
              {cases.map((c) => (
                <li
                  key={c.id}
                  className={clsx(
                    "flex flex-wrap items-center gap-2 px-2 py-1.5",
                    c.archived && "opacity-55",
                  )}
                >
                  <Link href={`/cases/${c.id}`} className="text-ink hover:text-accent">
                    {c.title}
                  </Link>
                  {c.archived && <span className="chip border-rule text-faint">archived</span>}
                  <span className="tabular text-2xs text-faint">
                    {c.startPage ? `pp. ${c.startPage}–${c.endPage}` : "no pages"}
                  </span>
                  <span
                    className={clsx(
                      "text-2xs",
                      c.sectionCount > 0 ? "text-faint" : "text-warn/80",
                    )}
                  >
                    {c.sectionCount > 0 ? `${c.sectionCount} sections` : "not sectioned"}
                  </span>
                  <span className="flex-1" />
                  <Link
                    href={virtual ? `/cases/${c.id}` : `/cases/${c.id}/sections`}
                    className="btn btn-quiet py-0 text-2xs"
                  >
                    {virtual ? "Open" : "Sections"}
                  </Link>
                  <Link
                    href={`/sessions/new?caseId=${c.id}`}
                    className="btn btn-quiet py-0 text-2xs"
                  >
                    Administer
                  </Link>
                  <CaseRowActions
                    caseId={c.id}
                    title={c.title}
                    archived={c.archived}
                    sessionCount={c.sessionCount}
                    canEdit={c.canEdit}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
