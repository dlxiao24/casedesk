import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ago } from "@/lib/format";
import { InviteForm } from "./InviteForm";
import { CoachRow, InviteRow } from "./Rows";

export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  const admin = await requireAdmin();
  const [users, invites] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    db.invite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-base text-ink">Coaches</h1>
        <p className="text-sm text-muted">
          Invite-only. There is no signup page — an email can only sign in once it has an invite.
        </p>
      </div>

      <InviteForm />

      <section>
        <h2 className="text-sm text-ink">Active</h2>
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
      </section>

      {invites.length > 0 && (
        <section>
          <h2 className="text-sm text-ink">Pending invites</h2>
          <ul className="mt-2 divide-y divide-rule rounded border border-rule">
            {invites.map((i) => (
              <InviteRow
                key={i.id}
                id={i.id}
                email={i.email}
                role={i.role}
                revoked={Boolean(i.revokedAt)}
                by={i.invitedBy.name}
                when={ago(i.createdAt)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
