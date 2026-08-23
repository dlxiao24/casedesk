import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { signedFileUrl } from "@/actions/casebooks";
import { guessCaseTitle, looksLikeCaseStart } from "@/lib/heuristics";
import { SplitCasebook } from "./SplitCasebook";

export const dynamic = "force-dynamic";

export default async function SplitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const casebook = await db.casebook.findUnique({
    where: { id },
    include: {
      cases: {
        orderBy: { startPage: "asc" },
        select: { id: true, title: true, startPage: true, endPage: true },
      },
    },
  });
  if (!casebook) notFound();

  const fileUrl = casebook.fileKey ? await signedFileUrl(casebook.fileKey) : null;
  const pageText = (casebook.pageText ?? {}) as Record<string, string>;

  // Heuristic assist (§4.2): pre-mark likely case starts. Nothing is committed.
  const suggestions: Record<number, string> = {};
  for (let p = 1; p <= casebook.pageCount; p += 1) {
    const text = pageText[String(p)] ?? "";
    if (text && looksLikeCaseStart(text)) {
      suggestions[p] = guessCaseTitle(text) ?? "likely case start";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-base text-ink">{casebook.title}</h1>
          <p className="text-sm text-muted">
            {casebook.pageCount} pages · {casebook.cases.length} cases so far ·{" "}
            {Object.keys(suggestions).length} suggested case starts
          </p>
        </div>
        <Link href="/casebooks" className="btn btn-quiet">
          All casebooks
        </Link>
      </div>

      <SplitCasebook
        casebookId={casebook.id}
        fileUrl={fileUrl}
        pageCount={casebook.pageCount}
        suggestions={suggestions}
        existing={casebook.cases.map((c) => ({
          id: c.id,
          title: c.title,
          startPage: c.startPage ?? 0,
          endPage: c.endPage ?? 0,
        }))}
      />
    </div>
  );
}
