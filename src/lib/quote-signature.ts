/**
 * What a client signs, and what both sides are sent afterwards.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-07)
 *
 * Pure module, no "use server", so the statement can be rendered on the
 * page the client signs and stored by the action from one definition.
 * A signature block that shows one wording and records another is worse
 * than no record at all.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * The affirming line, preloaded rather than typed.
 *
 * Says the three things that matter if this is ever argued about: who
 * they are signing for, that they have the authority to, and that this
 * is a quote rather than an invoice. The last one is deliberate. The
 * prices are proposed terms, ranges get settled before contracting, and
 * a client who believed they had agreed a final number has a fair
 * grievance even when the page said otherwise elsewhere.
 */
export function quoteSignatureStatement(clientDisplayName: string): string {
  return [
    `I am authorised to accept this proposal on behalf of ${clientDisplayName}.`,
    "I understand this is a quote and not an invoice: the figures are the Builders' proposed terms, and any range or negotiable price is settled with the team before contracting.",
    "Signing selects the lead Builder shown above and asks Future Modern to begin the engagement paperwork.",
  ].join(" ");
}

/** A signature has to look like a name, not a keystroke. */
export function isPlausibleSignature(typed: string, name: string): boolean {
  const sig = typed.trim();
  if (sig.length < 3) return false;
  // Not a hard identity check, and not meant to be. It catches "x" and
  // an accidental Enter, and leaves everything else to the person.
  return sig.toLowerCase() !== name.trim().toLowerCase().slice(0, 1);
}

export interface SignedCopyInput {
  clientDisplayName: string;
  projectTitle: string;
  signerName: string;
  signerEmail: string;
  signatureTyped: string;
  statement: string;
  signedAt: string;
  leadName: string;
  crew: { name: string; rate: string; timeline: string }[];
}

/**
 * The record both sides keep. Plain text and HTML, the same content in
 * both, because a signed copy that renders as a blank in somebody's
 * mail client is not a record.
 */
export function signedCopy(input: SignedCopyInput): {
  subject: string;
  text: string;
  html: string;
} {
  const when = new Date(input.signedAt).toUTCString();
  const subject = `Signed: Future Modern proposal for ${input.clientDisplayName}`;

  const crewLines = input.crew.map(
    (c) => `  ${c.name} — ${c.rate} — ${c.timeline}`,
  );

  const text = [
    `Proposal for ${input.clientDisplayName}`,
    `Engagement: ${input.projectTitle}`,
    "",
    `Signed by: ${input.signerName} <${input.signerEmail}>`,
    `Signature: ${input.signatureTyped}`,
    `Signed at: ${when}`,
    `Lead Builder selected: ${input.leadName}`,
    "",
    "Proposed crew and terms:",
    ...crewLines,
    "",
    "What was agreed:",
    input.statement,
    "",
    "This is a copy for both parties. Future Modern will be in touch to",
    "begin the engagement paperwork.",
  ].join("\n");

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:640px">
  <h2 style="margin:0 0 4px">Proposal for ${escapeHtml(input.clientDisplayName)}</h2>
  <p style="margin:0 0 16px;color:#555">${escapeHtml(input.projectTitle)}</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#555">Signed by</td><td>${escapeHtml(input.signerName)} &lt;${escapeHtml(input.signerEmail)}&gt;</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#555">Signature</td><td><em>${escapeHtml(input.signatureTyped)}</em></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#555">Signed at</td><td>${escapeHtml(when)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#555">Lead Builder</td><td>${escapeHtml(input.leadName)}</td></tr>
  </table>
  <h3 style="margin:0 0 6px;font-size:14px">Proposed crew and terms</h3>
  <ul style="margin:0 0 16px;padding-left:18px">
    ${input.crew.map((c) => `<li>${escapeHtml(c.name)} — ${escapeHtml(c.rate)} — ${escapeHtml(c.timeline)}</li>`).join("")}
  </ul>
  <h3 style="margin:0 0 6px;font-size:14px">What was agreed</h3>
  <p style="margin:0 0 16px;color:#333">${escapeHtml(input.statement)}</p>
  <p style="color:#777;font-size:12px">This is a copy for both parties. Future Modern will be in touch to begin the engagement paperwork.</p>
</div>`.trim();

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
