"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CaseFormat, CaseType, TargetRound } from "@prisma/client";
import { updateCase } from "@/actions/cases";
import { CASE_FORMATS, CASE_TYPES, TARGET_ROUNDS } from "@/lib/constants";
import { FirmField } from "@/components/FirmField";

/**
 * The fields the library filters on (§5). They were settable only at creation,
 * which meant a case added straight off a page range could never be classified
 * afterwards — and an unclassified case is invisible to every filter.
 */
export function CaseFields({
  caseId,
  canEdit,
  casebooks,
  initial,
}: {
  caseId: string;
  canEdit: boolean;
  casebooks: { id: string; title: string; pageCount: number }[];
  initial: {
    title: string;
    caseType: CaseType;
    industry: string | null;
    firm: string | null;
    format: CaseFormat;
    targetRound: TargetRound | null;
    casebookId: string | null;
    startPage: number | null;
    endPage: number | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canEdit) return null;

  if (!open) {
    return (
      <button className="btn btn-quiet py-0.5" onClick={() => setOpen(true)}>
        Edit details
      </button>
    );
  }

  return (
    <form
      className="w-full space-y-3 rounded border border-rule bg-panel p-3"
      action={(form) =>
        start(async () => {
          const result = await updateCase(caseId, form);
          if (result?.error) return setError(result.error);
          setError(null);
          setOpen(false);
          router.refresh();
        })
      }
    >
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" defaultValue={initial.title} required className="field mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="caseType">
            Case type
          </label>
          <select id="caseType" name="caseType" defaultValue={initial.caseType} className="field mt-1">
            {CASE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="format">
            Format
          </label>
          <select id="format" name="format" defaultValue={initial.format} className="field mt-1">
            {CASE_FORMATS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="industry">
            Industry
          </label>
          <input
            id="industry"
            name="industry"
            defaultValue={initial.industry ?? ""}
            placeholder="Optional"
            className="field mt-1"
          />
        </div>
        <FirmField defaultValue={initial.firm} />
        <div>
          <label className="label" htmlFor="targetRound">
            Target round
          </label>
          <select
            id="targetRound"
            name="targetRound"
            defaultValue={initial.targetRound ?? ""}
            className="field mt-1"
          >
            <option value="">Any</option>
            {TARGET_ROUNDS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-3">
        <div>
          <label className="label" htmlFor="casebookId">
            Source casebook
          </label>
          <select
            id="casebookId"
            name="casebookId"
            defaultValue={initial.casebookId ?? ""}
            className="field mt-1"
          >
            <option value="">None — typed case</option>
            {casebooks.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.pageCount}pp)
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="label" htmlFor="startPage">
            First page
          </label>
          <input
            id="startPage"
            name="startPage"
            type="number"
            min={1}
            defaultValue={initial.startPage ?? ""}
            className="field tabular mt-1"
          />
        </div>
        <div className="w-24">
          <label className="label" htmlFor="endPage">
            Last page
          </label>
          <input
            id="endPage"
            name="endPage"
            type="number"
            min={1}
            defaultValue={initial.endPage ?? ""}
            className="field tabular mt-1"
          />
        </div>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
