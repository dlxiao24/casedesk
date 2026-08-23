import type { Band, Dimension, TakeawayKind } from "@prisma/client";

export type PhraseSeed = {
  dimension: Dimension;
  band: Band;
  kind: TakeawayKind;
  text: string;
};

/**
 * The phrase bank (§7.1). ~4 phrases per (dimension × band × kind).
 *
 * These are meant to be *starting sentences a coach would actually say*, not
 * labels. The coach is expected to rewrite them; the job here is to kill the
 * blank page, so each phrase names a specific behaviour and what to do instead.
 */

type Row = [Band, TakeawayKind, string];

function rows(dimension: Dimension, list: Row[]): PhraseSeed[] {
  return list.map(([band, kind, text]) => ({ dimension, band, kind, text }));
}

const STRUCTURE: Row[] = [
  // --- LOW (1-2) ---
  ["LOW", "IMPROVE", "Take the full 60–90 seconds to structure before you speak. A silent minute reads as thoughtful; an unstructured start reads as lost."],
  ["LOW", "IMPROVE", "Build the tree top-down: two or three big buckets first, then break each one down. Listing every idea you have is not a framework."],
  ["LOW", "IMPROVE", "Your buckets overlapped — costs appeared under both operations and profitability. Say each bucket out loud and check nothing lives in two places."],
  ["LOW", "IMPROVE", "Tie the structure back to the question that was asked. Start with \"To decide whether they should enter, I want to look at…\" so the tree has a job."],
  ["LOW", "CONTINUE", "You did lay out your buckets before diving in — keep that instinct, and give it more time to develop."],
  ["LOW", "CONTINUE", "You asked what the client's goal was before structuring. That habit is worth protecting."],
  ["LOW", "CONTINUE", "You noticed the framework wasn't fitting and said so rather than pushing through. Naming it is the right move."],
  ["LOW", "CONTINUE", "You wrote your structure down and referred back to it. Keep using the page as an anchor."],
  // --- MID (3) ---
  ["MID", "IMPROVE", "Prioritize out loud. After laying out the tree, say which branch you'd start with and why — that one sentence is what separates a 3 from a 4."],
  ["MID", "IMPROVE", "Lead with a hypothesis. \"My guess is this is a cost problem, because revenue grew\" gives the interviewer something to push on."],
  ["MID", "IMPROVE", "Your buckets were sound but generic. Tailor at least one branch to this industry so it's clear you're thinking about *this* client."],
  ["MID", "IMPROVE", "Signpost when you move between branches. The structure was there but the interviewer had to infer where you were in it."],
  ["MID", "CONTINUE", "Your tree was clean and genuinely MECE. Keep drawing it before you speak."],
  ["MID", "CONTINUE", "You came back to your framework after the math instead of abandoning it. Keep closing that loop."],
  ["MID", "CONTINUE", "You checked the goal and the constraints before structuring, so the tree pointed somewhere useful."],
  ["MID", "CONTINUE", "You kept the structure to three branches rather than six. Restraint reads as clarity."],
  // --- HIGH (4-5) ---
  ["HIGH", "IMPROVE", "Push one level deeper on the branch you prioritize. You earn credit for the sub-drivers, not the top-level buckets."],
  ["HIGH", "IMPROVE", "State what would have to be true for your hypothesis to hold, then go test exactly that. It's the fastest path through a case."],
  ["HIGH", "IMPROVE", "Say what you're *not* going to look at and why. Explicit deprioritization is a senior move."],
  ["HIGH", "IMPROVE", "Try compressing the walkthrough. Your structure was strong but took two minutes to narrate; aim for 45 seconds."],
  ["HIGH", "CONTINUE", "Excellent structure — MECE, prioritized, and hypothesis-driven from the first sentence. Keep exactly this."],
  ["HIGH", "CONTINUE", "You tailored the framework to the client's actual situation rather than reaching for a template. That's the difference-maker."],
  ["HIGH", "CONTINUE", "You prioritized a branch and justified the choice unprompted. Keep leading with the \"why this one first.\""],
  ["HIGH", "CONTINUE", "You adapted the structure mid-case when the data pointed elsewhere, without losing the thread."],
];

