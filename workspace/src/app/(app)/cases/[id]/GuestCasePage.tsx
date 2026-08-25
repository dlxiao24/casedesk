import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signedFileUrl } from "@/actions/casebooks";
import { CASE_FORMATS, CASE_TYPES, TARGET_ROUNDS } from "@/lib/constants";
import { guestVisibleCaseIds } from "@/lib/library";
import { SAMPLE_CANDIDATE_NAME } from "@/lib/guest";
import { CaseView } from "./CaseView";

/**
 * A sample case, as a signed-out visitor sees it.
 *
 * Deliberately thin next to the coach's page: no ratings to set, no notes to
 * keep, no list of who else has run it — that last one would put candidates'
 * names in front of a stranger. What is left is the case itself and a way to
 * try running it, which is the whole point of letting anyone in.
 */
export async function GuestCasePage({ id }: { id: string }) {
  const open = await guestVisibleCaseIds();
  if (!open.includes(id)) redirect("/signup");

  const kase = await db.case.findUnique({
    where: { id },
    include: {
      casebook: { select: { title: true, fileKey: true, year: true } },
      sections: { orderBy: { order: "asc" } },
    },
  });
  if (!kase) notFound();

  const fileUrl = kase.casebook?.fileKey ? await signedFileUrl(kase.casebook.fileKey) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg text-ink">{kase.title}</h1>
          <p className="text-sm text-muted">
            {CASE_TYPES.find((t) => t.value === kase.caseType)?.label}
            {kase.industry ? ` · ${kase.industry}` : ""}
            {kase.firm ? ` · ${kase.firm}` : ""} ·{" "}
            {CASE_FORMATS.find((f) => f.value === kase.format)?.label}
            {kase.targetRound
              ? ` · ${TARGET_ROUNDS.find((r) => r.value === kase.targetRound)?.label}`
              : ""}
          </p>
          <p className="text-2xs text-faint">
            {kase.casebook
              ? `${kase.casebook.title}${kase.startPage ? `, pp. ${kase.startPage}–${kase.endPage}` : ""}`
              : "Typed case"}{" "}
            · {kase.sections.length} sections
          </p>
        </div>
        <Link href={`/sessions/new?caseId=${kase.id}`} className="btn btn-primary">
          Administer to {SAMPLE_CANDIDATE_NAME}
        </Link>
      </div>

      <p className="rounded border border-rule bg-panel px-3 py-2 text-sm text-muted">
        This is one of the sample cases. Run it against {SAMPLE_CANDIDATE_NAME} to see the whole
        flow — the live timer, notes by section, scoring, and the report at the end.{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create an account
        </Link>{" "}
        to read the rest of the library and case real people.
      </p>

      <CaseView
        fileUrl={fileUrl}
        sections={kase.sections.map((sec) => ({
          id: sec.id,
          kind: sec.kind,
          label: sec.label,
          startPage: sec.startPage,
          endPage: sec.endPage,
          bodyText: sec.bodyText,
          nested: Boolean(sec.pairedWithId),
        }))}
      />
    </div>
  );
}
