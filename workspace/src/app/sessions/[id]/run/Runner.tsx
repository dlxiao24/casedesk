"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import type { SectionKind } from "@prisma/client";
import { addSection, endSession, saveElapsed, saveSectionNote } from "@/actions/sessions";
import { SECTION_KINDS, isHiddenKind, sectionKindMeta } from "@/lib/constants";
import { clock } from "@/lib/format";
import { SaveIndicator, useAutosave } from "@/lib/useAutosave";
import { SectionPalette } from "./SectionPalette";

// pdf.js only exists in the browser.
const PdfPane = dynamic(() => import("./PdfPane").then((m) => m.PdfPane), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-faint">Loading pages…</div>,
});

export type RunnerSection = {
  id: string;
  kind: SectionKind;
  label: string;
  startPage: number | null;
  endPage: number | null;
  bodyText: string | null;
  isSolution: boolean;
  targetMins: number | null;
  whatWasSaid: string;
  feedback: string;
  secondsSpent: number;
};

/** A section in the main sequence, plus any companions pinned to it. */
export type RunnerStep = RunnerSection & { companions: RunnerSection[] };

type NoteState = Record<string, { whatWasSaid: string; feedback: string; secondsSpent: number }>;

/**
 * The runner (§6). Closer to a code editor than a SaaS product: dense, quiet,
 * keyboard-first. Nothing here is allowed to interrupt — no modals, no sounds,
 * no blocking errors.
 */