const QUANTITATIVE: Row[] = [
  ["LOW", "IMPROVE", "Set up the math before computing — state the equation, then plug in. Most errors here were setup errors, not arithmetic."],
  ["LOW", "IMPROVE", "Carry units through every line. \"400\" and \"400 units per store per month\" are different answers."],
  ["LOW", "IMPROVE", "Round aggressively and say you're doing it. 4.8M × 12% is 0.58M; you don't need three decimals to make the decision."],
  ["LOW", "IMPROVE", "Sanity-check the result before you say it. If a regional market comes out bigger than the national one, catch it yourself."],
  ["LOW", "CONTINUE", "You walked me through your setup out loud, which let me follow you. Keep narrating."],
  ["LOW", "CONTINUE", "You asked for the units on the exhibit before starting. Keep asking."],
  ["LOW", "CONTINUE", "When you got stuck you said what you were trying to compute rather than going silent. That's the right instinct."],
  ["LOW", "CONTINUE", "You wrote the numbers down in a structured way rather than doing it in your head."],
  ["MID", "IMPROVE", "Say the answer *and* what it means in the same breath. \"$4.2M, which is about 15% of their current revenue — meaningful\" beats \"$4.2M.\""],
  ["MID", "IMPROVE", "Do the sanity check out loud. You clearly did it internally; the interviewer only sees what you say."],
  ["MID", "IMPROVE", "Estimate the order of magnitude before computing, so you have something to check the result against."],
  ["MID", "IMPROVE", "Watch the pace — the arithmetic was correct but slow enough to eat time you needed later."],
  ["MID", "CONTINUE", "Your setup was clean and stated before you computed. Keep that sequence."],
  ["MID", "CONTINUE", "Your arithmetic was accurate under pressure and you didn't rush it."],
  ["MID", "CONTINUE", "You labelled your units throughout, which made the whole calculation easy to follow."],
  ["MID", "CONTINUE", "You caught your own slip and corrected it calmly rather than restarting."],
  ["HIGH", "IMPROVE", "After the number, always give the \"so what\" — and then say what you'd want to check next."],
  ["HIGH", "IMPROVE", "Try stating the sensitivity: which assumption is the answer most fragile to, and what range would change the recommendation?"],
  ["HIGH", "IMPROVE", "You can shorten the narration. Give the setup, the answer, and the implication; skip the intermediate steps unless asked."],
  ["HIGH", "IMPROVE", "Push on the data itself once in a while — ask whether the exhibit's denominator is the one you actually want."],
  ["HIGH", "CONTINUE", "Fast, accurate, and well-signposted math with a sanity check you volunteered. This is interview-ready."],
  ["HIGH", "CONTINUE", "You interpreted every number rather than just reporting it. Keep pairing the figure with its meaning."],
  ["HIGH", "CONTINUE", "Your unit discipline was flawless, including on the derived figures."],
  ["HIGH", "CONTINUE", "You chose a simpler path through the arithmetic than the obvious one and it saved real time."],
];

