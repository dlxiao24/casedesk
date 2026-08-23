"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import type { Band, Dimension, TakeawayKind } from "@prisma/client";
import { createPhrase, setPhraseActive, updatePhrase } from "@/actions/phrases";
import { BANDS, DIMENSIONS } from "@/lib/constants";

type Phrase = {
  id: string;
  dimension: Dimension;
  band: Band;
  kind: TakeawayKind;
  text: string;
  active: boolean;
};

export function PhraseBank({ phrases }: { phrases: Phrase[] }) {
  const router = useRouter();
  const [dimension, setDimension] = useState<Dimension>("STRUCTURE");
  const [band, setBand] = useState<Band>("LOW");
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<TakeawayKind>("IMPROVE");
  const [pending, start] = useTransition();

  const shown = useMemo(
    () => phrases.filter((p) => p.dimension === dimension && p.band === band),
    [band, dimension, phrases],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {DIMENSIONS.map((d) => (
          <button
            key={d.value}
            className={clsx("btn", dimension === d.value && "border-accent/60 bg-accent/10")}
            onClick={() => setDimension(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {BANDS.map((b) => (
          <button
            key={b.value}
            className={clsx("btn", band === b.value && "border-accent/60 bg-accent/10")}
            onClick={() => setBand(b.value)}
          >
            {b.label} <span className="tabular text-2xs text-faint">{b.range}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["CONTINUE", "IMPROVE"] as TakeawayKind[]).map((k) => (
          <div key={k}>
            <h2 className="label">{k === "CONTINUE" ? "Keep doing" : "Work on"}</h2>
            <ul className="mt-1 space-y-1">
              {shown
                .filter((p) => p.kind === k)
                .map((p) => (
                  <PhraseRow key={p.id} phrase={p} onChanged={() => router.refresh()} />
                ))}
              {shown.filter((p) => p.kind === k).length === 0 && (
                <li className="text-2xs text-faint">Nothing here yet.</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded border border-rule bg-panel p-3">
        <h2 className="text-sm text-ink">Add a phrase</h2>
        <div className="flex gap-2">
          <select
            className="field w-auto"
            value={kind}
            onChange={(e) => setKind(e.target.value as TakeawayKind)}
          >
            <option value="IMPROVE">Work on</option>
            <option value="CONTINUE">Keep doing</option>
          </select>
          <input
            className="field flex-1"
            placeholder="Set up the math before computing — state the equation, then plug in."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={pending || !draft.trim()}
            onClick={() =>
              start(async () => {
                await createPhrase({ dimension, band, kind, text: draft });
                setDraft("");
                router.refresh();
              })
            }
          >
            Add
          </button>
        </div>
        <p className="text-2xs text-faint">
          Goes into {DIMENSIONS.find((d) => d.value === dimension)?.label} ·{" "}
          {BANDS.find((b) => b.value === band)?.label}.
        </p>
      </div>
    </div>
  );
}

function PhraseRow({ phrase, onChanged }: { phrase: Phrase; onChanged: () => void }) {
  const [text, setText] = useState(phrase.text);
  const [pending, start] = useTransition();
  const dirty = text.trim() !== phrase.text;

  return (
    <li className={clsx("flex items-start gap-1.5", !phrase.active && "opacity-50")}>
      <textarea
        rows={2}
        className="field prose-notes text-sm leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <span className="flex shrink-0 flex-col gap-1">
        <button
          className="btn btn-quiet px-1 py-0 text-2xs"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              await updatePhrase(phrase.id, text);
              onChanged();
            })
          }
        >
          Save
        </button>
        <button
          className="btn btn-quiet px-1 py-0 text-2xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setPhraseActive(phrase.id, !phrase.active);
              onChanged();
            })
          }
          title="Deactivated phrases stop being drafted but stay in past sessions."
        >
          {phrase.active ? "Off" : "On"}
        </button>
      </span>
    </li>
  );
}
