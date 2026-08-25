import { supabaseConfigured } from "@/lib/env";
import { AuthShell, SupabaseMissingNotice } from "@/components/AuthShell";
import { ForgotForm } from "./ForgotForm";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <AuthShell blurb="We will send a link that lets you set a new password.">
      {supabaseConfigured ? <ForgotForm /> : <SupabaseMissingNotice />}
    </AuthShell>
  );
}
