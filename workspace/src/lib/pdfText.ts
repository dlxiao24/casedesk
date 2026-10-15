import type { PDFFont } from "pdf-lib";

/**
 * Text helpers shared by the two things that typeset a PDF in the browser:
 * the case slides export and the feedback report.
 */

/**
 * The characters pdf-lib's standard fonts can actually encode.
 *
 * Standard fonts are WinAnsi, which covers Latin-1 plus a handful of
 * typographic characters — curly quotes, dashes, the bullet, the ellipsis.
 * Anything else throws when drawn, and a coach who pasted an emoji into their
 * feedback would otherwise get an export that fails instead of a document.
 */
const WINANSI_EXTRAS = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""),
);

/**
 * Makes a string safe to draw. Unsupported characters are dropped rather than
 * replaced with a marker: a candidate's feedback document should not be
 * littered with question marks because someone typed an arrow.
 */
export function sanitizeForPdf(text: string): string {
  let out = "";
  for (const character of text.normalize("NFC")) {
    const code = character.codePointAt(0) ?? 0;
    if (character === "\n" || character === "\t") {
      out += character;
    } else if (code >= 0x20 && code <= 0xff) {
      out += character;
    } else if (WINANSI_EXTRAS.has(character)) {
      out += character;
    }
  }
  // Dropping a character can leave a double space behind it.
  return out.replace(/[ \t]{2,}/g, " ");
}

/**
 * Greedy word wrap. A single word longer than the line is broken by character,
 * because pdf-lib's drawText does not wrap and would otherwise run the text
 * off the edge of the page.
 */
export function wrapToWidth(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= width) {
      line = word;
      continue;
    }
    let chunk = "";
    for (const character of word) {
      if (font.widthOfTextAtSize(chunk + character, size) > width) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk += character;
      }
    }
    line = chunk;
  }

  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}
