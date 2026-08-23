import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PhraseBank } from "./PhraseBank";

export const dynamic = "force-dynamic";

export default async function PhrasesPage() {
  await requireAdmin();
  const phrases = await db.phrase.findMany({
    orderBy: [{ dimension: "asc" }, { band: "asc" }, { kind: "asc" }, { text: "asc" }],
  });

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-base text-ink">Phrase bank</h1>
        <p className="text-sm text-muted">
          What &ldquo;Draft takeaways&rdquo; pulls from. {phrases.filter((p) => p.active).length}{" "}
          active of {phrases.length}. Write these the way you would say them — specific and
          actionable beats generic every time.
        </p>
      </div>
      <PhraseBank
        phrases={phrases.map((p) => ({
          id: p.id,
          dimension: p.dimension,
          band: p.band,
          kind: p.kind,
          text: p.text,
          active: p.active,
        }))}
      />
    </div>
  );
}
