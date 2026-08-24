import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewCaseForm } from "./NewCaseForm";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  await requireAdmin();
  const casebooks = await db.casebook.findMany({
    select: { id: true, title: true, pageCount: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-base text-ink">Add case</h1>
        <p className="text-sm text-muted">
          A title is all that is required. Ratings, sections and target times can come later —
          including in the middle of a session.
        </p>
      </div>
      <NewCaseForm casebooks={casebooks} />
      <Link href="/library" className="btn btn-quiet">
        Cancel
      </Link>
    </div>
  );
}
