# Case Desk — working notes

A case-interview library, live runner, and feedback-report tool for a university consulting club.
Coaches pick a case from a sorted library, administer it to a candidate section by section while
taking notes, and finish with a report built from those notes. The full specification is in
`case-desk-spec.md` at the repo root; it is the source of truth for intent, and section references
like "(§8.1)" in code comments point at it.

## The one constraint that shapes everything

**Zero recurring cost.** No paid APIs, no LLM calls, no metered services — ever. Feedback drafting
is deterministic: it reads a phrase bank and the coach's starred notes. If a feature seems to want
a model call, it is the wrong feature. Everything runs on free tiers (Supabase, Vercel, Gmail SMTP).

## Layout

The repo root is `casedesk/`. **The app lives in `workspace/`** — run every npm command from there.
Vercel's Root Directory is set to `workspace` for the same reason.

```
casedesk/
  case-desk-spec.md     the spec
  CLAUDE.md             this file
  workspace/            the Next.js app
```

## Stack

Next.js 15 App Router · React 19 · TypeScript · Tailwind v3 · Prisma 6 · Supabase (Postgres, Auth,
Storage) · react-pdf · Recharts · nodemailer.

**Turbopack, not webpack** (`next dev --turbopack`, `next build --turbopack`). This is deliberate:
webpack could not resolve react-pdf's CJS wrapper around pdf.js's ESM build, which surfaced as
`Object.defineProperty called on non-object`. Do not switch it back.

## Setup on a new machine

```bash
git clone https://github.com/dlxiao24/casedesk.git
cd casedesk/workspace
npm install
cp .env.example .env    # then fill it in
npm run dev
```

`npm install` also copies the pdf.js worker into `public/` and generates the Prisma client — both
are gitignored build outputs, so the install is not optional.

`.env` is the only thing that does not travel with the clone. Every key is documented in
`.env.example`; values come from Supabase (Settings → Database for the connection strings,
Settings → API for the keys).

**Do not run `db:push` or `db:seed` against the live database** — it already holds the club's real
cases, candidates and sessions. `db:seed` is for a fresh local Postgres only.

## Deployment

- Live at **https://consultingcasedesk.vercel.app** (the old `casedesk-beige.vercel.app` alias
  307s to it, so previously shared report links still work — do not delete that alias).
- **Push to `main` deploys.** There is no separate deploy step.
- **Vercel snapshots environment variables into a deployment.** Changing one in the dashboard does
  nothing until a redeploy. This has cost real debugging time twice; if something env-related
  "isn't working", check whether a build has happened since the change.
- Supabase project ref `esfmivbzslqbcvmqxtex`. Auth redirect URLs must list
  `https://consultingcasedesk.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.

## Access model

Three levels, only one self-served:

- **Guest** — signed out. Reads the cases an admin flagged `sampleForGuests`, sees blurred
  placeholders where the rest would be, and can run one against a shared "Sample User". Their
  session belongs to a cookie (`Session.guestKey`), so it is theirs alone and stays out of coaches'
  lists.
- **Coach** — anyone who confirms an email. Reads the whole case library, runs cases against
  candidates they add, and reads back only the sessions they ran themselves. Keeps their own notes
  and readiness. Cannot add or split cases.
- **Admin** — granted only by another admin on Settings → Coaches. Adds casebooks and cases,
  sees every candidate, permanently deletes archived records.

Current admins: `dlxiao@umich.edu`, `rishigar@umich.edu`. (`newsap97@gmail.com` is a coach.)

## Decisions worth knowing before changing things

- **Server Components and Server Actions throughout.** No REST route handlers except
  `/auth/callback`.
- **`prisma db push`, no migration files.** Destructive changes need `--accept-data-loss`; prefer a
  non-destructive path and leave the drop to the user.
- **Case attribute columns on `Case` are cached averages**, not anybody's opinion. The real ratings
  live in `CaseRating`, one row per coach, and `recomputeCaseAverages()` rewrites the cache on
  every write. They are cached rather than derived so the library's filters and sorts stay ordinary
  SQL. Each attribute averages only over the coaches who answered *that* attribute.
- **Sessions and candidates are private to the coach who owns them; admins see everything.**
  `src/lib/sessionAccess.ts` and `src/lib/candidateAccess.ts` are the two scopes, and both narrow
  spec §2 for the same reason: sign-up is open, so "every coach" now means "anyone who confirms an
  email". Any list that links into a session has to apply the scope, or it offers a link the page
  then refuses — and anything handed to a client component is scoped at the query, since what is
  not rendered still ships.
- **`src/lib/loadReport.ts` is the single place session data becomes candidate-facing.** Interviewer
  guides, personal notes and case-quality ratings are excluded there. Anything new that reaches a
  candidate should go through it.
- **Blurred guest rows carry invented company names, not real titles.** A blur is paint — whatever
  is under it still ships to the browser. For the same reason the guest library offers no filters
  and no search: filtering a small window is enumeration.
- **Signed storage URLs are minted from a caller-supplied key**, so a guest's key is checked
  against the shop window before signing.
- **Sign-in does a full document load**, not `router.push` — a soft navigation can serve pages the
  browser cached while signed out.
- Two system rows exist and are hidden from every coach-facing list: the `Guest` user and the
  `Sample User` candidate (`src/lib/guest.ts` has their fixed ids).

## Local development quirks

- **`DEV_COACH_EMAIL=you@example.com npm run dev`** treats every request as that coach, skipping
  auth. Refuses to work when `NODE_ENV=production`. Caveat: it cannot obtain Supabase signed URLs,
  so **casebook PDFs do not render in that mode** — that is expected, not a bug.
- **Windows + OneDrive**: this project has lived under `OneDrive\Documents`, where OneDrive's
  syncing intermittently breaks Next's build cache with `EINVAL: readlink` on `.next`. Cloning
  somewhere like `C:\dev\casedesk` avoids it.
- **The dev server holds the Prisma engine DLL open.** `prisma generate` and `prisma db push` fail
  with `EPERM` while it runs — stop it first, and remember to restart it afterwards.
- **Git push 403?** Windows Credential Manager may authenticate as a different GitHub account.
  Fix with `git config --local credential.useHttpPath true`.

## Conventions

- Run `npx tsc --noEmit` and `npm run build` before committing.
- Comments explain *why*, especially where the code looks odd — most of the strange-looking code
  here is load-bearing and the comment says what broke without it.
- Commit messages: a short imperative subject, then prose explaining the reasoning. Not bullet
  lists of files changed.
- Mail: the **Contact me** header button sends to `casedeskadmin@gmail.com` via `SMTP_USER` /
  `SMTP_PASS` (a Gmail app password). Every message is written to `FeedbackMessage` before sending,
  so nothing is lost if mail breaks; Settings shows an admin what the mail server last said.
