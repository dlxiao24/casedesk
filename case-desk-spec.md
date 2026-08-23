# Case Desk — Build Spec

*A case-interview library and live administration tool for consulting club coaches.*

---

## 1. What this is

A web app used by a small group of coaches at a university consulting club. It does three things:

1. **Library** — store case interviews sourced from casebook PDFs, tagged by skill focus and difficulty, filterable, with a per-coach readiness state so a coach knows which cases they can competently deliver.
2. **Runner** — a keyboard-driven live interface for administering a case to a candidate, capturing structured notes and timing per section.
3. **Feedback** — turn a completed session into a clean, printable feedback document for the candidate, assembled from rubric scores and notes.

**Hard constraint: zero recurring cost.** No paid APIs, no paid tiers. Everything must run on free tiers. Where a feature would normally call an LLM, use a deterministic alternative (specified below).

**Primary user:** a coach running 3–8 practice cases per week, often back-to-back, sometimes over Zoom.

**Success test:** after a 40-minute case, the coach spends under 5 minutes producing a feedback doc they'd be happy to send.

---

## 2. Users and auth

- Coaches only. Candidates never log in. Candidates receive feedback as a PDF/link, out of band.
- Invite-only. No public signup page.
- Auth: **Supabase Auth**, email + magic link. Free tier covers 50k MAU; we'll use ~10.
- Two roles:
  - `admin` — can invite coaches, edit/delete any case, manage the phrase bank.
  - `coach` — can create cases, run sessions, see all cases and all sessions.
- All coaches see the full case library. Sessions are visible to all coaches (this is deliberate — coaches should be able to see that a candidate already did Market Entry with someone else last week).

---

## 3. Data model

Prisma-flavored. Postgres.

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  role        Role     @default(COACH)
  createdAt   DateTime @default(now())
  sessions    Session[]
  ownedCases  Case[]
  coachCases  CoachCase[]
}

enum Role { ADMIN COACH }

// ---------- Library ----------

model Casebook {
  id          String   @id @default(cuid())
  title       String              // "Kellogg 2023"
  school      String?
  year        Int?
  fileKey     String              // Supabase Storage object key
  pageCount   Int
  uploadedBy  String
  createdAt   DateTime @default(now())
  cases       Case[]
}

model Case {
  id            String   @id @default(cuid())
  casebookId    String
  casebook      Casebook @relation(fields: [casebookId], references: [id], onDelete: Cascade)
  title         String
  startPage     Int
  endPage       Int

  caseType      CaseType
  industry      String?
  targetRound   TargetRound?      // FIRST_ROUND, FINAL_ROUND, SCREENING
  format        CaseFormat        // INTERVIEWER_LED, INTERVIEWEE_LED

  ownerId       String            // whoever added the case; owns its ratings
  owner         User     @relation(fields: [ownerId], references: [id])

  // Attributes of the case itself, 1-5. Set by the owner only.
  quantIntensity      Int?
  creativityLoad      Int?
  structureDifficulty Int?
  ambiguity           Int?
  dataDensity         Int?
  overallDifficulty   Int?

  // Verdict on the case as a teaching tool, not a property of its content.
  // 1 = don't give this again, 5 = go-to case. Only meaningful post-delivery.
  caseQuality         Int?

  notes         String?           // shared prep notes, markdown, owner-editable
  archived      Boolean  @default(false)
  createdAt     DateTime @default(now())

  sections      Section[]
  sessions      Session[]
  coachCases    CoachCase[]
}

enum CaseType {
  PROFITABILITY MARKET_ENTRY MA GROWTH PRICING
  COST_REDUCTION OPERATIONS MARKET_SIZING NEW_PRODUCT OTHER
}
enum TargetRound { SCREENING FIRST_ROUND FINAL_ROUND }
enum CaseFormat { INTERVIEWER_LED INTERVIEWEE_LED }

model Section {
  id          String      @id @default(cuid())
  caseId      String
  case        Case        @relation(fields: [caseId], references: [id], onDelete: Cascade)
  kind        SectionKind
  label       String              // "Exhibit 2 — Regional volumes"
  order       Int
  startPage   Int?                // page range within the parent casebook PDF
  endPage     Int?
  bodyText    String?             // optional typed/pasted text, overrides PDF view
  isSolution  Boolean @default(false)  // hidden from view until coach reveals
  targetMins  Int?                // guidance only, drives pacing hints in runner
}

