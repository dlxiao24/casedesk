"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import clsx from "clsx";
import type { SectionKind } from "@prisma/client";
import { deleteSection, reorderSection, saveTextSection } from "@/actions/casebooks";
import { SECTION_KINDS, isHiddenKind, sectionKindMeta } from "@/lib/constants";

type Section = {
  id: string;
  kind: SectionKind;
  label: string;
  startPage: number | null;
  endPage: number | null;
  targetMins: number | null;
  bodyText: string | null;
};

export function SectionList({
  caseId,
  sections,
  canEdit,
  hasCasebook,
}: {
  caseId: string;
  sections: Section[];
  canEdit: boolean;
  hasCasebook: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, start] = useTransition();

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-ink">Sections</h2>
        <div className="flex gap-2">
          {/* Only offered to someone who can actually save it — the sectioning
              screen refuses a non-owner, and finding that out after doing the
              work is worse than not seeing the link. */}
          {hasCasebook && canEdit && (
            <Link href={`/cases/${caseId}/sections`} className="btn btn-quiet py-0.5">
              Split from PDF
            </Link>
          )}
          {canEdit && (
            <button className="btn btn-quiet py-0.5" onClick={() => setEditing("new")}>
              Add section
            </button>
          )}
        </div>
      </div>

      {sections.length === 0 && editing !== "new" && (
        <p className="mt-2 text-sm text-faint">
          No sections yet. The case still runs — the runner will give you one page of notes.
        </p>
      )}

      <ul className="mt-2 space-y-1">
        {sections.map((s, i) =>
          editing === s.id ? (
            <li key={s.id}>
              <SectionForm
                caseId={caseId}
                section={s}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded border border-rule bg-panel px-2 py-1.5 text-sm"
            >
              <span className={clsx("h-5 w-1 rounded-sm", sectionKindMeta(s.kind).spine)} />
              <span className="text-ink">{s.label}</span>
              <span className={clsx("chip", sectionKindMeta(s.kind).chip)}>
                {sectionKindMeta(s.kind).label}
              </span>
              {isHiddenKind(s.kind) && (
                <span className="chip border-rule text-faint">interviewer only</span>
              )}
              <span className="tabular text-2xs text-faint">
                {s.startPage ? `pp. ${s.startPage}–${s.endPage}` : s.bodyText ? "typed" : "no pages"}
                {s.targetMins ? ` · ${s.targetMins} min` : ""}
              </span>
              <span className="flex-1" />
              {canEdit && (
                <>
                  <button
                    className="btn btn-quiet px-1 py-0"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => start(async () => void (await reorderSection(s.id, -1)))}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-quiet px-1 py-0"
                    aria-label="Move down"
                    disabled={i === sections.length - 1}
                    onClick={() => start(async () => void (await reorderSection(s.id, 1)))}
                  >
                    ↓
                  </button>
                  <button className="btn btn-quiet py-0" onClick={() => setEditing(s.id)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-quiet py-0"
                    onClick={() => start(async () => void (await deleteSection(s.id)))}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ),
        )}
      </ul>

      {editing === "new" && (
        <div className="mt-2">
          <SectionForm caseId={caseId} onDone={() => setEditing(null)} />
        </div>
      )}
    </section>
  );
}

/** Sections can also be created by pasting text directly (§4.3). */
function SectionForm({
  caseId,
  section,
  onDone,
}: {
  caseId: string;
  section?: Section;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<SectionKind>(section?.kind ?? "PROMPT");
  const [label, setLabel] = useState(section?.label ?? "");
  const [body, setBody] = useState(section?.bodyText ?? "");
  const [mins, setMins] = useState(section?.targetMins ? String(section.targetMins) : "");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded border border-rule bg-panel p-3">
      <div className="flex flex-wrap gap-2">
        <select
          className="field w-auto"
          value={kind}
          onChange={(e) => setKind(e.target.value as SectionKind)}
        >
          {SECTION_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className="field flex-1"
          placeholder="Label, e.g. Exhibit 2 — Regional volumes"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="field tabular w-24"
          type="number"
          min={1}
          placeholder="mins"
          value={mins}
          onChange={(e) => setMins(e.target.value)}
        />
      </div>
      <textarea
        className="field prose-notes"
        rows={6}
        placeholder="Paste the section text here, or leave empty and point at PDF pages instead."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveTextSection({
                caseId,
                sectionId: section?.id,
                kind,
                label: label || sectionKindMeta(kind).label,
                bodyText: body,
                targetMins: mins ? Number(mins) : null,
              });
              onDone();
            })
          }
        >
          {pending ? "Saving…" : "Save section"}
        </button>
        <button className="btn btn-quiet" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
