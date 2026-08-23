import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { UploadCasebook } from "./UploadCasebook";

export const dynamic = "force-dynamic";

export default async function NewCasebookPage() {
  await requireUser();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-base text-ink">Upload casebook</h1>
        <p className="text-sm text-muted">
          One file per casebook. Page text is extracted here in your browser, so nothing is sent
          anywhere except the file itself.
        </p>
      </div>

      {supabaseConfigured ? (
        <UploadCasebook />
      ) : (
        <p className="rounded border border-rule bg-panel p-3 text-sm text-muted">
          File storage is not configured in this environment. You can still add cases by typing or
          pasting their text — <Link href="/library/new" className="text-accent">add a case</Link>.
        </p>
      )}

      <Link href="/casebooks" className="btn btn-quiet">
        Cancel
      </Link>
    </div>
  );
}
