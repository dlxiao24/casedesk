import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The library is the front door for everyone now — a guest sees a sample of
 * it rather than a login wall.
 */
export default function Home() {
  redirect("/library");
}
