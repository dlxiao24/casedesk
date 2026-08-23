import { notFound } from "next/navigation";
import { loadReportModel } from "@/lib/loadReport";
import { Report } from "@/components/Report";

export const dynamic = "force-dynamic";

/**
 * The public read-only link (§8). Unguessable token, revocable, no login. This
 * route is deliberately outside the authenticated shell and renders exactly the
 * same model as the coach's view — there is no second code path to keep honest.
 */
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const model = await loadReportModel({ shareToken: token });
  if (!model) notFound();

  return (
    <div className="min-h-screen bg-neutral-100 py-8">
      <div className="mx-auto max-w-[46rem] bg-white shadow-sm print:shadow-none">
        <Report model={model} />
      </div>
    </div>
  );
}
