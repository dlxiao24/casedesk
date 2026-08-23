"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOwnName } from "@/actions/admin";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex items-end gap-2"
      action={(form) =>
        start(async () => {
          const result = await updateOwnName(form);
          if (result?.error) return setError(result.error);
          setError(null);
          setSaved(true);
          router.refresh();
        })
      }
    >
      <div className="flex-1">
        <label className="label" htmlFor="name">
          Display name
        </label>
        <input id="name" name="name" defaultValue={name} className="field mt-1" required />
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && !pending && <span className="text-2xs text-faint">saved</span>}
      {error && <span className="text-2xs text-bad">{error}</span>}
    </form>
  );
}
