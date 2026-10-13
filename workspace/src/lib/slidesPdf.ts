import type { PDFDocument as PdfDoc, PDFFont } from "pdf-lib";
import type { ViewSection } from "@/app/(app)/cases/[id]/CaseView";

/**
 * Builds the case's slides into one downloadable PDF, in delivery order.
 *
 * A case is a page range inside a much larger casebook, so this is not "hand
 * the coach the file" — it copies out only the pages the case actually uses,
 * in the order the runner presents them, which is what is on screen in the
 * slides view. A case that was typed rather than split from a PDF has no pages
 * to copy, so its text is drawn onto generated pages instead; otherwise a
 * typed case would download an empty document.
 *
 * Everything happens in the browser. pdf-lib is imported dynamically so its
 * weight only arrives when a coach actually asks for the file, and nothing is
 * assembled on the server — there is no bandwidth or CPU here to pay for, and
 * no route handler to add (CLAUDE.md: Server Actions only).
 */

/** Generated text pages are US Letter, matching what casebooks use. */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;

export async function buildSlidesPdf({
  fileUrl,
  sections,
}: {
  fileUrl: string | null;
  sections: ViewSection[];
}): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");

  const out = await PDFDocument.create();
  const body = await out.embedFont(StandardFonts.Helvetica);
  const heading = await out.embedFont(StandardFonts.HelveticaBold);

  // The casebook is only opened when a section actually points into it, so a
  // typed case never fetches a file it has no use for.
  const needsFile = sections.some((s) => !s.bodyText && s.startPage !== null);
  let source: PdfDoc | null = null;
  if (fileUrl && needsFile) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`The casebook file could not be read (${response.status}).`);
    }
    source = await PDFDocument.load(await response.arrayBuffer());
  }

  for (const section of sections) {
    if (section.bodyText?.trim()) {
      drawTextSection(out, section, { body, heading });
      continue;
    }

    if (!source || section.startPage === null) continue;

    // Page numbers are 1-based and come from a range a coach typed, so a range
    // that runs past the end of the casebook is possible. Clamp rather than
    // throw: a short deck is a better answer than no deck.
    const last = Math.min(section.endPage ?? section.startPage, source.getPageCount());
    const indices: number[] = [];
    for (let page = section.startPage; page <= last; page += 1) indices.push(page - 1);
    if (indices.length === 0) continue;

    const copied = await out.copyPages(source, indices);
    for (const page of copied) out.addPage(page);
  }

  if (out.getPageCount() === 0) {
    throw new Error("This case has no slides to export yet.");
  }

  // Uint8Array -> Blob via a fresh copy: pdf-lib hands back a view onto a
  // larger buffer, which Blob would otherwise serialise in full.
  const bytes = await out.save();
  return new Blob([bytes.slice()], { type: "application/pdf" });
}

type Fonts = { body: PDFFont; heading: PDFFont };

/** A typed section becomes its own page, titled, with the text wrapped onto it. */
function drawTextSection(out: PdfDoc, section: ViewSection, fonts: Fonts) {
  const width = PAGE_WIDTH - MARGIN * 2;
  let page = out.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(wrapToWidth(section.label, fonts.heading, 14, width)[0] ?? section.label, {
    x: MARGIN,
    y: y - 14,
    size: 14,
    font: fonts.heading,
  });
  y -= 36;

  // Blank lines are paragraph breaks and are kept; the text was written in a
  // textarea, so its line breaks are the only structure it has.
  for (const paragraph of section.bodyText!.split("\n")) {
    const lines = paragraph.trim() ? wrapToWidth(paragraph, fonts.body, 11, width) : [""];
    for (const line of lines) {
      if (y < MARGIN + 11) {
        page = out.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      if (line) {
        page.drawText(line, { x: MARGIN, y: y - 11, size: 11, font: fonts.body });
      }
      y -= 16;
    }
  }
}

/**
 * Greedy word wrap. A single word longer than the line is broken by character,
 * because pdf-lib's drawText does not wrap and would otherwise run the text
 * off the edge of the page.
 */
function wrapToWidth(text: string, font: PDFFont, size: number, width: number): string[] {
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

/** A filename a coach will recognise in their downloads folder. */
export function slidesFileName(title: string) {
  const stem = title.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
  return `${stem || "case"}-slides.pdf`;
}
