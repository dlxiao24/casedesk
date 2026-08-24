"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import type { SectionKind } from "@prisma/client";
import { saveSections } from "@/actions/casebooks";
import { PageGrid, type PageMark } from "@/components/PageGrid";
import { ZoomControl, useZoom } from "@/components/ZoomControl";
import {
  ATTACHING_KINDS,
  LEADING_KINDS,
  NON_MERGING_KINDS,
  SECTION_KINDS,
  sectionKindMeta,
} from "@/lib/constants";

type Existing = {
  id?: string;
  kind: SectionKind;
  label: string;
  startPage: number | null;
  endPage: number | null;
  targetMins: number | null;
  pairedWithId?: string | null;
};

type Merged = { kind: SectionKind; startPage: number; endPage: number };

/**
 * Where a dragged step would land. "before"/"after" reorder it at the top
 * level; "child" attaches it beneath the target's step.
 */
type DropTarget = { sig: string; mode: "before" | "after" | "child" };

/** A stable handle for a merged section, so edits survive re-merging. */
function signature(s: { kind: SectionKind; startPage: number }) {
  return `${s.kind}:${s.startPage}`;
}

/**
 * Assigning section kinds to pages (§4.3).
 *
 * Click a page, press a number. Contiguous pages of the same kind merge into
 * one section automatically.
 *
 * Nesting is inferred rather than configured: an interviewee exhibit or an
 * interviewer solution marked after a prompt, math or brainstorm attaches to
 * it, because that is the order a casebook is laid out in. Dragging overrides
 * the guess when a casebook disagrees.
 */
