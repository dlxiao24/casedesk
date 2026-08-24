"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { SessionStatus } from "@prisma/client";
import { abandonSession, deleteSession, setSessionArchived } from "@/actions/sessions";
import { DeleteForever } from "@/components/DeleteForever";

export function SessionRowActions({
  id,
  status,
  archived,
  canEdit,
  isAdmin,
  label,
}: {
  id: string;
  status: SessionStatus;
  archived: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <span className="flex justify-end gap-1">
      {status === "IN_PROGRESS" ? (
        <Link href={`/sessions/${id}/run`} className="btn btn-quiet py-0.5">
          Resume
        </Link>
      ) : (
        <Link href={`/sessions/${id}/report`} className="btn btn-quiet py-0.5">
          Report
        </Link>
      )}
      {canEdit && status === "IN_PROGRESS" && (
        <button
          className="btn btn-quiet py-0.5"
          disabled={pending}
          onClick={() => start(async () => void (await abandonSession(id)))}
        >
          Abandon
        </button>
      )}
      {canEdit && (
        <button
          className="btn btn-quiet py-0.5"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setSessionArchived(id, !archived);
              router.refresh();
            })
          }
        >
          {archived ? "Restore" : "Archive"}
        </button>
      )}
      {/* Only once archived: the reversible step has to come first. */}
      {isAdmin && archived && (
        <DeleteForever name={label} onDelete={() => deleteSession(id)} />
      )}
    </span>
  );
}
