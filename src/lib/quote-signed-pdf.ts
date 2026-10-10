/**
 * The quote as a document: a line-item sheet, not a contract.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT LOOKS LIKE THIS (2026-10-08)
 *
 * The first version was six numbered legal sections. Jamar's note:
 * "This is too much. People know what they're signing." The reference
 * is a HubSpot quote, which is a header, a table of what you are
 * buying with prices against it, a total, an expiry, and somewhere to
 * sign. Nothing else.
 *
 * So this is that. Who it is for, what is being proposed, what each
 * Builder costs, the total, and one line saying it is a quote rather
 * than an invoice, because ranges settle before contracting and that
 * is the one thing a client could reasonably misread.
 *
 * WHY GENERATED PER QUOTE RATHER THAN A STATIC TEMPLATE
 *
 * A Documenso template is a fixed document. The Builders, their rates,
 * their deliverables and their timelines differ on every quote, so a
 * template could only ever accept by reference and leave the numbers
 * on the web page. A client signing a document with no prices on it is
 * the thing this format exists to avoid.
 *
 * pdf-lib rather than a headless browser: pure JavaScript, no system
 * dependencies, and this runs in the app container where a Chromium
 * install would roughly double the image.
 * ─────────────────────────────────────────────────────────────
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface QuoteLineItem {
  /** Builder, as the client sees them. First name and initial. */
  name: string;
  /** What they do on this engagement. */
  role: string;
  /** Their deliverables, one per line under the row. */
  deliverables: string[];
  /** Client-facing price, already grossed up. */
  rate: string;
  /** Their own commitment, e.g. "6 weeks" or "20 hrs/week". */
  timeline: string;
}

export interface SignedQuotePdfInput {
  clientDisplayName: string;
  projectTitle: string;
  quoteId: string;
  preparedOn: string;
  /** Aggregate across the crew, already formatted. */
  total: string;
  /** "hourly, billed as delivered" and the like. */
  totalBasis: string;
  lineItems: QuoteLineItem[];
  leadName: string | null;
  /** Present only once signed. Absent on the pre-signature copy. */
  signature?: {
    signerName: string;
    signerEmail: string;
    signedAt: string;
    signerIp: string | null;
  };
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, points
const MARGIN = 48;

export async function buildSignedQuotePdf(
  input: SignedQuotePdfInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Quote for ${input.clientDisplayName}`);
  pdf.setSubject(input.projectTitle);
  pdf.setProducer("Future Modern");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  const width = PAGE.width - MARGIN * 2;
  let y = PAGE.height - MARGIN;

  const ink = rgb(0.09, 0.09, 0.09);
  const muted = rgb(0.45, 0.45, 0.45);
  const rule = rgb(0.85, 0.85, 0.85);
  const magenta = rgb(0.85, 0.11, 0.38);

  function newPageIfNeeded(space: number) {
    if (y - space < MARGIN + 30) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  }

  function wrap(text: string, font: typeof regular, size: number, max: number) {
    const out: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > max && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
    return out;
  }

  function text(
    value: string,
    opts: {
      x?: number;
      size?: number;
      font?: typeof regular;
      color?: typeof ink;
      maxWidth?: number;
      gap?: number;
    } = {},
  ) {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    for (const line of wrap(value, font, size, opts.maxWidth ?? width)) {
      newPageIfNeeded(size + 4);
      page.drawText(line, {
        x: opts.x ?? MARGIN,
        y,
        size,
        font,
        color: opts.color ?? ink,
      });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  }

  /** Right-aligned, for prices in the amount column. */
  function amount(value: string, size = 10, font = regular, color = ink) {
    const w = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: PAGE.width - MARGIN - w, y: y + size + 4, size, font, color });
  }

  function hairline(gap = 8) {
    newPageIfNeeded(gap + 2);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.5,
      color: rule,
    });
    y -= gap;
  }

  // ── header ───────────────────────────────────────────────────
  text("FUTURE MODERN", { size: 9, font: bold, color: magenta, gap: 6 });
  text(input.projectTitle, { size: 20, font: bold, gap: 2 });
  text(
    `Prepared ${input.preparedOn}  ·  Quote ${input.quoteId}  ·  For ${input.clientDisplayName}`,
    { size: 9, color: muted, gap: 14 },
  );

  // ── line items ───────────────────────────────────────────────
  text("PROPOSED CREW", { size: 9, font: bold, color: muted, gap: 6 });
  hairline(10);

  for (const item of input.lineItems) {
    newPageIfNeeded(60);
    const nameLine = input.leadName === item.name
      ? `${item.name}  (lead)`
      : item.name;
    text(nameLine, { size: 11, font: bold, maxWidth: width - 130 });
    amount(item.rate, 11, bold);
    text(item.role, { size: 9, color: muted, maxWidth: width - 130 });
    amount(item.timeline, 9, regular, muted);
    for (const d of item.deliverables) {
      text(`•  ${d}`, { x: MARGIN + 10, size: 9, color: ink, maxWidth: width - 140 });
    }
    y -= 6;
    hairline(10);
  }

  // ── total ────────────────────────────────────────────────────
  newPageIfNeeded(50);
  text("Total", { size: 12, font: bold });
  amount(input.total, 12, bold);
  text(input.totalBasis, { size: 9, color: muted, gap: 10 });
  text(
    "This is a quote, not an invoice. Figures are the Builders' proposed terms; any range or negotiable price is settled with the team before contracting. Totals exclude applicable taxes.",
    { size: 8.5, color: muted, gap: 18 },
  );

  // ── signature ────────────────────────────────────────────────
  newPageIfNeeded(110);
  text("ACCEPTED", { size: 9, font: bold, color: muted, gap: 6 });
  hairline(14);

  if (input.signature) {
    text(input.signature.signerName, { size: 11, font: bold });
    text(input.signature.signerEmail, { size: 9, color: muted });
    text(
      `Signed ${new Date(input.signature.signedAt).toUTCString()}${
        input.signature.signerIp ? `  ·  ${input.signature.signerIp}` : ""
      }`,
      { size: 8.5, color: muted },
    );
  } else {
    // The unsigned copy. The box is where the Documenso signature
    // field gets placed; everything below it is Documenso's to fill.
    y -= 46;
    page.drawRectangle({
      x: MARGIN,
      y,
      width: 240,
      height: 46,
      borderColor: rule,
      borderWidth: 0.5,
    });
    y -= 12;
    text("Signature", { size: 8.5, color: muted });
    text("Name, title, date", { size: 8.5, color: muted });
  }

  return Buffer.from(await pdf.save());
}
