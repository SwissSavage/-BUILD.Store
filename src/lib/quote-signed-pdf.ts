/**
 * The signed copy, as a document rather than an email body.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A PDF (2026-10-07)
 *
 * A signed quote gets forwarded to a finance team, filed, and read back
 * months later when somebody asks what was agreed. An email body does
 * none of that well: it loses its formatting on forward, it cannot be
 * attached to an invoice, and nobody treats it as a document.
 *
 * pdf-lib rather than a headless browser. It is pure JavaScript with no
 * system dependencies, which matters because this runs inside the same
 * container as the app and a Chromium install would roughly double the
 * image.
 *
 * Deliberately plain. This is a record, not a brochure: the client
 * already saw the designed version on the web page, and what they need
 * in a file is the terms, the signature and the date, legible on any
 * reader and printable without surprises.
 * ─────────────────────────────────────────────────────────────
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface SignedQuotePdfInput {
  clientDisplayName: string;
  projectTitle: string;
  signerName: string;
  signerEmail: string;
  signatureTyped: string;
  statement: string;
  signedAt: string;
  signerIp: string | null;
  leadName: string;
  crew: { name: string; rate: string; timeline: string }[];
  quoteId: string;
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, points
const MARGIN = 56;

export async function buildSignedQuotePdf(
  input: SignedQuotePdfInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Signed proposal — ${input.clientDisplayName}`);
  pdf.setSubject(input.projectTitle);
  pdf.setProducer("Future Modern");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const ink = rgb(0.09, 0.09, 0.09);
  const muted = rgb(0.42, 0.42, 0.42);
  const width = PAGE.width - MARGIN * 2;

  /** Wrap on measured width, so long client names cannot run off the page. */
  function wrap(text: string, font: typeof regular, size: number): string[] {
    const out: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      out.push(line);
    }
    return out;
  }

  function write(
    text: string,
    opts: { font?: typeof regular; size?: number; color?: typeof ink; gap?: number } = {},
  ) {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    for (const line of wrap(text, font, size)) {
      // New page before writing into the bottom margin, rather than
      // after, so a line is never half off the page.
      if (y < MARGIN + size) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font,
        color: opts.color ?? ink,
      });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  }

  write("FUTURE MODERN", { font: bold, size: 9, color: muted, gap: 6 });
  write(`Signed proposal for ${input.clientDisplayName}`, { font: bold, size: 18, gap: 2 });
  write(input.projectTitle, { color: muted, gap: 16 });

  write("SIGNATURE", { font: bold, size: 9, color: muted, gap: 6 });
  write(`Signed by   ${input.signerName}`, { gap: 0 });
  write(`Email       ${input.signerEmail}`, { gap: 0 });
  write(`Signature   ${input.signatureTyped}`, { font: italic, gap: 0 });
  write(`Signed at   ${new Date(input.signedAt).toUTCString()}`, { gap: 0 });
  if (input.signerIp) write(`From        ${input.signerIp}`, { gap: 0 });
  write(`Reference   ${input.quoteId}`, { gap: 16 });

  write("LEAD BUILDER SELECTED", { font: bold, size: 9, color: muted, gap: 6 });
  write(input.leadName, { gap: 16 });

  write("PROPOSED CREW AND TERMS", { font: bold, size: 9, color: muted, gap: 6 });
  for (const member of input.crew) {
    write(`${member.name}`, { font: bold, gap: 0 });
    write(`${member.rate} · ${member.timeline}`, { color: muted, gap: 6 });
  }
  y -= 10;

  write("WHAT WAS AGREED", { font: bold, size: 9, color: muted, gap: 6 });
  write(input.statement, { gap: 16 });

  write(
    "This is a quote, not an invoice. Figures are the Builders' proposed terms; any range or negotiable price is settled with the team before contracting. A copy of this document has been sent to both parties.",
    { size: 9, color: muted },
  );

  return Buffer.from(await pdf.save());
}
