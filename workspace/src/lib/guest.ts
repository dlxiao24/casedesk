/**
 * Signed-out visitors (§2, extended).
 *
 * A guest may read a handful of cases and run one against a single shared
 * practice candidate. Everything here is safe to import from a client
 * component; the part that reads cookies lives in `viewer.ts`.
 */

/** How many real cases a signed-out visitor may open. */
export const GUEST_CASE_LIMIT = 5;

/** Cookie holding a guest's random id. Issued by middleware. */
export const GUEST_COOKIE = "casedesk_guest";

/**
 * Fixed ids for the two system rows the guest flow needs: the account its
 * sessions hang off, and the candidate it runs them against. Fixed rather
 * than generated so they can be found — and excluded from lists — without a
 * lookup by name.
 */
export const GUEST_USER_ID = "system-guest";
export const GUEST_USER_EMAIL = "guest@casedesk.local";
export const SAMPLE_CANDIDATE_ID = "system-sample-candidate";
export const SAMPLE_CANDIDATE_NAME = "Sample User";

/**
 * Invented cases, for the rows a guest cannot have.
 *
 * The locked rows are blurred, and a blur is only paint — the text under it is
 * still in the page source for anyone who opens dev tools. So the rows carry
 * fiction instead of the real library. The *count* is honest; the contents are
 * not, and are never linked to anything.
 */
const PLACEHOLDER_TITLES = [
  "Northwind Logistics",
  "Cedar Ridge Health",
  "Halcyon Payments",
  "Vantage Grocers",
  "Blue Harbor Shipping",
  "Ironwood Materials",
  "Peregrine Airways",
  "Sablefish Foods",
  "Kestrel Semiconductors",
  "Marigold Cosmetics",
  "Tallgrass Energy Co.",
  "Winterline Apparel",
];

const PLACEHOLDER_SOURCES = [
  "Consulting Club 2023",
  "Case Book 2022",
  "Interview Prep 2024",
  "Practice Set 2021",
];

/** Deterministic, so the server and the browser paint the same fiction. */
export function placeholderRow(index: number) {
  const spin = (n: number) => ((index * 7 + n * 3) % 5) + 1;
  return {
    title: PLACEHOLDER_TITLES[index % PLACEHOLDER_TITLES.length],
    source: PLACEHOLDER_SOURCES[index % PLACEHOLDER_SOURCES.length],
    caseType: ["Profitability", "Market entry", "Growth", "Pricing"][index % 4],
    overallDifficulty: spin(0),
    quantIntensity: spin(1),
    creativityLoad: spin(2),
    caseQuality: spin(3),
  };
}
