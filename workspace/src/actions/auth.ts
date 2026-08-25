"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * There was no way to sign out while the only way in was a magic link — the
 * link *was* the session. With passwords there has to be a door out.
 *
 * Signing out lands on the landing page: the front door, rather than dropping
 * someone into a guest view of the library with no explanation of what just
 * happened to their account.
 *
 * The revalidate is not optional. Clearing the cookie changes what every
 * server component renders, and without this the client router cache would
 * keep handing back pages rendered while they were still signed in — their
 * name still in the header, their candidates still listed.
 */
export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
