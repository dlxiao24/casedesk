"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import type { Dimension, TakeawayKind } from "@prisma/client";
import { appendPersonalNote, rateCase } from "@/actions/cases";
import {
  draftForSession,
  reopenSession,
  setOverallNote,
  setScore,
  setTakeaway,
} from "@/actions/sessions";
import { ScoreBar, formatScore } from "@/components/ScoreBar";
import { Segmented } from "@/components/Segmented";
import { CASE_ATTRIBUTES } from "@/lib/constants";
import type { RatedKey, RatingValues } from "@/lib/caseRatings";
import { DIMENSIONS } from "@/lib/constants";
import { SaveIndicator, useAutosave, useKeyedAutosave } from "@/lib/useAutosave";

type Takeaway = { kind: TakeawayKind; rank: number; text: string };

/** One screen, no wizard (§7). */
export function WrapUp({
  sessionId,
  caseId,
  locked,
  myRating: initialRating,
  ratingCount,
  caseQuality,
  existingPersonalNotes,
  /** A guest has no library of their own to rate cases or keep notes in. */
  canKeepNotes,
  scores: initialScores,
  takeaways: initialTakeaways,
  overallNote: initialOverall,
}: {
  sessionId: string;
  caseId: string;
  locked: boolean;
  myRating: RatingValues;
  ratingCount: number;
  caseQuality: number | null;
  existingPersonalNotes: string;
  canKeepNotes: boolean;
  scores: Partial<Record<Dimension, number>>;
  takeaways: Takeaway[];
  overallNote: string;
}) {
  const router = useRouter();
  const [scores, setScores] = useState(initialScores);
  const [items, setItems] = useState<Takeaway[]>(initialTakeaways);
  const takeawaySaverRef = useRef<{ isSettled: () => boolean } | null>(null);
  // Re-sync when the server sends a different set — after a reopen, or when a
  // second tab edited the same session.
  const serverItems = JSON.stringify(initialTakeaways);
  useEffect(() => {
    // A refresh anywhere on this screen re-runs the server component. Accepting
    // its takeaways while edits are still in flight is what used to blank the
    // boxes, so defer to the server only once everything local has landed.
    if (!takeawaySaverRef.current?.isSettled()) return;
    setItems(JSON.parse(serverItems) as Takeaway[]);
  }, [serverItems]);
  const [overall, setOverall] = useState(initialOverall);
  const [rating, setRating] = useState<RatingValues>(initialRating);
  const [ratingRestOpen, setRatingRestOpen] = useState(false);

  /**
   * Rating a case is one coach's vote, not the owner's decree, so this writes
   * to the person's own rating and the library shows the average. Saved a
   * field at a time, like everything else on this page.
   */
  function rate(key: RatedKey, value: number | null) {
    setRating((r) => ({ ...r, [key]: value }));
    startSave(async () => {
      await rateCase(caseId, { [key]: value });
    });
  }
  const [caseNote, setCaseNote] = useState("");
  const [drafting, startDraft] = useTransition();
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [, startSave] = useTransition();

  const overallSaver = useAutosave<string>((v) => setOverallNote(sessionId, v));
  const takeawaySaver = useKeyedAutosave<Takeaway>((t) =>
    setTakeaway(sessionId, t.kind, t.rank, t.text),
  );
  takeawaySaverRef.current = takeawaySaver;

  function textFor(kind: TakeawayKind, rank: number) {
    return items.find((t) => t.kind === kind && t.rank === rank)?.text ?? "";
  }

  function updateTakeaway(kind: TakeawayKind, rank: number, text: string) {
    setItems((list) => {
      const rest = list.filter((t) => !(t.kind === kind && t.rank === rank));
      return [...rest, { kind, rank, text }];
    });
    takeawaySaver.schedule(`${kind}:${rank}`, { kind, rank, text });
  }

  return (
    <div className={clsx("space-y-6", locked && "opacity-90")}>
      {locked && (
        <div className="flex items-center gap-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
          <span className="text-warn">
            Shared, so this is read-only. Reopening stamps the report “revised”.
          </span>
          <button
            className="btn ml-auto py-0.5"
            onClick={() => {
              if (
                window.confirm("The candidate may have already seen this version. Reopen anyway?")
              ) {
                startSave(async () => {
                  await reopenSession(sessionId);
                  router.refresh();
                });
              }
            }}
          >
            Reopen
          </button>
        </div>
      )}

      {/* 1. Rubric */}
      <section>
        <h2 className="text-sm text-ink">Rubric</h2>
        <dl className="mt-2 divide-y divide-rule rounded border border-rule">
          {DIMENSIONS.map((d) => (
            <div key={d.value} className="flex items-center gap-3 px-3 py-2">
              <dt className="w-56 text-sm text-ink" title={d.anchor}>
                {d.label}
                <span className="block text-2xs text-faint">{d.anchor}</span>
              </dt>
              <dd className="ml-auto">
                <Segmented
                  name={d.label}
                  disabled={locked}
                  value={scores[d.value] ?? null}
                  onChange={(v) => {
                    setScores((s) => ({ ...s, [d.value]: v ?? undefined }));
                    startSave(async () => {
                      await setScore(sessionId, d.value, v);
                    });
                  }}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 2. Takeaways */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm text-ink">Takeaways</h2>
          <div className="flex items-center gap-2">
            {draftMessage && <span className="text-2xs text-faint">{draftMessage}</span>}
            <SaveIndicator state={takeawaySaver.state} />
            <button
              className="btn"
              disabled={locked || drafting}
              onClick={() =>
                startDraft(async () => {
                  const result = await draftForSession(sessionId);
                  setItems(result.takeaways);
                  setDraftMessage(
                    result.drafted === 0
                      ? "Nothing to draft — score the rubric first, or the slots are already filled."
                      : `Drafted ${result.drafted}${result.starred ? `, including ${result.starred} starred note${result.starred === 1 ? "" : "s"}` : ""}. Rewrite freely.`,
                  );
                  router.refresh();
                })
              }
            >
              {drafting ? "Drafting…" : "Draft takeaways"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-2xs text-faint">
          Drafts come from the phrase bank and your starred session notes. They are a starting
          point, not a verdict — rewrite them.
        </p>

        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <TakeawayColumn
            title="Top 3 to continue"
            kind="CONTINUE"
            locked={locked}
            textFor={textFor}
            onChange={updateTakeaway}
          />
          <TakeawayColumn
            title="Top 3 to work on"
            kind="IMPROVE"
            locked={locked}
            textFor={textFor}
            onChange={updateTakeaway}
          />
        </div>
      </section>

      {/* 3. Overall */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm text-ink">Overall note</h2>
          <SaveIndicator state={overallSaver.state} />
        </div>
        <textarea
          rows={4}
          disabled={locked}
          className="field prose-notes mt-2 leading-relaxed"
          placeholder="The one thing you would say to this candidate if you only had a sentence."
          value={overall}
          onChange={(e) => {
            setOverall(e.target.value);
            overallSaver.schedule(e.target.value);
          }}
        />
      </section>

      {/* 4. On the case itself — deliberately walled off from the candidate-facing
          fields above, because none of it ever reaches the candidate (§7). The
          whole panel is about keeping the library, so a guest never sees it. */}
      {canKeepNotes && (
      <section className="rounded border border-dashed border-rule bg-panel/60 p-3">
        <h2 className="text-sm text-ink">On the case itself</h2>
        <p className="mt-0.5 text-2xs text-faint">
          Not part of the feedback. Nothing here appears in the report.
        </p>

        {/* The one question worth asking every time, up front. You have just
            run the case, so this is the moment your answer is worth most. */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Would you give this again?</span>
          <Segmented
            name="Would you give this again?"
            value={rating.caseQuality ?? null}
            onChange={(v) => rate("caseQuality", v)}
          />
          {caseQuality !== null && ratingCount > 0 && (
            <span className="flex items-center gap-1.5 text-2xs text-faint">
              <ScoreBar
                value={caseQuality}
                size="xs"
                tone="good"
                name="Club average"
                ratingCount={ratingCount}
              />
              {formatScore(caseQuality)} across {ratingCount}{" "}
              {ratingCount === 1 ? "coach" : "coaches"}
            </span>
          )}
        </div>

        {/* The other six, folded away. Most people will answer the question
            above and move on; the ones who want to say more can. */}
        <div className="mt-2">
          <button
            className="text-2xs text-accent hover:underline"
            aria-expanded={ratingRestOpen}
            onClick={() => setRatingRestOpen((o) => !o)}
          >
            {ratingRestOpen ? "Hide the rest" : "Rate the rest of the case"}
          </button>

          {ratingRestOpen && (
            <dl className="mt-2 space-y-2 border-t border-rule pt-2">
              {CASE_ATTRIBUTES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd>
                    <Segmented
                      name={label}
                      value={rating[key as RatedKey] ?? null}
                      onChange={(v) => rate(key as RatedKey, v)}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="caseNote">
            Note to self about this case
          </label>
          <textarea
            id="caseNote"
            rows={3}
            className="field prose-notes mt-1"
            placeholder="Exhibit 3 is unreadable. Casebook math is wrong — 4.2M, not 4.8M."
            value={caseNote}
            onChange={(e) => setCaseNote(e.target.value)}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              className="btn"
              disabled={!caseNote.trim()}
              onClick={() =>
                startSave(async () => {
                  // Flush first: the refresh below pulls takeaways from the
                  // server, and anything still queued would be lost.
                  await takeawaySaver.flush();
                  await appendPersonalNote(caseId, caseNote);
                  setCaseNote("");
                  router.refresh();
                })
              }
            >
              Add to my notes
            </button>
            <span className="text-2xs text-faint">
              Appends with today&apos;s date. Private to you, forever.
            </span>
          </div>
          {existingPersonalNotes.trim() && (
            <details className="mt-2">
              <summary className="cursor-pointer text-2xs text-faint">
                My existing notes on this case
              </summary>
              <p className="prose-notes mt-1 whitespace-pre-wrap text-sm text-muted">
                {existingPersonalNotes}
              </p>
            </details>
          )}
        </div>
      </section>
      )}
    </div>
  );
}

function TakeawayColumn({
  title,
  kind,
  locked,
  textFor,
  onChange,
}: {
  title: string;
  kind: TakeawayKind;
  locked: boolean;
  textFor: (kind: TakeawayKind, rank: number) => string;
  onChange: (kind: TakeawayKind, rank: number, text: string) => void;
}) {
  return (
    <div>
      <h3 className="label">{title}</h3>
      <ol className="mt-1 space-y-1.5">
        {[1, 2, 3].map((rank) => (
          <li key={rank} className="flex gap-2">
            <span className="tabular pt-2 text-2xs text-faint">{rank}</span>
            {/* Controlled, with a key that does NOT include the text. Keying on
                the value remounts the textarea on every keystroke, which drops
                focus after a single letter. */}
            <textarea
              key={`${kind}-${rank}`}
              rows={2}
              disabled={locked}
              className="field prose-notes leading-relaxed"
              value={textFor(kind, rank)}
              onChange={(e) => onChange(kind, rank, e.target.value)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
