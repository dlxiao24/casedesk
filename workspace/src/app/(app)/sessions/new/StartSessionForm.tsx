"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { createCandidate } from "@/actions/candidates";
import { startSession } from "@/actions/sessions";

type Candidate = { id: string; name: string; cohort: string | null; year: string | null };

/**
 * Session start (§6.2). A searchable combobox with inline creation — creating a
 * candidate must not leave the flow, so there is no modal and no second page.
 */
export function StartSessionForm({
  caseId,
  candidates,
  alreadySeen,
}: {
  caseId: string;
  candidates: Candidate[];
  alreadySeen: Record<string, { when: string; coach: string }>;
}) {
  const [list, setList] = useState(candidates);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 8);
    return list.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [list, query]);

  const exact = matches.some((m) => m.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exact;
  const options = canCreate ? matches.length : matches.length - 1;

  async function create() {
    const result = await createCandidate({ name: query.trim() });
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("candidate" in result && result.candidate) {
      const created = { ...result.candidate, year: null } as Candidate;
      setList((l) => [...l, created]);
      choose(created);
    }
  }

  function choose(c: Candidate) {
    setSelected(c);
    setQuery(c.name);
    setOpen(false);
  }

  const warning = selected ? alreadySeen[selected.id] : undefined;

  return (
    <div className="space-y-3 rounded border border-rule bg-panel p-4">
      <div className="relative">
        <label className="label" htmlFor="candidate">
          Candidate
        </label>
        <input
          id="candidate"
          ref={inputRef}
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="candidate-list"
          className="field mt-1"
          placeholder="Search, or type a new name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(options, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (highlight < matches.length) choose(matches[highlight]);
              else if (canCreate) void create();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />

        {open && (matches.length > 0 || canCreate) && (
          <ul
            id="candidate-list"
            role="listbox"
            className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-rule bg-panel shadow-lg"
          >
            {matches.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  className={clsx(
                    "flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-sm",
                    highlight === i ? "bg-accent/15 text-ink" : "text-muted",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(c)}
                >
                  <span className="text-ink">{c.name}</span>
                  <span className="text-2xs text-faint">
                    {[c.cohort, c.year].filter(Boolean).join(" · ")}
                  </span>
                  {alreadySeen[c.id] && (
                    <span className="ml-auto text-2xs text-warn">has seen this case</span>
                  )}
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={highlight === matches.length}
                  className={clsx(
                    "w-full px-2 py-1.5 text-left text-sm",
                    highlight === matches.length ? "bg-accent/15 text-ink" : "text-muted",
                  )}
                  onMouseEnter={() => setHighlight(matches.length)}
                  onClick={() => void create()}
                >
                  + New candidate “{query.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {warning && (
        <p className="rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-sm text-warn">
          {selected?.name} already did this case on {warning.when} with {warning.coach}.
        </p>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}

      <button
        className="btn btn-primary w-full justify-center"
        disabled={!selected || pending}
        onClick={() =>
          selected &&
          start(async () => {
            await startSession(caseId, selected.id);
          })
        }
      >
        {pending ? "Starting…" : "Start case"}
      </button>
      <p className="text-2xs text-faint">The timer starts as soon as the session opens.</p>
    </div>
  );
}
