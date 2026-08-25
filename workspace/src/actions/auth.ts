"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * There was no way to sign out while the only way in was a magic link — the
 * link *was* the session. With passwords there has to be a door out.
 *
 * Signing out lands on the library rather than the login page: the library is
 * readable to guests, so it is a place to be rather than a wall.
 */
export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/library");
}
