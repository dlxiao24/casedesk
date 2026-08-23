import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/library");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-lg text-ink">Case Desk</h1>
      <p className="mt-1 text-sm text-muted">
        Coaches only. Sign in with the email you were invited on.
      </p>
      {supabaseConfigured ? (
        <LoginForm />
      ) : (
        <p className="mt-6 rounded border border-rule bg-panel p-3 text-sm text-muted">
          Supabase is not configured. Set <code className="tabular">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and <code className="tabular">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, or set{" "}
          <code className="tabular">DEV_COACH_EMAIL</code> to work against a local database without
          auth.
        </p>
      )}
    </main>
  );
}