export function AssignSections({
  caseId,
  fileUrl,
  startPage,
  endPage,
  suggestions,
  existing,
}: {
  caseId: string;
  fileUrl: string | null;
  startPage: number;
  endPage: number;
  suggestions: Record<number, { kind: string; label: string | null }>;
  existing: Existing[];
}) {
  const router = useRouter();
  const pageCount = endPage - startPage + 1;
  const zoom = useZoom("sections");

  const [assigned, setAssigned] = useState<Record<number, SectionKind>>(() => {
    const out: Record<number, SectionKind> = {};
    for (const s of existing) {
      if (!s.startPage) continue;
      for (let p = s.startPage; p <= (s.endPage ?? s.startPage); p += 1) out[p] = s.kind;
    }
    return out;
  });

  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      existing
        .filter((s) => s.startPage !== null)
        .map((s) => [signature({ kind: s.kind, startPage: s.startPage! }), s.label]),
    ),
  );

  /** Explicit overrides only. `null` means "the coach pulled this back out". */
  const [manualNest, setManualNest] = useState<Record<string, string | null>>(() => {
    const sigById: Record<string, string> = {};
    for (const e of existing) {
      if (e.id && e.startPage) sigById[e.id] = signature({ kind: e.kind, startPage: e.startPage });
    }
    const out: Record<string, string | null> = {};
    for (const e of existing) {
      if (!e.startPage || !e.pairedWithId) continue;
      const parent = sigById[e.pairedWithId];
      if (parent) out[signature({ kind: e.kind, startPage: e.startPage })] = parent;
    }
    return out;
  });

  /** Explicit top-level ordering, when the coach has dragged something. */
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  /**
   * Explicit ordering of the substeps under a given step. Without this,
   * substeps sat in page order, so an exhibit late in the deck could never be
   * placed above one that came earlier — which is exactly what you want when
   * the casebook prints them out of the order you deliver them in.
   */
  const [childOrder, setChildOrder] = useState<Record<string, string[]>>(() => {
    // Saved sections arrive in the order they were written, so a set the coach
    // already arranged comes back arranged rather than snapping to page order.
    const seeded: Record<string, string[]> = {};
    const sigById: Record<string, string> = {};
    for (const e of existing) {
      if (e.id && e.startPage) sigById[e.id] = signature({ kind: e.kind, startPage: e.startPage });
    }
    for (const e of existing) {
      if (!e.startPage || !e.pairedWithId) continue;
      const parent = sigById[e.pairedWithId];
      if (!parent) continue;
      const sig = signature({ kind: e.kind, startPage: e.startPage });
      seeded[parent] = [...(seeded[parent] ?? []), sig];
    }
    return seeded;
  });

  const [cursor, setCursor] = useState(startPage);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<DropTarget | null>(null);

  /**
   * Number keys work anywhere on the screen, not just while the grid itself
   * holds focus — clicking a page focuses that page's button, and expecting the
   * coach to know which element is focused before pressing 3 is a bad deal.
   * Typing in a name field is the one place they stay literal.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const hotkey = SECTION_KINDS.find((k) => k.hotkey === e.key);
      if (hotkey) {
        e.preventDefault();
        assign(cursor, hotkey.value);
        setCursor((c) => Math.min(endPage, c + 1));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        assign(cursor, null);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCursor((c) => Math.min(endPage, c + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCursor((c) => Math.max(startPage, c - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, endPage, startPage]);

  function assign(page: number, kind: SectionKind | null) {
    setAssigned((a) => {
      const next = { ...a };
      if (kind === null) delete next[page];
      else next[page] = kind;
      return next;
    });
  }

  /** Contiguous pages of the same kind become one section, in page order. */
  const merged = useMemo(() => {
    const out: Merged[] = [];
    for (let p = startPage; p <= endPage; p += 1) {
      const kind = assigned[p];
      if (!kind) continue;
      const last = out[out.length - 1];
      const mergeable = last && last.kind === kind && last.endPage === p - 1;
      if (mergeable && !NON_MERGING_KINDS.includes(kind)) last.endPage = p;
      else out.push({ kind, startPage: p, endPage: p });
    }
    return out;
  }, [assigned, endPage, startPage]);

  /** Attaching kinds fall in behind the most recent leading section. */
  const autoNest = useMemo(() => {
    const out: Record<string, string> = {};
    let lead: string | null = null;
    for (const s of merged) {
      if (LEADING_KINDS.includes(s.kind)) lead = signature(s);
      else if (ATTACHING_KINDS.includes(s.kind) && lead) out[signature(s)] = lead;
    }
    return out;
  }, [merged]);

  function parentOf(sig: string): string | null {
    const manual = manualNest[sig];
    if (manual !== undefined) return manual;
    return autoNest[sig] ?? null;
  }

  /** The displayed tree: top-level sections, each with its attached children. */
  const tree = useMemo(() => {
    const bySig = new Map(merged.map((s) => [signature(s), s]));
    const tops = merged.filter((s) => {
      const parent = parentOf(signature(s));
      return !parent || !bySig.has(parent);
    });
    const ordered = manualOrder
      ? [
          ...manualOrder.map((sig) => tops.find((t) => signature(t) === sig)).filter(Boolean),
          ...tops.filter((t) => !manualOrder.includes(signature(t))),
        ]
      : tops;

    return (ordered as Merged[]).map((top) => {
      const topSig = signature(top);
      const mine = merged.filter((c) => parentOf(signature(c)) === topSig);
      const wanted = childOrder[topSig];
      if (!wanted) return { section: top, children: mine };

      const bySig = new Map(mine.map((c) => [signature(c), c]));
      const sorted = wanted.map((sig) => bySig.get(sig)).filter(Boolean) as Merged[];
      const rest = mine.filter((c) => !wanted.includes(signature(c)));
      return { section: top, children: [...sorted, ...rest] };
    });
    // parentOf reads manualNest and autoNest, both listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged, manualNest, autoNest, manualOrder, childOrder]);

  const marks = useMemo(() => {
    const out: Record<number, PageMark> = {};
    const numberOf = new Map<string, string>();
    tree.forEach((node, i) => {
      numberOf.set(signature(node.section), String(i + 1));
      node.children.forEach((c, j) => numberOf.set(signature(c), `${i + 1}.${j + 1}`));
    });
    for (let p = startPage; p <= endPage; p += 1) {
      const kind = assigned[p];
      if (kind) {
        // Find which merged section owns this page, for its number.
        const owner = merged.find((s) => p >= s.startPage && p <= s.endPage);
        const num = owner ? numberOf.get(signature(owner)) : undefined;
        out[p] = {
          spine: sectionKindMeta(kind).spine,
          chip: `${num ? `${num} · ` : ""}${sectionKindMeta(kind).label}`,
        };
      } else if (suggestions[p]) {
        out[p] = { hint: sectionKindMeta(suggestions[p].kind as SectionKind).label };
      }
    }
    return out;
  }, [assigned, endPage, merged, startPage, suggestions, tree]);

  function acceptAllSuggestions() {
    const nextLabels: Record<string, string> = {};
    setAssigned((a) => {
      const next = { ...a };
      for (const [page, s] of Object.entries(suggestions)) {
        const p = Number(page);
        if (!next[p]) next[p] = s.kind as SectionKind;
        if (s.label) nextLabels[`${s.kind}:${p}`] = s.label;
      }
      return next;
    });
    setLabels((l) => ({ ...nextLabels, ...l }));
  }

  /** Unassign every page of a step, which removes it from the list entirely. */
  function clearSection(section: Merged) {
    const sig = signature(section);
    setAssigned((a) => {
      const next = { ...a };
      for (let p = section.startPage; p <= section.endPage; p += 1) delete next[p];
      return next;
    });
    setLabels((l) => {
      const next = { ...l };
      delete next[sig];
      return next;
    });
    setManualNest((m) => {
      const next = { ...m };
      delete next[sig];
      // Anything nested under it comes back out rather than vanishing.
      for (const [child, parent] of Object.entries(next)) {
        if (parent === sig) next[child] = null;
      }
      return next;
    });
  }

  function labelFor(section: Merged) {
    return (
      labels[signature(section)] ??
      suggestions[section.startPage]?.label ??
      sectionKindMeta(section.kind).label
    );
  }

  // ---- Drag and drop ----

  /** A parent cannot become someone's child, and nesting stops at one level. */
  function canNestUnder(source: string, parent: string) {
    if (source === parent) return false;
    const sourceNode = tree.find((n) => signature(n.section) === source);
    return !sourceNode || sourceNode.children.length === 0;
  }

  function applyDrop(target: DropTarget) {
    const source = dragging;
    setDragging(null);
    setDropAt(null);
    if (!source) return;

    if (target.mode === "child") {
      // Dropping onto a child means "join that child's parent".
      const parent = parentOf(target.sig) ?? target.sig;
      if (!canNestUnder(source, parent)) return;
      const siblings = (tree.find((n) => signature(n.section) === parent)?.children ?? [])
        .map(signature)
        .filter((sig) => sig !== source);
      setManualNest((m) => ({ ...m, [source]: parent }));
      setChildOrder((co) => ({ ...co, [parent]: [...siblings, source] }));
      return;
    }

    if (source === target.sig) return;

    // Dropping beside a substep means "sit next to it", not "become a step".
    const targetParent = parentOf(target.sig);
    if (targetParent && targetParent !== source) {
      if (!canNestUnder(source, targetParent)) return;
      const siblings = (tree.find((n) => signature(n.section) === targetParent)?.children ?? [])
        .map(signature)
        .filter((sig) => sig !== source);
      const at = siblings.indexOf(target.sig);
      const insertAt = at < 0 ? siblings.length : target.mode === "after" ? at + 1 : at;
      setManualNest((m) => ({ ...m, [source]: targetParent }));
      setChildOrder((co) => ({
        ...co,
        [targetParent]: [...siblings.slice(0, insertAt), source, ...siblings.slice(insertAt)],
      }));
      return;
    }

    // Reordering pulls the section out to the top level first.
    setManualNest((m) => ({ ...m, [source]: null }));
    setManualOrder(() => {
      const tops = tree.map((n) => signature(n.section));
      const withSource = tops.includes(source) ? tops : [...tops, source];
      const without = withSource.filter((x) => x !== source);
      const at = without.indexOf(target.sig);
      const insertAt = at < 0 ? without.length : target.mode === "after" ? at + 1 : at;
      return [...without.slice(0, insertAt), source, ...without.slice(insertAt)];
    });
  }

  function save() {
    start(async () => {
      // Flatten the tree: each parent followed by its children, so `order` in
      // the database matches what the coach sees.
      const flat: { section: Merged; parentIndex: number | null }[] = [];
      for (const node of tree) {
        const parentIndex = flat.length;
        flat.push({ section: node.section, parentIndex: null });
        for (const child of node.children) flat.push({ section: child, parentIndex });
      }

      await saveSections(
        caseId,
        flat.map((f) => ({
          kind: f.section.kind,
          label: labelFor(f.section),
          startPage: f.section.startPage,
          endPage: f.section.endPage,
          pairedWithIndex: f.parentIndex,
        })),
      );
      const nested = flat.filter((f) => f.parentIndex !== null).length;
      setSaved(
        `Saved ${tree.length} step${tree.length === 1 ? "" : "s"}${nested ? `, ${nested} attached` : ""}.`,
      );
      router.refresh();
    });
  }

  const numberedKeys = SECTION_KINDS.filter((k) => k.hotkey);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <ZoomControl columns={zoom.columns} onChange={zoom.choose} />
          <span className="text-2xs text-faint">Pages across</span>
        </div>
        <PageGrid
          columns={zoom.columns}
          fileUrl={fileUrl}
          pageCount={pageCount}
          firstPage={startPage}
          marks={marks}
          cursor={cursor}
          selected={(p) => p === cursor}
          onPick={(page) => {
            // Click to select; click the same page again to unassign it.
            if (page === cursor && assigned[page]) assign(page, null);
            else setCursor(page);
          }}
        />
      </div>

      <div className="space-y-4">
        <div className="rounded border border-rule bg-panel p-3">
          <h2 className="text-sm text-ink">Keys</h2>
          <p className="mt-0.5 text-2xs text-faint">
            Click a page, then press a number. The cursor advances on its own. Click a page a
            second time to clear it, or press Delete.
          </p>
          <ul className="mt-2 space-y-1">
            {numberedKeys.map((k) => (
              <li key={k.value} className="flex items-center gap-2 text-sm">
                <kbd className="tabular rounded border border-rule px-1.5 text-2xs text-muted">
                  {k.hotkey}
                </kbd>
                <span className={clsx("h-3 w-1 rounded-sm", k.spine)} />
                <button
                  className="text-left text-muted hover:text-ink"
                  onClick={() => {
                    assign(cursor, k.value);
                    setCursor((c) => Math.min(endPage, c + 1));
                  }}
                >
                  {k.label}
                </button>
                {ATTACHING_KINDS.includes(k.value) && (
                  <span className="ml-auto text-2xs text-faint">attaches</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-2xs text-faint">
            Key 7 attaches to whichever step you marked last. Everything else starts its own
            step, and consecutive interviewee exhibits stay separate.
          </p>
          {Object.keys(suggestions).length > 0 && (
            <button className="btn mt-3 w-full justify-center" onClick={acceptAllSuggestions}>
              Accept {Object.keys(suggestions).length} suggestions
            </button>
          )}
        </div>

        <div className="rounded border border-rule bg-panel p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-ink">Steps</h2>
            <span className="text-2xs text-faint">{tree.length}</span>
          </div>
          <p className="mt-0.5 text-2xs text-faint">
            Drag to reorder, substeps included. Drop on the right third of a row, or on an
            "attach under" slot, to tuck a step beneath another.
          </p>

          {tree.length === 0 ? (
            <p className="mt-2 text-2xs text-faint">Nothing assigned yet.</p>
          ) : (
            <ul className="mt-2">
              {tree.map((node, i) => {
                const sig = signature(node.section);
                return (
                  <li key={sig}>
                    <DropLine active={dropAt?.sig === sig && dropAt.mode === "before"} />
                    <SectionRow
                      number={String(i + 1)}
                      section={node.section}
                      label={labelFor(node.section)}
                      onLabel={(v) => setLabels((l) => ({ ...l, [sig]: v }))}
                      dragging={dragging === sig}
                      attachTarget={dropAt?.sig === sig && dropAt.mode === "child"}
                      onDragStart={() => setDragging(sig)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropAt(null);
                      }}
                      onHover={(mode) => setDropAt({ sig, mode })}
                      onDrop={(mode) => applyDrop({ sig, mode })}
                      onClear={() => clearSection(node.section)}
                    />

                    <ul
                      className={clsx(
                        "ml-5 pl-2",
                        node.children.length > 0 && "border-l border-rule",
                      )}
                    >
                        {node.children.map((child, j) => {
                          const childSig = signature(child);
                          return (
                            <li key={childSig}>
                              <SectionRow
                                number={`${i + 1}.${j + 1}`}
                                section={child}
                                label={labelFor(child)}
                                onLabel={(v) => setLabels((l) => ({ ...l, [childSig]: v }))}
                                dragging={dragging === childSig}
                                attachTarget={dropAt?.sig === childSig && dropAt.mode === "child"}
                                onDragStart={() => setDragging(childSig)}
                                onDragEnd={() => {
                                  setDragging(null);
                                  setDropAt(null);
                                }}
                                onHover={(mode) => setDropAt({ sig: childSig, mode })}
                                onDrop={(mode) => applyDrop({ sig: childSig, mode })}
                                onClear={() => clearSection(child)}
                                onDetach={() =>
                                  setManualNest((m) => ({ ...m, [childSig]: null }))
                                }
                              />
                            </li>
                          );
                        })}

                        {/* A standing target during a drag, so attaching a
                            second and third subsection is one obvious move
                            rather than a hunt for the right edge of a row. It
                            is always mounted and always occupies its space:
                            adding it on dragstart re-laid out the list and
                            cancelled the drag. */}
                        <li>
                          <AttachSlot
                            label={labelFor(node.section)}
                            visible={Boolean(dragging) && dragging !== sig}
                            active={dropAt?.sig === sig && dropAt.mode === "child"}
                            onHover={() => setDropAt({ sig, mode: "child" })}
                            onDrop={() => applyDrop({ sig, mode: "child" })}
                          />
                        </li>
                      </ul>

                    {i === tree.length - 1 && (
                      <DropLine active={dropAt?.sig === sig && dropAt.mode === "after"} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {saved && <p className="mt-2 text-2xs text-good">{saved}</p>}
          <button
            className="btn btn-primary mt-3 w-full justify-center"
            disabled={pending || tree.length === 0}
            onClick={save}
          >
            {pending ? "Saving…" : "Save sections"}
          </button>
          <p className="mt-1 text-2xs text-faint">
            Replaces the case&apos;s current sections. Steps that keep the same first page keep
            their notes from past sessions.
          </p>
        </div>
      </div>
    </div>
  );
}


/** A 2px accent rule showing exactly where a reordered step will land. */
function DropLine({ active }: { active: boolean }) {
  return (
    <div
      className={clsx(
        "h-0.5 rounded transition-colors",
        active ? "bg-accent" : "bg-transparent",
      )}
    />
  );
}

/**
 * The standing "attach here" target under a step. Visible for the whole drag,
 * so adding a second or third subsection is a large, obvious drop rather than a
 * hunt for the right-hand strip of a row.
 */
function AttachSlot({
  label,
  visible,
  active,
  onHover,
  onDrop,
}: {
  label: string;
  visible: boolean;
  active: boolean;
  onHover: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        if (!visible) return;
        e.preventDefault();
        onHover();
      }}
      onDrop={(e) => {
        if (!visible) return;
        e.preventDefault();
        onDrop();
      }}
      className={clsx(
        "flex h-[18px] items-center rounded border border-dashed px-1.5 text-2xs transition-colors",
        !visible && "pointer-events-none border-transparent text-transparent",
        visible && active && "border-accent bg-accent/15 text-ink",
        visible && !active && "border-rule/70 text-faint hover:border-faint",
      )}
    >
      ⤷ attach under {label}
    </div>
  );
}

function SectionRow({
  number,
  section,
  label,
  onLabel,
  dragging,
  attachTarget,
  onDragStart,
  onDragEnd,
  onHover,
  onDrop,
  onClear,
  onDetach,
}: {
  number: string;
  section: Merged;
  label: string;
  onLabel: (value: string) => void;
  dragging: boolean;
  attachTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onHover: (mode: DropTarget["mode"]) => void;
  onDrop: (mode: DropTarget["mode"]) => void;
  onClear: () => void;
  onDetach?: () => void;
}) {
  const meta = sectionKindMeta(section.kind);

  /**
   * Right-hand third attaches; otherwise the vertical half decides whether the
   * step lands above or below. Reading position rather than asking for a
   * modifier key keeps it to one gesture.
   */
  function modeFor(e: React.DragEvent): DropTarget["mode"] {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX > rect.left + rect.width * 0.66) return "child";
    return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag without payload.
        e.dataTransfer.setData("text/plain", number);
        // Deferred by a tick on purpose. Flagging the drag makes every step
        // grow an "attach under" slot, and re-laying out during dragstart moves
        // the dragged row out from under the pointer — which Chrome treats as a
        // cancelled drag. Only the top row survived that, because only it never
        // moved. Letting the browser take its drag snapshot first fixes it.
        window.setTimeout(onDragStart, 0);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onHover(modeFor(e));
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(modeFor(e));
      }}
      className={clsx(
        "group flex items-center gap-1.5 rounded border px-1.5 py-1 transition-colors",
        dragging ? "opacity-30" : "",
        attachTarget ? "border-accent bg-accent/15" : "border-transparent",
      )}
    >
      <span className="cursor-grab select-none text-2xs text-faint" aria-hidden>
        ⠿
      </span>
      <span className="tabular w-9 shrink-0 text-2xs text-muted">{number}</span>
      <span className={clsx("h-5 w-1 shrink-0 rounded-sm", meta.spine)} />
      <input
        className="field py-0.5 text-2xs"
        value={label}
        aria-label={`Name for step ${number}`}
        onChange={(e) => onLabel(e.target.value)}
      />
      <span className="tabular shrink-0 text-2xs text-faint">
        {section.startPage}
        {section.endPage !== section.startPage ? `–${section.endPage}` : ""}
      </span>
      {onDetach && (
        <button
          className="shrink-0 text-2xs text-faint hover:text-ink"
          title="Pull out to its own step"
          onClick={onDetach}
        >
          ↰
        </button>
      )}
      <button
        className="shrink-0 px-0.5 text-2xs text-faint hover:text-bad"
        title="Unassign these pages and remove the step"
        aria-label={`Remove step ${number}`}
        onClick={onClear}
      >
        ✕
      </button>
    </div>
  );
}
