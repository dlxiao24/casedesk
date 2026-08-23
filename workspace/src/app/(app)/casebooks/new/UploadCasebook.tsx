"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerCasebook } from "@/actions/casebooks";
import { SUPABASE_BUCKET } from "@/lib/env";
import { extractPdfText } from "@/lib/pdf";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "reading" | "uploading" | "saving" | "error";

/**
 * Upload (§4.1). The PDF goes straight from the browser to Supabase Storage;
 * pdf.js extracts the text layer on the way past so sectioning never re-parses.
 *
 * Slide screenshots are accepted too and are normalised to the same shape: an
 * ordered page sequence with an (empty) text layer.
 */
export function UploadCasebook() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isImages = files.length > 0 && files.every((f) => f.type.startsWith("image/"));
  const busy = phase === "reading" || phase === "uploading" || phase === "saving";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase || files.length === 0) return;

    try {
      let pageCount = files.length;
      let pageText: Record<string, string> = {};

      if (!isImages) {
        setPhase("reading");
        const extracted = await extractPdfText(files[0], (done, total) =>
          setProgress(`Reading page ${done} of ${total}…`),
        );
        pageCount = extracted.pageCount;
        pageText = extracted.pageText;
      }

      setPhase("uploading");
      setProgress("Uploading…");
      const stamp = Date.now();
      const slug = (title || "casebook").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const imageKeys: string[] = [];
      let fileKey = "";

      if (isImages) {
        // Sorted by filename so "slide-02" lands where the coach expects it.
        const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        for (const [i, file] of ordered.entries()) {
          const key = `${slug}-${stamp}/page-${String(i + 1).padStart(3, "0")}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .upload(key, file, { upsert: false, contentType: file.type });
          if (upErr) throw upErr;
          imageKeys.push(key);
          setProgress(`Uploading image ${i + 1} of ${ordered.length}…`);
        }
        fileKey = imageKeys[0] ?? "";
      } else {
        fileKey = `${slug}-${stamp}.pdf`;
        const { error: upErr } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(fileKey, files[0], { upsert: false, contentType: "application/pdf" });
        if (upErr) throw upErr;
      }

      setPhase("saving");
      setProgress("Saving…");
      const result = await registerCasebook({
        title,
        school: school || null,
        year: year ? Number(year) : null,
        fileKey,
        sourceKind: isImages ? "IMAGES" : "PDF",
        imageKeys,
        pageCount,
        pageText,
        byteSize: files.reduce((sum, f) => sum + f.size, 0),
      });
      if ("error" in result && result.error) throw new Error(result.error);
      if ("id" in result) router.push(`/casebooks/${result.id}/split`);
    } catch (err) {
      // The message alone is rarely enough to tell a pdf.js parse failure from
      // a storage permission failure; keep the stack reachable in the console.
      console.error("Casebook upload failed:", err);
      setPhase("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border border-rule bg-panel p-4">
      <div className="grid grid-cols-[1fr_10rem_6rem] gap-3">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            required
            className="field mt-1"
            placeholder="Kellogg 2023"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="school">
            School
          </label>
          <input
            id="school"
            className="field mt-1"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="year">
            Year
          </label>
          <input
            id="year"
            type="number"
            className="field tabular mt-1"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="file">
          File
        </label>
        <input
          id="file"
          type="file"
          required
          multiple
          accept="application/pdf,image/png,image/jpeg"
          className="field mt-1 file:mr-3 file:rounded file:border-0 file:bg-rule file:px-2 file:py-1 file:text-ink"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <p className="mt-1 text-2xs text-faint">
          One PDF, or a set of slide screenshots which will be ordered by filename.
        </p>
      </div>

      {busy && <p className="text-sm text-muted">{progress}</p>}
      {error && <p className="text-sm text-bad">{error}</p>}

      <button className="btn btn-primary" disabled={busy || files.length === 0 || !title.trim()}>
        {busy ? "Working…" : "Upload and split"}
      </button>
    </form>
  );
}
