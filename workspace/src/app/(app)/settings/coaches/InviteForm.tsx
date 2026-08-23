"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteCoach } from "@/actions/admin";

export function InviteForm() {
  const [state, action] = useActionState(inviteCoach, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded border border-rule bg-panel p-3">
      <div className="flex-1">
        <label className="label" htmlFor="email">
          Invite by email
        </label>
        <input id="email" name="email" type="email" required className="field mt-1" />
      </div>
      <select name="role" className="field w-auto" defaultValue="COACH">
        <option value="COACH">Coach</option>
        <option value="ADMIN">Admin</option>
      </select>
      <Submit />
      {state?.error && <p className="w-full text-sm text-bad">{state.error}</p>}
      {state?.ok && <p className="w-full text-sm text-good">{state.ok}</p>}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Inviting…" : "Invite"}
    </button>
  );
}
