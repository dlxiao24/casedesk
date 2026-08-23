import { PrismaClient } from "@prisma/client";
import { PHRASE_SEEDS } from "./phrases";

const db = new PrismaClient();

/**
 * Seeds the phrase bank, the first admin, and — unless SEED_MINIMAL is set — a
 * small amount of demo content so the library, runner and report have something
 * to render before a single casebook exists.
 */
async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "coach@example.edu").toLowerCase();

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: process.env.SEED_ADMIN_NAME ?? "First Coach", role: "ADMIN" },
    update: { role: "ADMIN" },
  });
  console.log(`admin: ${admin.email}`);

  // Phrases are matched by their text so re-seeding never duplicates them.
  let added = 0;
  for (const seed of PHRASE_SEEDS) {
    const existing = await db.phrase.findFirst({ where: { text: seed.text } });
    if (existing) continue;
    await db.phrase.create({ data: seed });
    added += 1;
  }
  console.log(`phrases: ${added} added, ${PHRASE_SEEDS.length} total in seed`);

  if (process.env.SEED_MINIMAL) {
    console.log("SEED_MINIMAL set — skipping demo content.");
    return;
  }

  const existingCases = await db.case.count();
  if (existingCases > 0) {
    console.log("cases already exist — skipping demo content.");
    return;
  }

  const demo = await db.case.create({
    data: {
      title: "Coffee chain margin decline",
      caseType: "PROFITABILITY",
      industry: "Food & beverage",
      targetRound: "FIRST_ROUND",
      format: "INTERVIEWER_LED",
      ownerId: admin.id,
      quantIntensity: 4,
      creativityLoad: 2,
      structureDifficulty: 3,
      ambiguity: 2,
      dataDensity: 4,
      overallDifficulty: 3,
      notes:
        "Classic profitability walk. The trap is jumping to price before splitting revenue into traffic and ticket.",
      sections: {
        create: [
          {
            kind: "PROMPT",
            label: "Prompt",
            order: 0,
            targetMins: 3,
            bodyText:
              "Our client is a 240-store regional coffee chain. Operating margin has fallen from 14% to 9% over three years while revenue has been flat. The CEO wants to know why, and what to do about it.",
          },
          {
            kind: "STRUCTURE",
            label: "Structure",
            order: 1,
            targetMins: 6,
            bodyText: "Give the candidate 90 seconds. Look for revenue split into traffic × ticket, and costs split into store-level vs. corporate.",
          },
          {
            kind: "EXHIBIT",
            label: "Exhibit 1 — Cost per store, 2021–2024",
            order: 2,
            targetMins: 8,
            bodyText:
              "Cost per store per year ($000s):\n\n            2021   2022   2023   2024\nLabour       310    336    381    427\nRent         120    124    128    133\nCOGS         205    212    208    214\nOther         84     86     88     91",
          },
          {
            kind: "MATH",
            label: "Math — labour as a share of cost",
            order: 3,
            targetMins: 8,
            bodyText:
              "Ask: how much of the margin decline does labour explain? Labour rose $117k per store against total cost growth of $146k — roughly 80%.",
          },
          {
            kind: "BRAINSTORM",
            label: "Brainstorm — levers",
            order: 4,
            targetMins: 6,
            bodyText: "Looking for scheduling/automation, menu simplification, price, and store-format ideas — organized, not listed.",
          },
          {
            kind: "SYNTHESIS",
            label: "Synthesis",
            order: 5,
            targetMins: 3,
          },
          {
            kind: "SOLUTION",
            label: "Solution",
            order: 6,
            isSolution: true,
            bodyText:
              "Labour inflation, not traffic or pricing, drives the decline. Recommendation: re-engineer store labour model (scheduling to demand, drink-prep automation on the top 5 SKUs), worth ~$60k per store per year, restoring roughly 3 points of margin.",
          },
        ],
      },
    },
  });
  console.log(`demo case: ${demo.title}`);

  await db.candidate.create({
    data: { name: "Sample Candidate", cohort: "Fall 2026", year: "Sophomore" },
  });
  console.log("demo candidate created");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
