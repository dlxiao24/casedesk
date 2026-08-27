"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics, with share tokens kept out of it.
 *
 * A page view is reported along with the URL it happened on, and for a shared
 * report the URL *is* the credential — §8 hands a candidate nothing but
 * `/share/<token>`, and the token is the whole of their authentication. A
 * token sitting in an analytics dashboard is somebody's feedback readable by
 * anyone who can open that dashboard, and it stays readable long after the
 * coach has moved on. Rewriting the path to its route keeps the number worth
 * having — how many shared reports actually get opened — and discards the part
 * that grants access.
 *
 * A string replace rather than URL parsing: the analytics script decides what
 * `url` holds, so a bare path and a full href both have to survive this.
 *
 * The wrapper exists because `beforeSend` is a function, functions do not
 * cross the server/client boundary, and the root layout is a Server Component.
 */
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        const url = event.url.replace(/\/share\/[^/?#]+/, "/share/[token]");
        return url === event.url ? event : { ...event, url };
      }}
    />
  );
}
