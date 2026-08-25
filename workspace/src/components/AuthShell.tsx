import Image from "next/image";

/**
 * The frame around every sign-in screen. The stacked lockup gets used here,
 * which is what it was drawn for — there is room on this page, unlike the
 * header bar.
 */
export function AuthShell({
  blurb,
  children,
}: {
  blurb: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Image
        src="/logo.png"
        alt="Case Desk"
        width={935}
        height={685}
        priority
        className="mb-2 h-24 w-auto"
      />
      <p className="mt-1 text-sm text-muted">{blurb}</p>
      {children}
    </main>
  );
}

export function SupabaseMissingNotice() {
  return (
    <p className="mt-6 rounded border border-rule bg-panel p-3 text-sm text-muted">
      Supabase is not configured. Set <code className="tabular">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
      <code className="tabular">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, or set{" "}
      <code className="tabular">DEV_COACH_EMAIL</code> to work against a local database without
      auth.
    </p>
  );
}
