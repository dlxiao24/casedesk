"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Role } from "@prisma/client";
import { setUserRole } from "@/actions/admin";

export function CoachRow({
  id,
  name,
  email,
  role,
  isSelf,
  joined,
}: {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSelf: boolean;
  joined: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <span className="text-ink">{name}</span>
      <span className="text-2xs text-faint">{email}</span>
      <span className="flex-1" />
      <span className="text-2xs text-faint">joined {joined}</span>
      <select
        className="field w-auto py-0.5 text-2xs"
        value={role}
        disabled={isSelf || pending}
        onChange={(e) =>
          start(async () => {
            await setUserRole(id, e.target.value as Role);
            router.refresh();
          })
        }
      >
        <option value="COACH">Coach</option>
        <option value="ADMIN">Admin</option>
      </select>
    </li>
  );
}
