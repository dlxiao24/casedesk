# Case Desk

A case-interview library and live administration tool for consulting club coaches.
Built to the spec in [`../case-desk-spec.md`](../case-desk-spec.md).

Three surfaces:

- **Library** — cases sourced from casebook PDFs, tagged, filterable, with a per-coach readiness state.
- **Runner** — a keyboard-driven screen for administering a case, capturing notes and time per section.
- **Report** — a printable feedback document assembled from rubric scores and notes.

**Zero recurring cost.** No paid APIs, no LLM calls. Feedback drafting is deterministic: it reads a
seeded phrase bank and the notes the coach starred during the session.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS |
| DB | Supabase Postgres (free tier) |
| ORM | Prisma 6 |
| Auth | Supabase Auth, email and password |
| Storage | Supabase Storage |
| PDF | pdf.js via react-pdf, entirely in the browser |
| Charts | Recharts |
| Hosting | Vercel Hobby |

Data access is Server Components plus Server Actions — there are no REST routes to keep in sync.
Everything in `src/actions/` runs on the server and is called directly from the client components
that need it.

---

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` from your Supabase project (Settings → Database for the connection strings, Settings
→ API for the keys), then:

```bash
npx prisma db push
npm run db:seed
npm run dev
```

`db:seed` creates the first admin from `SEED_ADMIN_EMAIL`, loads 120 phrases into the phrase bank,
and adds one demo case and candidate. Set `SEED_MINIMAL=1` to skip the demo content.

### Outgoing mail

The **Contact me** button in the header sends to `FEEDBACK_TO`
(`casedeskadmin@gmail.com` by default) with the subject
`Casedesk feedback - <the address they typed>`, and sets Reply-To to that address so
replying reaches the sender. Set `SMTP_USER` and `SMTP_PASS` to a Gmail address and an
app password from [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
(2-Step Verification must be on). This is separate from the SMTP that Supabase Auth uses
for confirmation and reset mail, though the same app password works for both.

Every message is written to `FeedbackMessage` before it is sent. If mail is not configured,
or the account stops working, the row is still there with `sendError` explaining why — so
nothing is lost while the credentials are sorted out. The form is open to guests, capped at
five messages an hour per address and thirty an hour overall.

### Supabase Storage

Create a **private** bucket named `casebooks` (or whatever you set `NEXT_PUBLIC_SUPABASE_BUCKET`
to). Casebook files are uploaded from the browser and read back through short-lived signed URLs, so
the bucket should not be public.

### Accounts and access

Three levels, and only one of them can be self-served.

- **Guest** — nobody is signed in. Reads whichever cases an admin has opened with "Show to guests"
  on the case page, blurred fiction where the rest would be, and can run one against the shared
  "Sample User" candidate. The session is tied to a cookie, so it is theirs alone and never appears
  in a coach's lists. Only sectioned, unarchived cases can be opened this way.
- **Coach** — anyone who confirms an email address. Reads the whole library, runs cases against
  candidates they add, and keeps their own notes and readiness. Cannot add or split cases.
- **Admin** — granted by another admin on Settings → Coaches, and no other way. Adds casebooks and
  cases, sees every candidate, and permanently deletes archived records.

Sign-up needs working email: Supabase's built-in sender only delivers to members of the Supabase
org, so configure custom SMTP under Project Settings → Authentication before inviting anyone real.
Confirmation and password-reset links both land on `/auth/callback`, which must be listed under
Authentication → URL Configuration.

### Running without Supabase

For local work against a plain Postgres, set `DEV_COACH_EMAIL` to a seeded coach's email. Every
request is then treated as that coach and the login page is bypassed. This is refused when
`NODE_ENV=production`. File upload and the PDF pane are inactive in this mode; typed and pasted
cases work fully.

---

## How it fits together

```
src/
  actions/         Server actions — every write in the app
  app/
    (app)/         Authenticated shell: library, casebooks, candidates, sessions, settings
    sessions/[id]/run     The runner. Outside the shell — no nav, no chrome.
    sessions/[id]/report  The report, in its own light theme.
    share/[token]         Public read-only report. No login.
  components/      ScoreBar, Segmented, PageGrid, Report
  lib/             db, auth, constants (the rubric), heuristics, draft, report model
prisma/
  schema.prisma    The model from spec §3
  phrases.ts       120 seeded coaching phrases
  seed.ts
```

A few decisions worth knowing before you change things:

- **`src/lib/loadReport.ts` is the only place session data becomes candidate-facing.** Solution and
  interviewer-guide sections, `CoachCase.personalNotes`, and `Case.caseQuality` are excluded there,
  once. Both the HTML report and the markdown copy render from the same model, so they cannot drift.
- **Autosave lives in `src/lib/useAutosave.tsx`.** Optimistic local write first, debounced network
  write second, and a failure degrades to "offline — changes kept locally" rather than interrupting.
- **Sharing locks a session.** Printing, copying markdown, and minting a public link all set
  `locked`. Reopening is explicit and stamps the report "Revised".
- **Re-sectioning a case keeps section ids** wherever a page range survives, so notes from past
  sessions do not become orphans.
- **`Casebook.searchText`** is a denormalised lowercase copy of the extracted page text. It exists so
  library search can hit casebook bodies without scanning JSON.

### The runner's keyboard map

| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Move between "What was said" and "Feedback" |
| `Cmd/Ctrl + →` / `←` | Next / previous section |
| `Cmd/Ctrl + Enter` | Stamp `[12:04] ` on a new line in the focused field |
| `Cmd/Ctrl + K` | Jump-to-section palette |
| `R` (outside a note field) | Reveal / hide a solution |
| `Space` (outside a note field) | Pause / resume the timer |
| `Cmd/Ctrl + S` | Finish case, go to wrap-up (confirms first) |

In the sectioning grid, `1`–`7` assign a section kind to the selected page and advance;
Backspace clears. Key 7 (interviewer solution) attaches to the step before it; everything
else starts its own step.

---

## Scripts

```bash
npm run dev         # dev server
npm run build       # prisma generate + next build
npm run typecheck   # tsc --noEmit
npm run db:push     # sync schema without a migration
npm run db:seed     # phrases, first admin, demo content
npm run db:studio   # Prisma Studio
```

---

## What is deliberately not here (spec §13)

Candidate logins, any paid API or LLM call, real-time collaboration on one session, .docx or
server-side PDF generation, phone support for the runner, scheduling, a cross-school library, and
audio recording.

The "Polish with your own Anthropic key" idea from spec §7.1 is not built. The seam for it is the
`draftForSession` action in `src/actions/sessions.ts` — it returns the drafted takeaways, and a
polish step would take that output and nothing else.

---

## Verification status

Verified end to end against a real Postgres: sign-in bypass, library filters, starting a session,
runner autosave and per-section timers, the timestamp stamp, the jump palette, solution blurring,
ending a case, rubric scoring, phrase-bank drafting (including starred notes ranking above phrases),
the report, markdown copy, the public share link, session locking and the redirect it forces, and
readiness auto-advance to Delivered.

The PDF pipeline — casebook upload, browser-side text extraction, the thumbnail grid, and the PDF
pane in the runner — is implemented but has only been type-checked and built, not exercised: it
needs a live Supabase Storage bucket, which this environment does not have. Try it against a real
project before trusting it with a 200-page casebook.
