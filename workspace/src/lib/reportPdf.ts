import type { PDFDocument as PdfDoc, PDFFont, PDFPage, rgb as Rgb } from "pdf-lib";
import { clock, longDate } from "@/lib/format";
import { sanitizeForPdf, wrapToWidth } from "@/lib/pdfText";
import type { ReportModel } from "@/lib/report";

/**
 * The feedback report as a typeset PDF (§8).
 *
 * Printing the screen produced what printing a screen always produces: the
 * browser's own header and footer in the corners — a date, a time, the page
 * URL — and whatever margins the print dialog happened to be set to. None of
 * that can be removed from the page's own stylesheet, because none of it
 * belongs to the page. So the document is built rather than captured.
 *
 * It renders the same ReportModel the page and the markdown copy render, which
 * is what keeps the three honest: anything excluded in loadReport.ts is
 * excluded here by never arriving. Built in the browser with pdf-lib, like the
 * slides export — spec §13 rules out generating PDFs on a server, and there is
 * nothing to pay for this way.
 */

const PAGE = { width: 612, height: 792 };
/** An inch all round. Wide enough to read, same as a word processor's default. */
const MARGIN = 72;
const CONTENT = PAGE.width - MARGIN * 2;

const INK = 0.1;
const MUTED = 0.45;
const RULE = 0.8;

type Fonts = { body: PDFFont; bold: PDFFont };

/** Carries the cursor down the page and starts new ones as it runs out. */
class Sheet {
  page: PDFPage;
  y: number;

  constructor(
    private doc: PdfDoc,
    private fonts: Fonts,
    /** pdf-lib is imported dynamically, so its colour helper is handed in. */
    private rgb: typeof Rgb,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  /** Starts a new page unless `height` still fits above the bottom margin. */
  room(height: number) {
    if (this.y - height >= MARGIN) return;
    this.break();
  }

  break() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  gap(height: number) {
    this.y -= height;
  }

  rule(grey = RULE) {
    this.room(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT, y: this.y },
      thickness: 0.75,
      color: this.rgb(grey, grey, grey),
    });
    this.y -= 12;
  }

  text(
    value: string,
    {
      size = 10.5,
      font = this.fonts.body,
      leading = 15,
      grey = INK,
      indent = 0,
    }: { size?: number; font?: PDFFont; leading?: number; grey?: number; indent?: number } = {},
  ) {
    const width = CONTENT - indent;
    // Blank lines are paragraph breaks and are kept: this text was written in
    // a textarea, so its line breaks are the only structure it has.
    for (const paragraph of sanitizeForPdf(value).split("\n")) {
      const lines = paragraph.trim() ? wrapToWidth(paragraph, font, size, width) : [""];
      for (const line of lines) {
        this.room(leading);
        if (line) {
          this.page.drawText(line, {
            x: MARGIN + indent,
            y: this.y - size,
            size,
            font,
            color: this.rgb(grey, grey, grey),
          });
        }
        this.y -= leading;
      }
    }
  }

  /** The small grey all-caps label each section of the report sits under. */
  sectionHeading(label: string) {
    // Kept with at least a line of whatever follows it.
    this.room(34);
    this.text(label.toUpperCase(), { size: 8, font: this.fonts.bold, leading: 13, grey: MUTED });
    this.gap(2);
  }
}

