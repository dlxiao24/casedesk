"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCandidate } from "@/actions/candidates";

export function NewCandidateInline() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cohort, setCohort] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded border border-rule bg-panel p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await createCandidate({ name, cohort, year });
          if ("error" in result && result.error) return setError(result.error);
          setName("");
          setCohort("");
          setYear("");
          setError(null);
          router.refresh();
        });
      }}
    >
      <div className="flex-1">
        <label className="label" htmlFor="cname">
          Name
        </label>
        <input
          id="cname"
          required
          className="field mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="w-44">
        <label className="label" htmlFor="ccohort">
          Cohort
        </label>
        <input
          id="ccohort"
          className="field mt-1"
          placeholder="Fall 2026 pledge class"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
        />
      </div>
      <div className="w-32">
        <label className="label" htmlFor="cyear">
          Year
        </label>
        <input
          id="cyear"
          className="field mt-1"
          placeholder="Sophomore"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" disabled={pending || !name.trim()}>
        {pending ? "Adding…" : "Add candidate"}
      </button>
      {error && <p className="w-full text-sm text-bad">{error}</p>}
    </form>
  );
}