export function Runner({
  sessionId,
  caseId,
  caseTitle,
  candidateName,
  startedAt,
  resumedSeconds,
  fileUrl,
  casePages,
  sections: initialSections,
}: {
  sessionId: string;
  caseId: string;
  caseTitle: string;
  candidateName: string;
  startedAt: string;
  resumedSeconds: number;
  fileUrl: string | null;
  casePages: { start: number; end: number } | null;
  sections: RunnerStep[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState<NoteState>(() =>
    Object.fromEntries(
      // Companions keep their own notes even though they share a slot.
      initialSections
        .flatMap((s) => [s, ...s.companions])
        .map((s) => [
          s.id,
          { whatWasSaid: s.whatWasSaid, feedback: s.feedback, secondsSpent: s.secondsSpent },
        ]),
    ),
  );
  const notesRef = useRef<NoteState>({});
  notesRef.current = notes;
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [splitPct, setSplitPct] = useState(58);
  const [, startTransition] = useTransition();

  const active = sections[index];
  const saidRef = useRef<HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  // ---- Timers. Total accrues from the session start; per-section accrues to
  // whichever section is active (§6.2).
  const [total, setTotal] = useState(() =>
    Math.max(resumedSeconds, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
  );
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setTotal((v) => v + 1);
      const section = sections[indexRef.current];
      if (!section) return;
      setNotes((n) => ({
        ...n,
        [section.id]: {
          ...(n[section.id] ?? { whatWasSaid: "", feedback: "", secondsSpent: 0 }),
          secondsSpent: (n[section.id]?.secondsSpent ?? 0) + 1,
        },
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [paused, sections]);

  // ---- Persistence. Optimistic local write first, network second.
  const noteSaver = useAutosave<{
    sectionId: string;
    whatWasSaid: string;
    feedback: string;
    secondsSpent: number;
  }>(async (payload) => {
    const result = await saveSectionNote({ sessionId, ...payload });
    if (!result.ok) throw new Error(result.reason);
  });

  const persist = useCallback(
    (sectionId: string, patch: Partial<NoteState[string]>) => {
      setNotes((n) => {
        const merged = {
          ...(n[sectionId] ?? { whatWasSaid: "", feedback: "", secondsSpent: 0 }),
          ...patch,
        };
        noteSaver.schedule({ sectionId, ...merged });
        return { ...n, [sectionId]: merged };
      });
    },
    [noteSaver],
  );

  // Elapsed time is written on a slower beat than the notes; losing 20 seconds
  // of clock to a crash is survivable, losing a sentence is not.
  useEffect(() => {
    const t = setInterval(() => {
      void saveElapsed(sessionId, total).catch(() => {});
      const section = sections[indexRef.current];
      if (section) {
        void saveSectionNote({
          sessionId,
          sectionId: section.id,
          secondsSpent: notesRef.current[section.id]?.secondsSpent ?? 0,
        }).catch(() => {});
      }
    }, 20000);
    return () => clearInterval(t);
  }, [sessionId, total, sections]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(sections.length - 1, next));
      const leaving = sections[indexRef.current];
      if (leaving) {
        // Flush the section we're leaving so its clock is right on reload.
        void saveSectionNote({
          sessionId,
          sectionId: leaving.id,
          secondsSpent: notesRef.current[leaving.id]?.secondsSpent ?? 0,
        }).catch(() => {});
      }
      setIndex(clamped);
    },
    [sections, sessionId],
  );

  const [ending, setEnding] = useState(false);
  const finish = useCallback(() => {
    setEnding(true);
    startTransition(async () => {
      await endSession(sessionId, total);
    });
  }, [sessionId, total]);

  // ---- Keyboard map (§6.3)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target?.isContentEditable === true;

      if (mod && e.key === "ArrowRight") {
        e.preventDefault();
        go(indexRef.current + 1);
      } else if (mod && e.key === "ArrowLeft") {
        e.preventDefault();
        go(indexRef.current - 1);
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        stampTimestamp();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        finish();
      } else if (!typing && e.key === "ArrowRight") {
        // Bare arrows move between sections too, but only when the coach is not
        // in a note field — there they still move the caret.
        e.preventDefault();
        go(indexRef.current + 1);
      } else if (!typing && e.key === "ArrowLeft") {
        e.preventDefault();
        go(indexRef.current - 1);
      } else if (!typing && e.key.toLowerCase() === "r") {
        e.preventDefault();
        const section = sections[indexRef.current];
        if (section) setRevealed((r) => ({ ...r, [section.id]: !r[section.id] }));
      } else if (!typing && e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    }

    function stampTimestamp() {
      const el = document.activeElement;
      if (!(el instanceof HTMLTextAreaElement)) return;
      const stamp = `[${clock(total)}] `;
      const at = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, at);
      const after = el.value.slice(at);
      const needsBreak = before.length > 0 && !before.endsWith("\n");
      const insert = `${needsBreak ? "\n" : ""}${stamp}`;
      const value = `${before}${insert}${after}`;
      const field = el.dataset.field as "whatWasSaid" | "feedback" | undefined;
      const section = sections[indexRef.current];
      if (!field || !section) return;
      persist(section.id, { [field]: value });
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = at + insert.length;
      });
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, go, persist, sections, total]);

  const sectionSeconds = active ? (notes[active.id]?.secondsSpent ?? 0) : 0;
  const overTarget = Boolean(active?.targetMins && sectionSeconds > active.targetMins * 60);
  const hidden = active ? isHiddenKind(active.kind) || active.isSolution : false;
  const isRevealed = active ? Boolean(revealed[active.id]) : false;

  // Every page the case spans, for the mini-navigator filmstrip.
  const deckPages = useMemo(() => {
    if (!casePages) return [];
    return Array.from(
      { length: casePages.end - casePages.start + 1 },
      (_, i) => casePages.start + i,
    );
  }, [casePages]);

  /** Which step owns a given page, so the filmstrip can jump to it. */
  const stepForPage = useMemo(() => {
    const map = new Map<number, number>();
    sections.forEach((s, i) => {
      for (const part of [s, ...s.companions]) {
        if (!part.startPage) continue;
        for (let p = part.startPage; p <= (part.endPage ?? part.startPage); p += 1) {
          if (!map.has(p)) map.set(p, i);
        }
      }
    });
    return map;
  }, [sections]);

  /** Pages currently on screen, highlighted in the filmstrip. */
  const activePages = useMemo(() => {
    const set = new Set<number>();
    if (!active) return set;
    for (const part of [active, ...active.companions]) {
      if (!part.startPage) continue;
      for (let p = part.startPage; p <= (part.endPage ?? part.startPage); p += 1) set.add(p);
    }
    return set;
  }, [active]);

  if (!active) {
    return (
      <div className="p-8 text-sm text-muted">
        This case has no sections. Add one from the case page and come back.
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-paper">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-rule px-3 text-2xs">
        <span className="text-muted">{caseTitle}</span>
        <span className="text-faint">·</span>
        <span className="text-muted">{candidateName}</span>
        <span className="flex-1" />
        <SaveIndicator state={noteSaver.state} />
        <button className="btn btn-quiet py-0" onClick={() => setPaletteOpen(true)}>
          Jump ⌘K
        </button>
        <button className="btn btn-quiet py-0" onClick={() => setAdding(true)}>
          Add section
        </button>
        <button className="btn py-0" onClick={finish} disabled={ending}>
          {ending ? "Ending…" : "End case ⌘S"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left: the case material. */}
        <div className="min-w-0 overflow-auto border-r border-rule" style={{ width: `${splitPct}%` }}>
          {/* The active section, plus anything pinned to it — an exhibit and its
              prompt, or a prompt and its sample framework — so the coach reads
              them together instead of paging between them. */}
          <SectionMaterial
            section={active}
            fileUrl={fileUrl}
            revealed={isRevealed}
            onReveal={() => setRevealed((r) => ({ ...r, [active.id]: true }))}
          />
          {active.companions.map((c) => (
            <div key={c.id} className="border-t-2 border-rule">
              <div className="flex items-center gap-2 bg-panel px-3 py-1">
                <span className={clsx("h-3 w-1 rounded-sm", sectionKindMeta(c.kind).spine)} />
                <span className="text-2xs text-muted">{c.label}</span>
                <span className={clsx("chip ml-auto", sectionKindMeta(c.kind).chip)}>
                  {sectionKindMeta(c.kind).label}
                </span>
                {isHiddenKind(c.kind) && (
                  <button
                    className="btn btn-quiet py-0 text-2xs"
                    onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))}
                  >
                    {revealed[c.id] ? "Hide" : "Reveal"}
                  </button>
                )}
              </div>
              <SectionMaterial
                section={c}
                fileUrl={fileUrl}
                revealed={Boolean(revealed[c.id])}
                onReveal={() => setRevealed((r) => ({ ...r, [c.id]: true }))}
              />
            </div>
          ))}
        </div>

        <Divider onDrag={setSplitPct} />

        {/* Right: the two things the coach is actually doing. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-2 border-b border-rule px-3 py-1.5">
            <span className="tabular text-2xs text-faint">
              Section {index + 1} of {sections.length}
            </span>
            <span className={clsx("chip", sectionKindMeta(active.kind).chip)}>
              {sectionKindMeta(active.kind).label}
            </span>
            <span className="truncate text-sm text-ink">{active.label}</span>
            {hidden && (
              <button
                className="btn btn-quiet ml-auto py-0"
                onClick={() => setRevealed((r) => ({ ...r, [active.id]: !r[active.id] }))}
              >
                {isRevealed ? "Hide (R)" : "Reveal (R)"}
              </button>
            )}
          </div>

          <NoteField
            innerRef={saidRef}
            field="whatWasSaid"
            label="What was said"
            value={notes[active.id]?.whatWasSaid ?? ""}
            onChange={(v) => persist(active.id, { whatWasSaid: v })}
            onTab={() => feedbackRef.current?.focus()}
          />
          <NoteField
            innerRef={feedbackRef}
            field="feedback"
            label="Feedback"
            hint="Start a line with * to flag it as a takeaway."
            value={notes[active.id]?.feedback ?? ""}
            onChange={(v) => persist(active.id, { feedback: v })}
            onTab={() => saidRef.current?.focus()}
            shift
          />
        </div>
      </div>

      <MiniNavigator
        fileUrl={fileUrl}
        pages={deckPages}
        activePages={activePages}
        onPick={(page) => {
          const step = stepForPage.get(page);
          if (step !== undefined) go(step);
        }}
      />

      <footer className="flex h-9 shrink-0 items-center gap-3 border-t border-rule px-3 text-2xs">
        <span className="tabular text-ink">{clock(total)} total</span>
        <span className={clsx("tabular", overTarget ? "text-warn" : "text-muted")}>
          {clock(sectionSeconds)} this section
          {active.targetMins ? ` / ${active.targetMins}:00` : ""}
        </span>
        <button className="btn btn-quiet py-0" onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume (space)" : "Pause (space)"}
        </button>
        <span className="flex-1" />
        <button className="btn py-0" onClick={() => go(index - 1)} disabled={index === 0}>
          ◀ prev
        </button>
        <button
          className="btn py-0"
          onClick={() => go(index + 1)}
          disabled={index === sections.length - 1}
        >
          next ▶
        </button>
      </footer>

      {paletteOpen && (
        <SectionPalette
          sections={sections}
          activeIndex={index}
          onPick={(i) => {
            go(i);
            setPaletteOpen(false);
          }}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {adding && (
        <AddSectionInline
          caseId={caseId}
          onCancel={() => setAdding(false)}
          onAdded={(section) => {
            setSections((s) => [...s, { ...section, companions: [] }]);
            setNotes((n) => ({
              ...n,
              [section.id]: { whatWasSaid: "", feedback: "", secondsSpent: 0 },
            }));
            setAdding(false);
            setIndex(sections.length);
          }}
        />
      )}
    </div>
  );
}

function NoteField({
  innerRef,
  field,
  label,
  hint,
  value,
  onChange,
  onTab,
  shift,
}: {
  innerRef: React.RefObject<HTMLTextAreaElement | null>;
  field: "whatWasSaid" | "feedback";
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onTab: () => void;
  shift?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border-b border-rule last:border-b-0">
      <div className="flex items-baseline gap-2 px-3 pt-2">
        <span className="label">{label}</span>
        {hint && <span className="text-2xs text-faint">{hint}</span>}
      </div>
      <textarea
        ref={innerRef}
        data-field={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Tab moves between the two fields rather than out of the runner.
          if (e.key === "Tab" && (shift ? e.shiftKey : !e.shiftKey)) {
            e.preventDefault();
            onTab();
          }
        }}
        spellCheck={false}
        className="prose-notes min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-ink focus:outline-none"
      />
    </div>
  );
}

/** Resizable panes, remembered across sessions (§6.1). */
function Divider({ onDrag }: { onDrag: (pct: number) => void }) {
  useEffect(() => {
    const stored = window.localStorage.getItem("casedesk.runner.split");
    if (stored) onDrag(Number(stored));
  }, [onDrag]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      className="w-1 shrink-0 cursor-col-resize bg-rule/60 hover:bg-accent/50 focus-visible:bg-accent"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const stored = Number(window.localStorage.getItem("casedesk.runner.split") ?? 58);
          const next = Math.min(80, Math.max(25, stored + (e.key === "ArrowLeft" ? -2 : 2)));
          window.localStorage.setItem("casedesk.runner.split", String(next));
          onDrag(next);
        }
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
          const pct = Math.min(80, Math.max(25, (ev.clientX / window.innerWidth) * 100));
          window.localStorage.setItem("casedesk.runner.split", String(Math.round(pct)));
          onDrag(pct);
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
    />
  );
}

