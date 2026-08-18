/**
 * Branded invite email — composition + dispatch.
 *
 * Split out of invite-actions.ts so callers that aren't server actions
 * (the Documenso webhook handler, in particular) can import and call
 * it without picking up the "use server" module semantics. The server
 * action `generateInviteLink` still uses this helper indirectly via
 * re-export in invite-actions.ts.
 *
 * Layout: FM turtle mark + wordmark, brand-magenta CTA, green accent
 * on the signature line. Table-based for Outlook compatibility;
 * inline styles for Gmail's stripped-<style> renderer.
 */
import { sendTransactionalEmail } from "@/lib/email";
import type { MembershipTier } from "@/lib/types";

export interface DispatchInviteEmailInput {
  targetEmail: string;
  targetName: string | null;
  targetTier: MembershipTier;
  /** Absolute URL to the FM invite page (build.afuturemodern.com/invite/<code>). */
  inviteUrl: string;
  /** Human-readable admin name for the sign-off line. */
  senderName: string;
}

export async function dispatchInviteEmail(
  input: DispatchInviteEmailInput,
): Promise<void> {
  const { text, html } = renderInviteEmail(input);
  await sendTransactionalEmail({
    to: input.targetEmail,
    subject:
      input.targetTier === "member"
        ? "You have been called to $BUILD with A Future Modern"
        : "A Future Modern — Talent Partner invitation",
    text,
    html,
  });
}

function renderInviteEmail(input: DispatchInviteEmailInput) {
  const greeting = input.targetName ? `Hi ${input.targetName},` : "Hi,";
  const tierLine =
    input.targetTier === "member"
      ? "You have been called to $BUILD with A Future Modern."
      : "You have been invited to $BUILD alongside A Future Modern as a Partner.";
  const expectation =
    input.targetTier === "member"
      ? "The care package flow will walk you through a letter, a signature, a code, and a short Terms acceptance. Ten minutes, tops."
      : "The Talent Partner LOI is already countersigned by A Future Modern. You'll add your signature, accept the Terms, and land on your dashboard.";

  const text = `${greeting}

${tierLine}

${expectation}

Your invitation:
${input.inviteUrl}

This link is single-use and expires in 14 days.

— ${input.senderName}
A Future Modern
`;

  const brandBase =
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    "https://build.afuturemodern.com";
  const turtleUrl = `${brandBase}/brand/turtle.png`;
  const wordmarkUrl = `${brandBase}/brand/wordmark.png`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td align="center" style="padding:32px 32px 8px;">
          <img src="${turtleUrl}" alt="A Future Modern" width="72" height="72" style="display:block;border:0;margin:0 auto 12px;"/>
          <img src="${wordmarkUrl}" alt="A Future Modern" height="20" style="display:block;border:0;margin:0 auto;height:20px;"/>
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <p style="margin:0 0 12px;font-size:14px;color:#666;">${greeting}</p>
          <p style="margin:0 0 20px;font-size:20px;line-height:1.35;font-weight:600;color:#111;">${tierLine}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333;">${expectation}</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 24px;">
          <a href="${input.inviteUrl}" style="display:inline-block;padding:14px 28px;background:#D828A0;color:#FFFFFF;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">Open your invitation</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#666;">
            Or copy this link:<br/>
            <a href="${input.inviteUrl}" style="color:#5070F0;word-break:break-all;text-decoration:none;">${input.inviteUrl}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#666;">Single-use. Expires in 14 days.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #EEE;">
          <p style="margin:0;font-size:13px;color:#666;">— ${input.senderName}<br/><span style="color:#007048;font-weight:500;">A Future Modern</span></p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#999;">You received this because someone at A Future Modern invited you personally.</p>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}