enum SectionKind {
  PROMPT CLARIFYING STRUCTURE EXHIBIT MATH
  BRAINSTORM SYNTHESIS SOLUTION INTERVIEWER_GUIDE
}

// One row per (coach, case). Holds everything personal to a coach about a case:
// readiness state and their own scratch notes. Created lazily on first interaction.
model CoachCase {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id])
  caseId        String
  case          Case           @relation(fields: [caseId], references: [id], onDelete: Cascade)

  state         ReadinessState @default(UNREAD)

  // Private scratch notes. Not shown to other coaches, never in candidate reports.
  // For the things ratings can't hold: "exhibit 2 confuses everyone",
  // "math is wrong in the casebook — answer is 4.2M not 4.8M",
  // "great for finance kids, brutal for first-years".
  personalNotes String?

  updatedAt     DateTime       @updatedAt
  @@unique([userId, caseId])
}

enum ReadinessState { UNREAD READ PRACTICED DELIVERED }

// ---------- Sessions ----------

model Candidate {
  id         String   @id @default(cuid())
  name       String
  email      String?
  cohort     String?           // "Fall 2026 pledge class"
  year       String?           // "Sophomore"
  notes      String?
  archived   Boolean  @default(false)
  createdAt  DateTime @default(now())
  sessions   Session[]
}

model Session {
  id           String   @id @default(cuid())
  caseId       String
  case         Case     @relation(fields: [caseId], references: [id])
  candidateId  String
  candidate    Candidate @relation(fields: [candidateId], references: [id])
  coachId      String
  coach        User     @relation(fields: [coachId], references: [id])

  status       SessionStatus @default(IN_PROGRESS)
  startedAt    DateTime @default(now())
  endedAt      DateTime?
  totalSeconds Int?

  locked       Boolean  @default(false)  // set true on share; cleared by explicit reopen
  reopenedAt   DateTime?
  archived     Boolean  @default(false)  // soft delete; no hard delete in the UI

  scores       Score[]
  sectionNotes SectionNote[]
  takeaways    Takeaway[]
  overallNote  String?
  sharedAt     DateTime?
}

enum SessionStatus { IN_PROGRESS COMPLETE ABANDONED }

model SectionNote {
  id           String  @id @default(cuid())
  sessionId    String
  session      Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sectionId    String
  whatWasSaid  String  @default("")
  feedback     String  @default("")
  secondsSpent Int     @default(0)
  @@unique([sessionId, sectionId])
}

model Score {
  id        String    @id @default(cuid())
  sessionId String
  session   Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  dimension Dimension
  value     Int       // 1-5
  @@unique([sessionId, dimension])
}

enum Dimension { STRUCTURE QUANTITATIVE JUDGMENT SYNTHESIS PRESENCE }

model Takeaway {
  id        String       @id @default(cuid())
  sessionId String
  session   Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  kind      TakeawayKind
  rank      Int          // 1-3
  text      String
}

enum TakeawayKind { CONTINUE IMPROVE }

// ---------- Phrase bank (powers non-AI feedback drafting) ----------

model Phrase {
  id        String    @id @default(cuid())
  dimension Dimension
  band      Band      // which score range this phrase applies to
  kind      TakeawayKind
  text      String
  active    Boolean   @default(true)
}