/** Sections are addable mid-session — never block on missing structure (§4.4). */
function AddSectionInline({
  caseId,
  onAdded,
  onCancel,
}: {
  caseId: string;
  onAdded: (s: RunnerSection) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<SectionKind>("EXHIBIT");
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="absolute inset-x-0 bottom-9 mx-auto w-96 rounded border border-rule bg-panel p-3 shadow-xl">
      <div className="flex gap-2">
        <select
          className="field w-auto"
          value={kind}
          onChange={(e) => setKind(e.target.value as SectionKind)}
        >
          {SECTION_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          autoFocus
          className="field flex-1"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const { section } = await addSection(
                caseId,
                kind,
                label || sectionKindMeta(kind).label,
              );
              onAdded({
                id: section.id,
                kind: section.kind,
                label: section.label,
                startPage: section.startPage,
                endPage: section.endPage,
                bodyText: section.bodyText,
                isSolution: section.isSolution,
                targetMins: section.targetMins,
                whatWasSaid: "",
                feedback: "",
                secondsSpent: 0,
              });
            })
          }
        >
          Add
        </button>
        <button className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * One section's material: typed text if it has any, otherwise its casebook
 * pages. Hidden kinds stay blurred until the coach asks for them (§6.2).
 */
function SectionMaterial({
  section,
  fileUrl,
  revealed,
  onReveal,
}: {
  section: RunnerSection;
  fileUrl: string | null;
  revealed: boolean;
  onReveal: () => void;
}) {
  const pages = useMemo(() => {
    if (!section.startPage) return [];
    const end = section.endPage ?? section.startPage;
    return Array.from({ length: end - section.startPage + 1 }, (_, i) => section.startPage! + i);
  }, [section.startPage, section.endPage]);

  if ((isHiddenKind(section.kind) || section.isSolution) && !revealed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-muted">{sectionKindMeta(section.kind).label} hidden.</p>
        <button className="btn" onClick={onReveal}>
          Reveal (R)
        </button>
      </div>
    );
  }

  if (section.bodyText) {
    return (
      <pre className="prose-notes whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">
        {section.bodyText}
      </pre>
    );
  }

  if (fileUrl && pages.length > 0) return <PdfPane fileUrl={fileUrl} pages={pages} />;

  return (
    <div className="p-8 text-sm text-faint">
      {pages.length > 0
        ? "The casebook file is not available in this environment."
        : "No pages or text for this section."}
    </div>
  );
}

/**
 * A filmstrip of the whole deck. The keyboard is the fast path, but sometimes a
 * coach just wants to click to the slide they remember.
 */
function MiniNavigator({
  fileUrl,
  pages,
  activePages,
  onPick,
}: {
  fileUrl: string | null;
  pages: number[];
  activePages: Set<number>;
  onPick: (page: number) => void;
}) {
  if (pages.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-rule bg-panel/60 px-2 py-1.5">
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          title={`Page ${p}`}
          className={clsx(
            "tabular shrink-0 rounded border px-1.5 py-0.5 text-2xs transition-colors",
            activePages.has(p)
              ? "border-accent bg-accent/20 text-ink"
              : "border-rule text-faint hover:border-faint hover:text-muted",
          )}
        >
          {p}
        </button>
      ))}
      {!fileUrl && <span className="ml-2 text-2xs text-faint">no file loaded</span>}
    </div>
  );
}
