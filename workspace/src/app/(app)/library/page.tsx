import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { knownFirms, knownIndustries, libraryRows, parseFilters } from "@/lib/library";
import { LibraryFilterBar } from "./LibraryFilterBar";
import { LibraryTable } from "./LibraryTable";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseFilters(params);

  const [rows, casebooks, industries, firms, totalCases] = await Promise.all([
    libraryRows(user.id, filters),
    db.casebook.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    knownIndustries(),
    knownFirms(),
    db.case.count({ where: { archived: false } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-base text-ink">Library</h1>
          <p className="text-sm text-muted">
            {rows.length} case{rows.length === 1 ? "" : "s"}
            {rows.length !== totalCases && ` of ${totalCases}`} · sorted by what you have run least
            recently
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/casebooks/new" className="btn">
            Upload casebook
          </Link>
          <Link href="/library/new" className="btn btn-primary">
            Add case
          </Link>
        </div>
      </div>

      <LibraryFilterBar casebooks={casebooks} industries={industries} firms={firms} />

      {rows.length === 0 ? (
        <div className="rounded border border-rule bg-panel px-4 py-10 text-center">
          <p className="text-sm text-muted">
            {totalCases === 0
              ? "No cases yet. Upload a casebook to get started."
              : "No cases match these filters."}
          </p>
          {totalCases === 0 && (
            <Link href="/casebooks/new" className="btn btn-primary mt-3">
              Upload casebook
            </Link>
          )}
        </div>
      ) : (
        <LibraryTable rows={rows.map(serialize)} />
      )}
    </div>
  );
}

/** Server components can't hand class instances to the client. */
function serialize(row: Awaited<ReturnType<typeof libraryRows>>[number]) {
  return {
    id: row.id,
    title: row.title,
    caseType: row.caseType,
    industry: row.industry,
    firm: row.firm,
    format: row.format,
    targetRound: row.targetRound,
    source: row.casebook
      ? [row.casebook.title, row.casebook.year].filter(Boolean).join(" ")
      : "Typed",
    overallDifficulty: row.overallDifficulty,
    quantIntensity: row.quantIntensity,
    creativityLoad: row.creativityLoad,
    caseQuality: row.caseQuality,
    structureDifficulty: row.structureDifficulty,
    ambiguity: row.ambiguity,
    dataDensity: row.dataDensity,
    notes: row.notes,
    readiness: row.readiness,
    personalNotes: row.personalNotes,
    deliveredCount: row.deliveredCount,
    sectionCount: row._count.sections,
    lastDeliveredAt: row.lastDeliveredAt ? row.lastDeliveredAt.toISOString() : null,
    ownerName: row.owner.name,
  };
}