enum Band { LOW MID HIGH }   // 1-2, 3, 4-5
```

---

## 4. Feature: casebook upload and case sectioning

This is the highest-risk surface. If adding a case takes more than ~2 minutes, the library never gets built and the product dies. Optimize aggressively for speed.

### 4.1 Upload
- Coach uploads one PDF per **casebook** (not per case). Store in Supabase Storage.
- Extract `pageCount` and per-page text via **pdf.js in the browser**. Persist the extracted text per page in a `pageText` JSON column on `Casebook` so sectioning doesn't re-parse.
- Slide screenshots (PNG/JPG) are also accepted: multiple images upload as an ordered set and are treated identically to PDF pages. Internally normalize to "a page sequence with an optional text layer."

### 4.2 Splitting a casebook into cases
- Show a virtualized thumbnail grid of all pages.
- Coach drags a range or shift-clicks a start and end page, names the case, saves. Repeat.
- **Free heuristic assist:** scan the extracted page text for lines matching `/^case\s*\d+/i`, `/^\d+\.\s+[A-Z]/`, or a page containing both a short title and the word "prompt" / "case background." Pre-mark those pages as likely case starts with a subtle badge. The coach confirms; nothing is auto-committed.

### 4.3 Splitting a case into sections
- Same thumbnail grid, scoped to the case's page range.
- Coach clicks a page, then presses a number key to assign a section kind (`1` Prompt, `2` Exhibit, `3` Math, `4` Brainstorm, `5` Synthesis, `6` Solution, `7` Interviewer guide). Assigned pages get a colored spine. Contiguous pages of the same kind auto-merge into one section.
- **Free heuristic assist:** keyword match per page — `exhibit`, `interviewer guide(ance)`, `question \d`, `solution`, `answer`, `sample structure`, `math`, `calculation`, `brainstorm` — and pre-select the matching kind. Coach overrides with one keypress.
- Sections can also be created by pasting text directly (`bodyText`), for cases not sourced from a PDF.
- Anything marked `isSolution` or `INTERVIEWER_GUIDE` is blurred by default in the runner until explicitly revealed.

### 4.4 Minimum viable case
A case is saved and runnable with only: title, casebook, page range. Everything else — ratings, section splits, target times — is optional and addable later, including mid-session. Never block a save on empty fields.

---

## 5. Feature: library

- Table/card view. Default sort: least recently delivered by the current coach.
- Filters: case type, industry, format, target round, source casebook, each 1–5 attribute (range slider), **case quality**, and **my readiness** (Unread / Read / Practiced / Delivered).
- Search across title, shared notes, my personal notes, and extracted page text.
- Each row shows: title, source, case type, difficulty, quant/creativity mini-bars, quality, my readiness chip, times delivered (club-wide), and a primary **Administer case** button.
- A row with a personal note gets a small marker; hovering it shows the note. Quality ≤ 2 dims the row and shows a quiet "low quality" chip — the point of the rating is to keep bad cases from resurfacing without deleting them.
- Case detail shows shared prep notes and, in a visually distinct panel, **my notes** — an always-editable textarea that autosaves. No save button, no modal. It should be as cheap to jot a note as it is to think of one.
- Readiness auto-advances: `UNREAD → READ` when a coach opens the case detail view; `→ DELIVERED` when they complete a session with it. `PRACTICED` is set manually (coach took the case themselves as a candidate). Coach can manually set any state.

---

## 6. Feature: the runner

The single most important screen. The coach is typing while listening. Every interaction must be reachable from the keyboard, and nothing may interrupt.

### 6.1 Layout
Three panes, resizable, persisted:

```
┌──────────────────────────┬───────────────────────────┐
│                          │  Section 3 of 7 · Math    │
│   PDF / exhibit view     │  ──────────────────────── │
│   (current section's     │  What was said            │
│    pages, scrollable)    │  [ textarea              ]│
│                          │                           │
│                          │  Feedback                 │
│                          │  [ textarea              ]│
├──────────────────────────┴───────────────────────────┤
│ 14:32 total · 4:10 this section · [◀ prev] [next ▶]  │
└──────────────────────────────────────────────────────┘
```

### 6.2 Behavior
- Session starts by picking a candidate (searchable combobox, "+ new candidate" inline — creating a candidate must not leave the flow).
- Timer starts on session start. Per-section elapsed time accrues to whichever section is active and is written to `SectionNote.secondsSpent`.
- **Autosave on every keystroke, debounced 500ms.** Optimistic local write first, then network. If the network fails, keep working and show a small persistent "saving…" / "offline — changes kept locally" indicator. Never show a blocking error.
- If `targetMins` is set and elapsed exceeds it, the section timer turns amber. No sound, no modal.
- Solution and interviewer-guide sections render blurred with a "Reveal" affordance (`R`).

### 6.3 Keyboard map
| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Move between "What was said" and "Feedback" |
| `Cmd/Ctrl + →` | Next section |
| `Cmd/Ctrl + ←` | Previous section |
| `Cmd/Ctrl + Enter` | Timestamp-stamp a new line in the focused field (`[12:04] `) |
| `Cmd/Ctrl + K` | Jump-to-section palette |
| `R` (when a note field is not focused) | Reveal/hide solution |
| `Space` (when not focused) | Pause/resume timer |
| `Cmd/Ctrl + S` | End case, go to wrap-up |

### 6.4 Recovery
If the tab closes mid-session, the session stays `IN_PROGRESS`. On next login, show a banner: "Resume session with [candidate] — started 14 minutes ago." All notes and elapsed time restore.

---

## 7. Feature: wrap-up and scoring

Reached via `Cmd+S` or the End case button. One screen, no wizard.

1. **Rubric.** Five dimensions, 1–5, as clickable segmented controls. Each has a one-line anchor descriptor shown on hover so scoring is consistent across coaches:
   - **Structure** — issue tree quality, MECE-ness, prioritization, hypothesis-driven.
   - **Quantitative** — setup, arithmetic accuracy, unit discipline, sanity-checking, interpreting the answer.
   - **Business judgment** — insight quality, creativity/idea breadth, awareness of real-world constraints.
   - **Synthesis & communication** — top-down, signposting, concise recommendation with support and risks.
   - **Presence** — poise under pushback, listening, pace, energy.
2. **Top 3 to continue / Top 3 to work on.** Six text inputs.
3. **Overall note.** Free text.
4. **On the case itself.** A compact strip, visually separated from the candidate-facing fields above so it's obviously not part of the feedback:
   - **Would you give this again?** 1–5. Writes to `Case.caseQuality`, but **only if the current coach is the case owner**. A non-owner sees the owner's rating read-only and is nudged toward the note field instead.
   - **Note to self about this case.** Appends to the coach's `CoachCase.personalNotes` with a date stamp. Pre-filled empty, never required.

   Immediately after delivering is the only moment a coach reliably remembers that exhibit 3 is unreadable or the casebook math is wrong. Asking then is the whole reason this data will exist; asking later means it won't.

### 7.1 Non-AI draft generation
When the coach clicks **Draft takeaways**:
- For each dimension, map its score to a band (1–2 LOW, 3 MID, 4–5 HIGH).
- Pull active `Phrase` rows matching (dimension, band, kind). Low bands feed `IMPROVE`; high bands feed `CONTINUE`.
- Rank: for `IMPROVE`, order dimensions ascending by score; for `CONTINUE`, descending. Take the top 3 of each.
- Populate the six inputs with the phrase text, **fully editable**. The coach is expected to rewrite these; the point is to eliminate the blank page, not to automate judgment.
- Additionally, prepend any `feedback` note the coach flagged during the session with a leading `*` — treat starred notes as candidate takeaways and surface them above phrase-bank suggestions.

Seed the phrase bank with ~4 phrases per (dimension × band × kind) — roughly 120 rows. Write these as real coaching language, specific and actionable ("Set up the math before computing — state the equation, then plug in"), not generic ("Improve your math"). Admins can edit them in a settings screen.

> **Optional, off by default:** a settings field for a personal Anthropic API key enabling a "Polish" button that rewrites the drafted takeaways in the coach's voice. Ship the app fully functional without it. No key, no calls, no cost. Do not build this in v1 — leave a clean seam.

---

## 8. Feature: feedback export

- Renders a print-optimized HTML page at `/sessions/[id]/report`.
- Contents: candidate name, case title (and source, unless suppressed), date, coach, duration; the five rubric scores as a small bar row; top 3 to continue; top 3 to work on; then a section-by-section table of the coach's **feedback** notes with time spent.
- **A "Session record" appendix at the end**, after the takeaways, containing the "what was said" notes section by section. Included by default; a toggle removes it. It goes last and under its own heading so the candidate reads the judgment first and the transcript second — the takeaways are the deliverable, the record is supporting material.
- Page-break before the appendix in print styles, so a candidate can hand someone the first two pages alone.
- Solution content, interviewer-guide content, `CoachCase.personalNotes`, and `Case.caseQuality` are **never** included in a report.
- Export = browser print-to-PDF, styled with `@media print`. No PDF library, no server-side rendering, no docx.
- "Copy as markdown" button for pasting into Slack or email.
- Optional: a public read-only link (unguessable token, revocable) so the candidate can view without a login.

### 8.1 Session lifecycle

- `IN_PROGRESS` → freely editable.
- `COMPLETE`, not yet shared → freely editable.
- **Sharing locks it.** Printing, copying as markdown, or generating a public link sets `sharedAt` and `locked = true`. All fields become read-only.
- **Reopen** is an explicit button with a one-line confirm: "The candidate may have already seen this version." Sets `locked = false`, stamps `reopenedAt`. The report footer then shows "Revised [date]."
- **Nothing is ever hard-deleted from the UI.** Sessions, candidates, and cases use their `archived` flag. Archived items are hidden from default views, reachable from an "Archived" filter, and restorable. Deleting a casebook is the one exception and requires an admin plus a typed confirmation, since it cascades to cases and sessions.

---

## 9. Feature: candidate profiles

`/candidates/[id]` shows:
- Every session, most recent first: date, case, coach, scores.
- A small line chart of each rubric dimension over time (Recharts).
- Cases already administered to this candidate — surfaced as a warning in the runner's case picker so no one repeats a case.

This is the feature that compounds. Don't cut it.

---

## 10. Tech stack

| Layer | Choice | Cost |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | $0 |
| Styling | Tailwind CSS | $0 |
| DB | Supabase Postgres (free tier) | $0 |
| ORM | Prisma | $0 |
| Auth | Supabase Auth, magic link | $0 |
| File storage | Supabase Storage (1GB free) | $0 |
| PDF rendering | pdf.js / `react-pdf` | $0 |
| Charts | Recharts | $0 |
| Hosting | Vercel Hobby | $0 |

**Storage discipline matters.** 1GB free. Storing one PDF per casebook rather than per case is the difference between ~50 and ~500 cases. Compress on upload where possible; warn at 80% capacity in an admin view.

Vercel Hobby is non-commercial-use only — fine for a student club tool, but do not put this behind a paywall.

---

## 11. Design direction

Not a spec for a look, a spec for a temperament: **this is an instrument, not a dashboard.** It gets used at 9pm by someone who has already run two cases and is tired.

- The runner should feel closer to a code editor than a SaaS product: dense, quiet, high-contrast text, no cards, no shadows, no gradients, minimal chrome. Everything that isn't the PDF or the two textareas should recede.
- The library can be more relaxed and browsable, but resist the "colorful stat cards at the top" reflex — the useful information is in the rows.
- One monospace utility face for timers, page numbers, and scores; a real body face for notes and reports. Numbers should be tabular-figure aligned so timers don't jitter.
- Score displays: small filled/unfilled segment bars, not stars, not emoji.
- The feedback report is the only artifact a non-coach ever sees. It should look like a document, not a webpage — generous margins, a clear hierarchy, printable to one or two pages.
- Quality floor: visible keyboard focus rings everywhere, `prefers-reduced-motion` respected, responsive down to tablet. Phone support for the runner is a non-goal.
- Copy: active voice, sentence case. Buttons name their outcome — "Administer case," "End case," "Draft takeaways." Empty states point at the next action ("No cases yet. Upload a casebook to get started.").

---

## 12. Build order

Ship each milestone working before starting the next.

1. **Skeleton** — Next.js + Supabase + Prisma + auth + invite flow. One coach can log in.
2. **Library CRUD** — create a case by typing fields only, no PDF. List, filter, edit. Proves the model.
3. **Runner + wrap-up** — sessions, section notes, timers, autosave, rubric, takeaways. Runnable end to end with typed-text cases.
4. **Report** — print view, markdown copy. *At this point the tool is genuinely usable — start using it for real and let real use drive milestones 5–6.*
5. **PDF pipeline** — casebook upload, page extraction, case splitting, section assignment, heuristic assists, PDF pane in the runner.
6. **Compounding** — candidate profiles, trend charts, repeat-case warnings, phrase bank admin, readiness auto-advance.

---

## 13. Non-goals for v1

State these explicitly so scope doesn't creep:
- Candidate logins or a candidate-facing portal
- Any paid API, any LLM call
- Real-time multi-coach collaboration on one session
- .docx or server-side PDF generation
- Mobile phone support for the runner
- Scheduling, calendar integration, or reminders
- Public/shared case library across schools
- Audio recording or transcription

---

## 14. Decisions already made

These are settled. Don't re-litigate them during the build.

- **Sessions lock on share, reopen is explicit.** See §8.1.
- **Soft delete everywhere.** No destructive delete in the UI except casebooks, admin-only, typed confirmation.
- **Case ratings are single-owner.** Whoever adds the case owns its 1–5 attributes and its quality score. Other coaches express disagreement through their own `CoachCase.personalNotes`, not by editing the ratings. Multi-coach or averaged ratings are a v2 question, and the data model already supports it — `CoachCase` is where a per-coach rating would live if it's ever wanted.
- **Personal notes are private and permanent.** Not visible to other coaches, not in reports, not deletable by anyone but their author.
- **Reports include the session record by default.** See §8.
