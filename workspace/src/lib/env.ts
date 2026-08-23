/** Supabase is optional at build time so `next build` works without secrets. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "casebooks";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Local development without a Supabase project: set DEV_COACH_EMAIL and every
 * request is treated as that coach. Refuses to engage in production.
 */
export const devCoachEmail =
  process.env.NODE_ENV === "production" ? "" : (process.env.DEV_COACH_EMAIL ?? "");

/** Supabase Storage free tier is 1GB; warn at 80% (§10). */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;
export const STORAGE_WARN_RATIO = 0.8;
