import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ago } from "@/lib/format";
import { REAL_USERS } from "@/lib/viewer";
import { CoachRow } from "./Rows";

export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({
    where: REAL_USERS,
    orderBy: { createdAt: "asc" },
  });

  const admins = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-base text-ink">Coaches</h1>
        <p className="text-sm text-muted">
          Anyone can make an account, and everyone starts as a coach. Admin is granted here and
          nowhere else — {admins} {admins === 1 ? "person has" : "people have"} it.
        </p>
      </div>

      <section>
        <h2 className="text-sm text-ink">{users.length} accounts</h2>
        <ul className="mt-2 divide-y divide-rule rounded border border-rule">
          {users.map((u) => (
            <CoachRow
              key={u.id}
              id={u.id}
              name={u.name}
              email={u.email}
              role={u.role}
              isSelf={u.id === admin.id}
              joined={ago(u.createdAt)}
            />
          ))}
        </ul>
        <p className="mt-2 text-2xs text-faint">
          An admin can add and split cases, see every candidate, and permanently delete archived
          records. A coach runs cases and keeps their own candidates.
        </p>
      </section>
    </div>
  );
}
