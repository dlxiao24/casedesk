import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { AuthShell, SupabaseMissingNotice } from "@/components/AuthShell";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await currentUser()) redirect("/library");

  return (
    <AuthShell blurb="Make an account to read the whole library and case real candidates.">
      {supabaseConfigured ? <SignupForm /> : <SupabaseMissingNotice />}
    </AuthShell>
  );
}
