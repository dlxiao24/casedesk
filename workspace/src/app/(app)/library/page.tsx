import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { currentViewer } from "@/lib/viewer";
import { db } from "@/lib/db";
import {
  guestLibrary,
  knownFirms,
  knownIndustries,
  libraryRows,
  parseFilters,
} from "@/lib/library";
import { SAMPLE_CANDIDATE_NAME } from "@/lib/guest";
import { LibraryFilterBar } from "./LibraryFilterBar";
import { LibraryTable } from "./LibraryTable";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await currentViewer();
  if (viewer.kind === "guest") return <GuestLibrary />;
  const user = viewer.user;

  const params = await searchParams;
  const filters = parseFilters(params);

  const [rows, casebooks, industries, firms, totalCases, sampleCount] = await Promise.all([
    libraryRows(user.id, filters),
    db.casebook.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    knownIndustries(),
    knownFirms(),
    db.case.count({ where: { archived: false } }),
    db.case.count({ where: { archived: false, sampleForGuests: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-base text-ink">Library</h1>
          <p className="text-sm text-muted">
            {rows.length} case{rows.length === 1 ? "" : "s"}
            {rows.length !== totalCases && ` of ${totalCases}`}
            {/* The shop window is an admin's responsibility, so it is an
                admin's line. Nobody else can act on the number. */}
            {isAdmin(user) &&
              (sampleCount === 0
                ? " · nothing is open to guests yet"
                : ` · ${sampleCount} open to guests`)}
          </p>
        </div>
        {isAdmin(user) && (
          <div className="flex gap-2">
            <Link href="/casebooks/new" className="btn">
              Upload casebook
            </Link>
            <Link href="/library/new" className="btn btn-primary">
              Add case
            </Link>
          </div>
        )}
      </div>

      <LibraryFilterBar casebooks={casebooks} industries={industries} firms={firms} />

      {rows.length === 0 ? (
        <div className="rounded border border-rule bg-panel px-4 py-10 text-center">
          <p className="text-sm text-muted">
            {totalCases === 0
              ? isAdmin(user)
                ? "No cases yet. Upload a casebook to get started."
                : "No cases in the library yet. An admin adds them."
              : "No cases match these filters."}
          </p>
          {totalCases === 0 && isAdmin(user) && (
            <Link href="/casebooks/new" className="btn btn-primary mt-3">
              Upload casebook
            </Link>
          )}
        </div>
      ) : (
        <LibraryTable rows={rows.map(serialize)} isAdmin={isAdmin(user)} />
      )}
    </div>
  );
}

/**
 * What a signed-out visitor gets: a fixed handful of cases, no filters, and
 * the rest of the shelf visible as shape only. No search box either — see
 * `guestLibrary`, where the reasoning lives.
 */
async function GuestLibrary() {
  const { rows, lockedCount, total } = await guestLibrary();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base text-ink">Library</h1>
        <p className="text-sm text-muted">
          {total === 0 ? (
            "No cases in the library yet."
          ) : rows.length === 0 ? (
            <>
              The club has not opened any sample cases yet. Create an account to read all {total} of
              them.
            </>
          ) : (
            <>
              You are browsing as a guest, so {rows.length} of these {total} cases are open to read.
              You can run any of them against {SAMPLE_CANDIDATE_NAME} to see how a session works.
            </>
          )}
        </p>
      </div>

      {total > 0 && (
        <LibraryTable rows={rows.map(serialize)} isAdmin={false} lockedCount={lockedCount} isGuest />
      )}
    </div>
  );
}

/** Server components can't hand class instances to the client. */
function serialize(row: Awaited<ReturnType<typeof guestLibrary>>["rows"][number]) {
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
    archived: row.archived,
    sampleForGuests: row.sampleForGuests,
  };
}
