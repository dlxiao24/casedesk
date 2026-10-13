import type { KeyboardEvent } from "react";

/**
 * Bullet lists in the note and feedback fields.
 *
 * Coaches write in fragments while a candidate is mid-answer, and a dash is
 * what everyone already types to start a list. So "- " at the start of a line
 * becomes "• ", Enter carries the bullet down to the next line, and Enter on
 * an empty bullet ends the list rather than laying down another one.
 *
 * The bullet is a literal character in the stored text, not formatting layered
 * over it. These are plain textareas whose contents reach a candidate's report
 * as pre-wrapped text (§8), so what the coach types is exactly what the report
 * renders. Anything richer would need a markup layer the report cannot read.
 */
export const BULLET = "•";

/**
 * The runner stamps a line with `[12:34] ` on Cmd+Enter, and a coach may well
 * start a bullet after the stamp. Both are line-leading furniture, so both are
 * skipped when deciding what a line actually begins with.
 */
const LEAD = String.raw`[ \t]*(?:\[\d{1,2}:\d{2}\][ \t]*)?`;
const DASH_AT_LINE_START = new RegExp(`^(${LEAD})-$`);
const BULLET_AT_LINE_START = new RegExp(`^(${LEAD})${BULLET}[ \\t]*(.*)$`);

export type BulletEdit = { value: string; caret: number };

/**
 * What Space or Enter should do to a note field, or null to let the browser
 * handle the keystroke as usual. Pure, so it can be reasoned about and tested
 * without a DOM.
 */
export function bulletKeyEdit(
  key: string,
  value: string,
  selectionStart: number,
  selectionEnd: number,
): BulletEdit | null {
  // A selection means the keystroke replaces something. Leave that alone.
  if (selectionStart !== selectionEnd) return null;

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const linePrefix = value.slice(lineStart, selectionStart);
  const before = value.slice(0, lineStart);
  const after = value.slice(selectionStart);

  if (key === " ") {
    // Only a dash that *is* the line so far, so "margin 4 - 2" keeps its
    // hyphen and a coach doing arithmetic is never interrupted.
    const dash = DASH_AT_LINE_START.exec(linePrefix);
    if (!dash) return null;
    const replacement = `${dash[1]}${BULLET} `;
    return { value: `${before}${replacement}${after}`, caret: lineStart + replacement.length };
  }

  if (key === "Enter") {
    const bullet = BULLET_AT_LINE_START.exec(linePrefix);
    if (!bullet) return null;

    // An empty bullet means the coach has finished listing: take the bullet
    // away and leave them on the line rather than opening another one.
    if (!bullet[2].trim()) {
      return { value: `${before}${bullet[1]}${after}`, caret: lineStart + bullet[1].length };
    }

    // The stamp is not carried down — it marks one moment, not every line.
    const continuation = `\n${BULLET} `;
    return {
      value: `${before}${linePrefix}${continuation}${after}`,
      caret: selectionStart + continuation.length,
    };
  }

  return null;
}

/**
 * Wires the above onto a controlled textarea whose value the caller owns.
 *
 * A plain function rather than a hook so it can be used inside a list of
 * fields without hook-ordering rules to think about.
 *
 * The caret is restored after the controlled re-render, the same way the
 * runner's timestamp stamp does it: React otherwise leaves it at the end of
 * the value, dropping the coach past the text they were editing.
 */
export function applyBulletKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onValue: (value: string) => void,
) {
  // Cmd+Enter is the runner's timestamp and a modified Space is nobody's
  // bullet — every shortcut stays with its owner.
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const el = event.currentTarget;
  const edit = bulletKeyEdit(event.key, el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
  if (!edit) return;

  event.preventDefault();
  onValue(edit.value);
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = edit.caret;
  });
}
