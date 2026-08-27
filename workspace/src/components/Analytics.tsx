"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics, with shared reports excluded from it entirely.
 *
 * A page view is reported with the URL it happened on, and for a shared report
 * the URL *is* the credential — §8 gives a candidate nothing but
 * `/share/<token>`, and that token is the whole of their authentication. A
 * token in an analytics dashboard is somebody's feedback readable by anyone
 * who can open that dashboard, long after the coach who shared it has
 * forgotten they did.
 *
 * `beforeSend` returns null, which drops the event before anything leaves the
 * browser. It deliberately does *not* rewrite the URL to `/share/[token]`,
 * which was the first attempt and does not work: the collector is sent both a
 * `o` field, which is the URL `beforeSend` returns, and a `dp` field, which is
 * the raw path and is not passed through `beforeSend` at all. Rewriting the
 * one while the other still carries the token is paint over data that ships
 * anyway — the same mistake as blurring a guest's library row. Verified
 * against the live collector: a dropped event produces no request, a kept one
 * produces a POST carrying `dp` verbatim.
 *
 * The cost is that shared reports are not counted. That is the price of the
 * token being in the path, and a count is not worth a credential.
 *
 * The wrapper exists because `beforeSend` is a function, functions do not
 * cross into a Client Component from the server, and the root layout is a
 * Server Component.
 */
export function Analytics() {
  return <VercelAnalytics beforeSend={(event) => (/\/share\//.test(event.url) ? null : event)} />;
}
