import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { GUEST_COOKIE } from "@/lib/guest";

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Keeps the Supabase session cookie fresh, and hands every signed-out visitor
 * a guest id.
 *
 * The guest id is issued here rather than on first use because a Server
 * Component cannot set a cookie — and the id has to exist before the page
 * renders, or the visitor's first click would land on a session with nobody
 * to own it. It is set on the request as well as the response so that this
 * very render already sees it.
 */
export async function middleware(request: NextRequest) {
  const guestKey = request.cookies.get(GUEST_COOKIE)?.value ?? crypto.randomUUID();
  const isNewGuest = !request.cookies.get(GUEST_COOKIE);
  if (isNewGuest) request.cookies.set(GUEST_COOKIE, guestKey);

  const withGuestCookie = (response: NextResponse) => {
    if (isNewGuest) {
      response.cookies.set(GUEST_COOKIE, guestKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: YEAR_IN_SECONDS,
      });
    }
    return response;
  };

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return withGuestCookie(NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return withGuestCookie(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|share/|.*\.(?:png|jpg|svg|ico)$).*)"],
};
