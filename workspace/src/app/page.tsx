import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { knownFirms } from "@/lib/library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "A sorted library of practice cases, and the tools to run one properly — structured cases, notes as you go, and a report built from them.",
};

/**
 * The front door.
 *
 * Everyone lands here, signed in or not; the only thing that changes is what
 * the buttons offer. The wordmark is lowercase and one word, so the copy on
 * this page is too, whatever the browser tab says.
 */
export default async function Home() {
  const [user, caseCount, casebookCount, firms] = await Promise.all([
    currentUser(),
    db.case.count({ where: { archived: false } }),
    db.casebook.count(),
    knownFirms(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <Image
        src="/logo.png"
        alt="casedesk"
        width={935}
        height={685}
        priority
        className="h-20 w-auto"
      />

      {/* The delays are set inline rather than in a class because they are
          positional — the nth word waits n steps — and that is data, not
          style. See `.rise-in` in globals.css. */}
      {/* Real spaces between the words, not a flex gap. A gap would look the
          same and read as "Welcometocasedesk" to a screen reader, and copy out
          of the page that way too. */}
      <h1 className="rise-in mt-8 text-4xl tracking-tight sm:text-5xl">
        <span className="inline-block text-ink" style={{ animationDelay: "0ms" }}>
          Welcome
        </span>{" "}
        <span className="inline-block text-ink" style={{ animationDelay: "90ms" }}>
          to
        </span>{" "}
        <span className="inline-block" style={{ animationDelay: "180ms" }}>
          {/* Two-tone, the way the wordmark itself is drawn. */}
          <span className="text-ink">case</span>
          <span className="text-accent">desk!</span>
        </span>
      </h1>

      <div className="rise-in">
        <p
          className="mt-5 max-w-xl text-lg leading-relaxed text-muted"
          style={{ animationDelay: "300ms" }}
        >
          A sorted library of practice cases, and the tools to run one properly.
        </p>
      </div>

      <div className="rise-in mt-8 flex flex-wrap items-center gap-3">
        {user ? (
          <>
            <span className="inline-block" style={{ animationDelay: "400ms" }}>
              <Link href="/library" className="btn btn-primary">
                Go to your library
              </Link>
            </span>
            <span className="inline-block text-sm text-faint" style={{ animationDelay: "460ms" }}>
              Signed in as {user.name}.
            </span>
          </>
        ) : (
          <>
            <span className="inline-block" style={{ animationDelay: "400ms" }}>
              <Link href="/library" className="btn">
                Continue as guest
              </Link>
            </span>
            <span className="inline-block" style={{ animationDelay: "460ms" }}>
              <Link href="/login" className="btn">
                Sign in
              </Link>
            </span>
            <span className="inline-block" style={{ animationDelay: "520ms" }}>
              <Link href="/signup" className="btn btn-primary">
                Create account
              </Link>
            </span>
          </>
        )}
      </div>

      {caseCount > 0 && (
        <p className="tabular mt-6 text-2xs text-faint">
          {caseCount} cases · {casebookCount} casebook{casebookCount === 1 ? "" : "s"}
          {firms.length > 0 && ` · ${firms.length} firms represented`}
        </p>
      )}

      <section className="mt-20 border-t border-rule pt-8">
        <h2 className="text-xl text-ink">What is casedesk?</h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-muted">
          <p>
            casedesk is a database of practice cases, consolidated from several credible casebooks
            and sorted into fixed categories — the firm a case comes from or imitates, its type,
            its industry, the round it suits, and ratings for how difficult, how quantitative and
            how creative it is. The point of the sorting is that the case you pull is the case you
            meant to practise, rather than whichever one you happened to open.
          </p>
          <p>
            It is built around the person <em className="not-italic text-ink">running</em> the
            interview, not only the person sitting it. Cases arrive already structured — the
            prompt, each exhibit, the maths, the brainstorm, the synthesis — so you are not
            scrolling a PDF hunting for the next thing to say. Every step has somewhere to write
            what the candidate said and what you would tell them, and when you finish, the report
            is assembled out of those notes rather than out of memory.
          </p>
        </div>
      </section>

      <section className="mt-14 border-t border-rule pt-8">
        <h2 className="text-xl text-ink">How to use casedesk?</h2>
        <ol className="mt-5 space-y-6">
          <Step n={1} title="Find the case you actually want">
            Sort and filter the library the way you are searching — a specific firm, a case type,
            an industry, how hard it is, or which skill it leans on: quantitative load, creativity,
            structure, ambiguity, data density. Every column sorts, and the filters stack.
          </Step>
          <Step n={2} title="Administer it to someone">
            Pick a person and start. The case runs section by section with a timer going, showing
            you the interviewer&apos;s material while the candidate sees only what they are meant
            to. You take notes on what they said and what you would tell them as you go, and rate
            the case itself while it is still fresh.
          </Step>
          <Step n={3} title="Watch them get better">
            Every candidate keeps their own record, so the fourth time you case someone you can see
            what they scored the first three times, what you told them, and whether it stuck.
            Finish a session and the feedback report is built from your notes — share it as a link
            or print it to PDF.
          </Step>
        </ol>
      </section>

      {!user && (
        <section className="mt-14 flex flex-wrap items-center gap-3 rounded border border-rule bg-panel px-4 py-3">
          <p className="text-sm text-muted">
            Have a look around first — a few cases are open without an account.
          </p>
          <span className="flex-1" />
          <Link href="/library" className="btn">
            Continue as guest
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Create account
          </Link>
        </section>
      )}
    </main>
  );
}

/** Body copy comes in as children, where JSX collapses the source
 *  indentation to single spaces. As a string attribute it would not. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="tabular mt-1 shrink-0 text-2xs text-accent">{n}</span>
      <div>
        <h3 className="text-base text-ink">{title}</h3>
        <p className="mt-1 text-base leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