export async function buildReportPdf(model: ReportModel): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    body: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  doc.setTitle(`Case feedback — ${model.candidateName}`);
  doc.setAuthor(model.coachName);
  doc.setSubject(model.caseTitle);
  doc.setCreator("Case Desk");

  const sheet = new Sheet(doc, fonts, rgb);

  // ---- Header
  sheet.text("Case feedback", { size: 22, font: fonts.bold, leading: 28 });
  sheet.text(model.candidateName, { size: 14, leading: 20 });
  sheet.gap(2);
  const meta = [
    model.caseTitle,
    model.source,
    longDate(model.date),
    `Coach: ${model.coachName}`,
    model.totalSeconds ? `${Math.round(model.totalSeconds / 60)} minutes` : null,
  ].filter(Boolean) as string[];
  sheet.text(meta.join("  ·  "), { size: 9, leading: 13, grey: MUTED });
  sheet.gap(6);
  sheet.rule();
  sheet.gap(10);

  // ---- Scores
  if (model.includeScores && model.scores.length > 0) {
    sheet.sectionHeading("Scores");
    for (const score of model.scores) {
      sheet.room(18);
      const baseline = sheet.y - 10;
      sheet.page.drawText(sanitizeForPdf(score.label), {
        x: MARGIN,
        y: baseline,
        size: 10,
        font: fonts.body,
        color: rgb(INK, INK, INK),
      });

      // Five boxes, filled to the score — the printed form of ScoreBar.
      const boxes = MARGIN + 220;
      for (let i = 0; i < 5; i += 1) {
        const filled = i < score.value;
        sheet.page.drawRectangle({
          x: boxes + i * 16,
          y: baseline - 1,
          width: 12,
          height: 10,
          borderWidth: 0.75,
          borderColor: rgb(0.6, 0.6, 0.6),
          color: filled ? rgb(0.2, 0.2, 0.2) : rgb(1, 1, 1),
        });
      }
      sheet.page.drawText(`${score.value}/5`, {
        x: boxes + 5 * 16 + 6,
        y: baseline,
        size: 9,
        font: fonts.body,
        color: rgb(MUTED, MUTED, MUTED),
      });
      sheet.y -= 18;
    }
    sheet.gap(14);
  }

  // ---- Takeaways
  for (const [label, items] of [
    ["Keep doing", model.continueItems],
    ["Work on", model.improveItems],
  ] as const) {
    if (!model.includeTakeaways || items.length === 0) continue;
    sheet.sectionHeading(label);
    items.forEach((item, index) => {
      sheet.room(16);
      const top = sheet.y;
      sheet.page.drawText(`${index + 1}.`, {
        x: MARGIN,
        y: top - 10.5,
        size: 10.5,
        font: fonts.body,
        color: rgb(MUTED, MUTED, MUTED),
      });
      sheet.text(item, { indent: 18, leading: 15 });
      sheet.gap(4);
    });
    sheet.gap(10);
  }

  // ---- Overall
  if (model.includeOverall && model.overallNote?.trim()) {
    sheet.sectionHeading("Overall");
    sheet.text(model.overallNote.trim());
    sheet.gap(14);
  }

  // ---- Section by section
  const showDetail = model.includeFeedback || model.includeWhatWasSaid;
  const detail = model.sections.filter(
    (s) =>
      (model.includeFeedback && s.feedback.trim()) ||
      (model.includeWhatWasSaid && s.whatWasSaid.trim()) ||
      s.secondsSpent > 0,
  );

  if (showDetail && detail.length > 0) {
    // Its own page, as on screen: the judgment is read first and the record
    // second (§8).
    sheet.break();
    sheet.text("Section by section", { size: 15, font: fonts.bold, leading: 21 });
    sheet.text("Taken live during the case. Supporting material for the takeaways above.", {
      size: 9,
      leading: 13,
      grey: MUTED,
    });
    sheet.gap(8);

    for (const section of detail) {
      // A heading alone at the foot of a page reads as a mistake.
      sheet.room(52);
      const top = sheet.y;
      sheet.page.drawText(sanitizeForPdf(section.label), {
        x: MARGIN,
        y: top - 10,
        size: 10,
        font: fonts.bold,
        color: rgb(INK, INK, INK),
      });
      const spent = clock(section.secondsSpent);
      sheet.page.drawText(spent, {
        x: MARGIN + CONTENT - fonts.body.widthOfTextAtSize(spent, 9),
        y: top - 10,
        size: 9,
        font: fonts.body,
        color: rgb(MUTED, MUTED, MUTED),
      });
      sheet.y -= 14;
      sheet.rule(0.88);

      if (model.includeFeedback && section.feedback.trim()) {
        sheet.text("WHAT TO CHANGE", { size: 7.5, font: fonts.bold, leading: 11, grey: MUTED });
        sheet.text(section.feedback.trim(), { size: 10, leading: 14 });
        sheet.gap(6);
      }
      if (model.includeWhatWasSaid && section.whatWasSaid.trim()) {
        sheet.text("WHAT WAS SAID", { size: 7.5, font: fonts.bold, leading: 11, grey: MUTED });
        sheet.text(section.whatWasSaid.trim(), { size: 10, leading: 14, grey: 0.3 });
        sheet.gap(6);
      }
      sheet.gap(8);
    }
  }

  if (model.revisedAt) {
    sheet.gap(6);
    sheet.rule();
    sheet.text(`Revised ${longDate(model.revisedAt)}.`, { size: 8, leading: 12, grey: MUTED });
  }

  // ---- Page numbers, once the total is known. A quiet number and nothing
  // else: the date and URL the browser used to stamp here are exactly what
  // this export exists to get rid of.
  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((page, index) => {
      const label = `${index + 1} of ${pages.length}`;
      page.drawText(label, {
        x: (PAGE.width - fonts.body.widthOfTextAtSize(label, 8)) / 2,
        y: MARGIN / 2,
        size: 8,
        font: fonts.body,
        color: rgb(MUTED, MUTED, MUTED),
      });
    });
  }

  const bytes = await doc.save();
  return new Blob([bytes.slice()], { type: "application/pdf" });
}

/** A filename the candidate will recognise in their downloads folder. */
export function reportFileName(model: ReportModel): string {
  const clean = (value: string) =>
    value.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  const who = clean(model.candidateName) || "candidate";
  const what = clean(model.caseTitle);
  return [who, what, "feedback"].filter(Boolean).join("-").slice(0, 80) + ".pdf";
}
