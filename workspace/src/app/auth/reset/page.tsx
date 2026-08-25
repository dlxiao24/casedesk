import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";

/**
 * Reached through /auth/callback, which has already turned the emailed code
 * into a session. If there is no session the link was stale, so say that
 * rather than showing a form that cannot work.
 */
export default async function ResetPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <AuthShell blurb="That reset link has expired or was already used.">
        <Link href="/auth/forgot" className="btn btn-primary mt-6 w-full justify-center">
          Send a new one
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell blurb={`Setting a new password for ${user.email}.`}>
      <ResetForm />
    </AuthShell>
  );
}