const JUDGMENT: Row[] = [
  ["LOW", "IMPROVE", "Ground your ideas in the client's situation. \"Do a marketing campaign\" is an answer to any case; say what *this* client would do."],
  ["LOW", "IMPROVE", "Before brainstorming, take 30 seconds and structure the ideas into two or three categories. Breadth reads better when it's organized."],
  ["LOW", "IMPROVE", "Check your ideas against real-world constraints — capital, regulation, timeline. An idea that fails the feasibility test costs you credibility."],
  ["LOW", "IMPROVE", "Ask what the client has already tried before proposing. It avoids suggesting the thing that failed last year."],
  ["LOW", "CONTINUE", "You generated ideas quickly and didn't freeze on the open-ended question."],
  ["LOW", "CONTINUE", "You brought a concrete example from outside the case, which showed you were thinking about the real world."],
  ["LOW", "CONTINUE", "You asked clarifying questions about the client's constraints rather than assuming."],
  ["LOW", "CONTINUE", "You were willing to commit to a view when pushed rather than hedging indefinitely."],
  ["MID", "IMPROVE", "Go for depth on your two best ideas rather than listing six. Say why each would work here and what would break it."],
  ["MID", "IMPROVE", "Name the risk in the recommendation without being asked. Volunteering the downside is what makes the upside believable."],
  ["MID", "IMPROVE", "Bring in the second-order effect — what does the competitor do next? That's usually the insight the case is testing for."],
  ["MID", "IMPROVE", "Quantify the idea roughly. \"Worth maybe $2M a year\" moves an idea from plausible to prioritized."],
  ["MID", "CONTINUE", "Your ideas were categorized before you listed them, which made the breadth legible."],
  ["MID", "CONTINUE", "You connected the recommendation back to the client's stated goal. Keep closing that loop."],
  ["MID", "CONTINUE", "You flagged a real-world constraint the exhibit didn't mention. Keep bringing outside knowledge in."],
  ["MID", "CONTINUE", "You prioritized among your own ideas rather than leaving the choice to me."],
  ["HIGH", "IMPROVE", "Push one idea to an implementation plan — who does what, by when, funded how. That's the partner-level layer."],
  ["HIGH", "IMPROVE", "Try naming the assumption the whole recommendation rests on, and what evidence would overturn it."],
  ["HIGH", "IMPROVE", "Consider the stakeholder view — what does the sales force, the regulator, or the board make of this?"],
  ["HIGH", "IMPROVE", "You could be more willing to disagree with the premise of the case when the data supports it."],
  ["HIGH", "CONTINUE", "Genuinely insightful — you found the driver the exhibit was hiding rather than the one it displayed."],
  ["HIGH", "CONTINUE", "Broad, well-organized ideation with a clear prioritization at the end. Keep that shape."],
  ["HIGH", "CONTINUE", "You brought real industry knowledge and used it to sharpen the answer, not to show off."],
  ["HIGH", "CONTINUE", "You surfaced the risks unprompted and had a mitigation for each. That's what makes a recommendation credible."],
];

const SYNTHESIS: Row[] = [
  ["LOW", "IMPROVE", "Lead with the recommendation, then the support. You built to your answer for two minutes; give it in the first sentence."],
  ["LOW", "IMPROVE", "Structure the synthesis: recommendation, two or three reasons, risks, next step. Same shape every time until it's automatic."],
  ["LOW", "IMPROVE", "Cut the recap. The interviewer sat through the case; they need your conclusion, not a summary of the last 30 minutes."],
  ["LOW", "IMPROVE", "Commit to an answer. \"It depends\" is only useful if you then say what it depends on and pick a side."],
  ["LOW", "CONTINUE", "You did give a clear recommendation by the end. Keep that, and move it to the front."],
  ["LOW", "CONTINUE", "You used the numbers from the case in your conclusion rather than speaking in generalities."],
  ["LOW", "CONTINUE", "You took a moment to collect your thoughts before synthesizing rather than starting cold."],
  ["LOW", "CONTINUE", "Your language was plain and jargon-free, which made the conclusion easy to follow."],
  ["MID", "IMPROVE", "Signpost as you go, not just at the end. \"Three reasons — first…\" tells me how long to listen and what to expect."],
  ["MID", "IMPROVE", "Tighten it. The recommendation was right but ran 90 seconds; aim for 45 with the same content."],
  ["MID", "IMPROVE", "End with the next step, not the conclusion. \"I'd want two weeks to validate the pricing assumption\" is what a client hears."],
  ["MID", "IMPROVE", "Quantify the recommendation. Attaching the number you computed makes the case for it much harder to argue with."],
  ["MID", "CONTINUE", "You led with the answer. Keep doing that every single time."],
  ["MID", "CONTINUE", "Your support was drawn directly from the analysis you'd done, not from general reasoning."],
  ["MID", "CONTINUE", "You named a risk alongside the recommendation without being prompted."],
  ["MID", "CONTINUE", "You signposted your reasons, which made a dense answer easy to track."],
  ["HIGH", "IMPROVE", "Try delivering it as if the CEO walked in with 60 seconds. Same content, ruthless about what survives."],
  ["HIGH", "IMPROVE", "Add the one thing that would change your mind. It signals judgment rather than stubbornness."],
  ["HIGH", "IMPROVE", "Vary the emphasis — everything was delivered at the same weight, so the most important reason didn't stand out."],
  ["HIGH", "IMPROVE", "Close with the ask. What do you need from the client to move?"],
  ["HIGH", "CONTINUE", "Top-down, tight, quantified, with risks and a next step. This is exactly the shape to keep."],
  ["HIGH", "CONTINUE", "You held the recommendation to under a minute without losing any of the substance."],
  ["HIGH", "CONTINUE", "Your signposting made a complex answer feel simple. Keep the numbered structure."],
  ["HIGH", "CONTINUE", "You brought the recommendation back to the client's original goal in the closing line."],
];

