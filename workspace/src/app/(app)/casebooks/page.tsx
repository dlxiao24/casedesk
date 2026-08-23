import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { STORAGE_QUOTA_BYTES, STORAGE_WARN_RATIO } from "@/lib/env";
import { ago } from "@/lib/format";
import { DeleteCasebook } from "./DeleteCasebook";

export const dynamic = "force-dynamic";

export default async function CasebooksPage() {
  const user = await requireUser();

  const [casebooks, usage] = await Promise.all([
    db.casebook.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        uploader: { select: { name: true } },
        _count: { select: { cases: true } },
      },
    }),
    db.casebook.aggregate({ _sum: { byteSize: true } }),
  ]);

  const used = usage._sum.byteSize ?? 0;
  const ratio = used / STORAGE_QUOTA_BYTES;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-base text-ink">Casebooks</h1>
          <p className="text-sm text-muted">
            One PDF per casebook, not per case — that is the difference between about 50 and about
            500 cases on the free tier.
          </p>
        </div>
        <Link href="/casebooks/new" className="btn btn-primary">
          Upload casebook
        </Link>
      </div>

      <div className="rounded border border-rule bg-panel p-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Storage</span>
          <span className="tabular text-faint">
            {formatBytes(used)} of {formatBytes(STORAGE_QUOTA_BYTES)}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full rounded bg-rule">
          <div
            className={ratio >= STORAGE_WARN_RATIO ? "h-1 rounded bg-warn" : "h-1 rounded bg-accent"}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
        {ratio >= STORAGE_WARN_RATIO && (
          <p className="mt-1.5 text-2xs text-warn">
            Over {Math.round(STORAGE_WARN_RATIO * 100)}% of the free tier. Compress new uploads, or
            delete a casebook nobody runs.
          </p>
        )}
      </div>

      {casebooks.length === 0 ? (
        <p className="rounded border border-rule bg-panel px-4 py-8 text-center text-sm text-muted">
          No casebooks yet. Upload a casebook to get started.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded border border-rule">
          {casebooks.map((cb) => (
            <li key={cb.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <Link href={`/casebooks/${cb.id}/split`} className="text-ink hover:text-accent">
                {cb.title}
              </Link>
              <span className="text-2xs text-faint">
                {[cb.school, cb.year].filter(Boolean).join(" ")} · {cb.pageCount} pages ·{" "}
                {formatBytes(cb.byteSize)} · {cb.sourceKind === "IMAGES" ? "images" : "PDF"}
              </span>
              <span className="flex-1" />
              <span className="text-2xs text-faint">
                {cb._count.cases} case{cb._count.cases === 1 ? "" : "s"} · {cb.uploader.name},{" "}
                {ago(cb.createdAt)}
              </span>
              <Link href={`/casebooks/${cb.id}/split`} className="btn btn-quiet py-0.5">
                Split into cases
              </Link>
              {isAdmin(user) && <DeleteCasebook id={cb.id} title={cb.title} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
