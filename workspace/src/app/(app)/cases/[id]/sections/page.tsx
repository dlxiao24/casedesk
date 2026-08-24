import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { signedFileUrl } from "@/actions/casebooks";
import { guessSectionKind, guessSectionLabel } from "@/lib/heuristics";
import { AssignSections } from "./AssignSections";

export const dynamic = "force-dynamic";

export default async function SectionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const kase = await db.case.findUnique({
    where: { id },
    include: {
      casebook: true,
      sections: { orderBy: { order: "asc" } },
    },
  });
  if (!kase) notFound();
  if (!kase.casebook || !kase.startPage) redirect(`/cases/${id}`);

  const fileUrl = await signedFileUrl(kase.casebook.fileKey);
  const pageText = (kase.casebook.pageText ?? {}) as Record<string, string>;

  // Heuristic assist (§4.3): pre-select a kind per page from its keywords.
  const suggestions: Record<number, { kind: string; label: string | null }> = {};
  for (let p = kase.startPage; p <= (kase.endPage ?? kase.startPage); p += 1) {
    const text = pageText[String(p)] ?? "";
    const kind = guessSectionKind(text);
    if (kind) suggestions[p] = { kind, label: guessSectionLabel(kind, text) };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-base text-ink">Sections — {kase.title}</h1>
          <p className="text-sm text-muted">
            {kase.casebook.title}, pages {kase.startPage}–{kase.endPage}
          </p>
        </div>
        <Link href={`/cases/${id}`} className="btn btn-quiet">
          Back to case
        </Link>
      </div>

      <AssignSections
        caseId={kase.id}
        fileUrl={fileUrl}
        startPage={kase.startPage}
        endPage={kase.endPage ?? kase.startPage}
        suggestions={suggestions}
        existing={kase.sections.map((s) => ({
          id: s.id,
          kind: s.kind,
          label: s.label,
          startPage: s.startPage,
          endPage: s.endPage,
          targetMins: s.targetMins,
          pairedWithId: s.pairedWithId,
        }))}
      />
    </div>
  );
}