const PRESENCE: Row[] = [
  ["LOW", "IMPROVE", "Slow down. The pace made confident answers sound uncertain; a half-second pause before answering will do most of the work."],
  ["LOW", "IMPROVE", "When you're thinking, say so. \"Give me a moment to work through this\" is far better than filling silence with words."],
  ["LOW", "IMPROVE", "Listen to the whole question before answering. You started on two questions before I'd finished asking them."],
  ["LOW", "IMPROVE", "When pushed back on, don't abandon your answer immediately. Ask what I'm seeing, then decide whether to move."],
  ["LOW", "CONTINUE", "You stayed engaged and energetic across the whole case, which is harder than it sounds at 40 minutes."],
  ["LOW", "CONTINUE", "You asked for clarification when you didn't understand rather than guessing."],
  ["LOW", "CONTINUE", "You recovered after the tough exhibit rather than letting it colour the rest of the case."],
  ["LOW", "CONTINUE", "You were genuinely pleasant to case with. Don't lose that while you fix the mechanics."],
  ["MID", "IMPROVE", "Hold your ground once. When I pushed on the pricing number you folded — the number was right and you should have said so."],
  ["MID", "IMPROVE", "Watch the filler. \"Sort of\" and \"kind of\" appeared often enough to undercut otherwise firm answers."],
  ["MID", "IMPROVE", "Make the interaction two-way. Check in — \"does that land?\" — rather than delivering at me."],
  ["MID", "IMPROVE", "Keep the energy steady through the math. You went quiet and flat for four minutes, and it read as struggling."],
  ["MID", "CONTINUE", "You were composed under pushback and took the challenge as information rather than as an attack."],
  ["MID", "CONTINUE", "You listened well — several of your answers built directly on something I'd said."],
  ["MID", "CONTINUE", "Your pace was easy to follow and you didn't rush the hard parts."],
  ["MID", "CONTINUE", "You handled the ambiguity in the prompt without visible frustration."],
  ["HIGH", "IMPROVE", "Try being a bit more conversational — you're polished enough that a little warmth would make you memorable."],
  ["HIGH", "IMPROVE", "Push back on me once. You're right often enough that defending an answer would read as confidence, not stubbornness."],
  ["HIGH", "IMPROVE", "Use silence deliberately after your recommendation. Let it land instead of moving straight on."],
  ["HIGH", "IMPROVE", "Ask a question you actually want the answer to at the end. It shifts the register from candidate to colleague."],
  ["HIGH", "CONTINUE", "Poised, warm, and completely unbothered by pushback. This is the register to keep."],
  ["HIGH", "CONTINUE", "You made it feel like a conversation with a colleague rather than an examination."],
  ["HIGH", "CONTINUE", "Your listening was excellent — you caught the hint in my question and used it."],
  ["HIGH", "CONTINUE", "Steady energy and pace from the prompt to the synthesis, with no dip through the math."],
];

export const PHRASE_SEEDS: PhraseSeed[] = [
  ...rows("STRUCTURE", STRUCTURE),
  ...rows("QUANTITATIVE", QUANTITATIVE),
  ...rows("JUDGMENT", JUDGMENT),
  ...rows("SYNTHESIS", SYNTHESIS),
  ...rows("PRESENCE", PRESENCE),
];
