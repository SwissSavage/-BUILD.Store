/**
 * Invite-link admin + care package server actions.
 *
 * Two clusters live here:
 *
 * 1. Admin-side invite-link management (generateInviteLink,
 *    revokeInviteLink) called from /admin/members/invite. Still on
 *    MOCK_INVITE_LINKS pending Drizzle swap of the invite_links table.
 *    Sandbox displays the URL in the admin surface for manual send
 *    (email, DM, Signal, whatever); production dispatches by the
 *    configured email provider (see production-swap-checklist §7c).
 *
 * 2. Care package flow (sendInviteLoiForSignature, completeInviteSignup)
 *    called from /invite/[code]/sign and /invite/[code]/code. These
 *    already read the real Drizzle inviteLinks table — the admin
 *    generator write path lands on the mock during a beta window and
 *    the care package read path lands on the DB, which is
 *    inconsistent. Follow-up: swap the admin path to Drizzle so both
 *    ends write and read the same store.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth-stub";
import { createDirectSession, createFmUser } from "@/lib/auth";
import { db } from "@/db/client";
import { inviteLinks, users } from "@/db/schema";
import { MOCK_INVITE_LINKS } from "@/lib/mock-data/invite-links";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { MembershipTier } from "@/lib/types";
import { sendTransactionalEmail } from "@/lib/email";
import {
  DOCUMENSO_TEMPLATES,
  DocumensoError,
  generateDocumentFromTemplate,
  getTemplate,
  sendDocument,
} from "@/lib/documenso";

// Default invite lifetime — 14 days from issue.
const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function newInviteId(): string {
  return `invite_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function newInviteCode(): string {
  // 32 bytes → 43-char base64url token. URL-safe, hard to guess.
  return randomBytes(32).toString("base64url");
}

/**
 * Build the absolute invite URL from AUTH_URL or the request origin.
 * Prefer AUTH_URL so the link works when generated from an admin
 * surface hosted behind a proxy that rewrites the request origin.
 */
async function inviteUrlFor(code: string): Promise<string> {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (base) return `${base.replace(/\/$/, "")}/invite/${code}`;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/invite/${code}`;
}

function renderInviteEmail(input: {
  targetName: string | null;
  targetTier: MembershipTier;
  inviteUrl: string;
  senderName: string;
}) {
  const greeting = input.targetName ? `Hi ${input.targetName},` : "Hi,";
  const tierLine =
    input.targetTier === "member"
      ? "You have been called to $BUILD with A Future Modern."
      : "You have been invited to $BUILD alongside A Future Modern as a Partner.";
  const expectation =
    input.targetTier === "member"
      ? "The care package flow will walk you through a letter, a signature, a code, and a short Terms acceptance. Ten minutes, tops."
      : "You will sign a Talent Partner Letter of Intent, accept the Terms, and land on your dashboard.";

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

// ────────────────────────────────────────────────────────────────
//  Admin: generate + revoke invite links
// ────────────────────────────────────────────────────────────────

// Only Partner and Member can be invited via this flow. Viewer is the
// default state for any signed-up account and doesn't merit the
// ceremonial invite; if someone should just have public site access,
// send them the site URL, not an invite link.
const VALID_TIERS: Exclude<MembershipTier, "viewer">[] = [
  "partner",
  "member",
];

export async function generateInviteLink(formData: FormData) {
  const admin = await requireAdmin();
  const targetEmail = String(formData.get("targetEmail") ?? "")
    .trim()
    .toLowerCase();
  const targetTier = String(formData.get("targetTier") ?? "").trim() as
    | MembershipTier
    | "";
  const targetName = String(formData.get("targetName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!targetEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
    throw new Error("A valid target email is required.");
  }
  if (!targetTier || !VALID_TIERS.includes(targetTier as Exclude<MembershipTier, "viewer">)) {
    throw new Error(
      "Pick a target tier. Invites are for Partner or Member only. Send viewers the public site link instead.",
    );
  }

  const now = new Date();
  const invite = {
    id: newInviteId(),
    code: newInviteCode(),
    targetEmail,
    targetTier: targetTier as "partner" | "member",
    targetName: targetName.length > 0 ? targetName : null,
    note: note.length > 0 ? note : null,
    createdByUserId: admin.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS).toISOString(),
    consumedAt: null,
    consumedByUserId: null,
    revokedAt: null,
    revokedReason: null,
  };

  await db.insert(inviteLinks).values(invite);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.invited",
    resourceKind: "user",
    resourceId: invite.id,
    before: null,
    after: {
      targetEmail: invite.targetEmail,
      targetTier: invite.targetTier,
      expiresAt: invite.expiresAt,
    },
    reason: note.length > 0 ? note : null,
  });

  // Fire the invite email. Failure here doesn't roll back the invite —
  // the admin can resend from /admin/members if the first delivery
  // errors out. Log the failure so it surfaces in server logs.
  try {
    const inviteUrl = await inviteUrlFor(invite.code);
    const { text, html } = renderInviteEmail({
      targetName: invite.targetName,
      targetTier: invite.targetTier,
      inviteUrl,
      senderName: [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.handle || "Future Modern",
    });
    await sendTransactionalEmail({
      to: invite.targetEmail,
      subject:
        invite.targetTier === "member"
          ? "You have been called to $BUILD with A Future Modern"
          : "A Future Modern — Talent Partner invitation",
      text,
      html,
    });
  } catch (err) {
    console.error("[invite] email dispatch failed", {
      inviteId: invite.id,
      targetEmail: invite.targetEmail,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/admin/members");
  revalidatePath("/admin/members/invite");
  revalidatePath("/admin/audit-log");
}

export async function revokeInviteLink(formData: FormData) {
  const admin = await requireAdmin();
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!inviteId) throw new Error("inviteId is required");
  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.id, inviteId))
    .limit(1);
  if (!invite) throw new Error("Invite not found");
  if (invite.revokedAt) throw new Error("Invite is already revoked");
  if (invite.consumedAt) {
    throw new Error(
      "Invite was already consumed; revoke the resulting user account instead of the invite.",
    );
  }

  const revokedAt = new Date().toISOString();
  const revokedReason = reason.length > 0 ? reason : null;
  await db
    .update(inviteLinks)
    .set({ revokedAt, revokedReason })
    .where(eq(inviteLinks.id, invite.id));

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.invite_revoked",
    resourceKind: "user",
    resourceId: invite.id,
    before: { revokedAt: null },
    after: {
      revokedAt: invite.revokedAt,
      targetEmail: invite.targetEmail,
    },
    reason: reason.length > 0 ? reason : null,
  });

  revalidatePath("/admin/members/invite");
  revalidatePath("/admin/audit-log");
}

// Keep the store reference explicit for linter friendliness.
void MOCK_INVITE_LINKS;

// ────────────────────────────────────────────────────────────────
//  Care package: /invite/[code] onboarding flow
// ────────────────────────────────────────────────────────────────

/**
 * Kick off the LOI signature for an invite. Called from the
 * /invite/[code]/sign page. Generates the Documenso document scoped to
 * the invite's targetEmail + targetName, activates the envelope via
 * sendDocument({ sendEmail: false }) so the signing URL becomes live
 * without Documenso firing its own email (the invitee is already
 * on-screen and gets redirected straight into the signing URL — we
 * suppress the duplicate email), then redirects into the signingUrl
 * from the create-response.
 *
 * The sendDocument({ sendEmail: false }) call is required: without it
 * the envelope stays in DRAFT status and Documenso's /sign/<token>
 * URLs return 404 until send transitions the envelope to PENDING.
 *
 * externalId on the envelope carries "invite:<code>" so the Documenso
 * webhook can advance invite state (letter_of_intent_signed_at) on
 * completion. That column lands as a follow-up migration.
 */
export async function sendInviteLoiForSignature(
  code: string,
  origin: string,
): Promise<void> {
  if (!code) throw new Error("Invite code is required.");
  if (!origin) throw new Error("Origin is required for redirect URL.");

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite) throw new Error("Invite not found.");
  if (invite.revokedAt) throw new Error("This invitation has been revoked.");
  if (invite.consumedAt) throw new Error("This invitation has already been used.");
  if (new Date(invite.expiresAt) < new Date()) {
    throw new Error("This invitation has expired.");
  }

  const templateId = DOCUMENSO_TEMPLATES.TALENT_PARTNER_LOI;
  if (!templateId) {
    throw new DocumensoError(
      "DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI env var is not set. Populate the numeric template id from Documenso.",
      500,
      null,
    );
  }

  const template = await getTemplate(templateId);
  const placeholder = template.Recipient?.[0];
  if (!placeholder) {
    throw new DocumensoError(
      `Talent Partner LOI template ${templateId} has no placeholder recipient. Add one in Documenso.`,
      400,
      null,
    );
  }

  const recipientName = invite.targetName ?? invite.targetEmail;

  let signingUrl: string | undefined;
  try {
    const generated = await generateDocumentFromTemplate({
      templateId,
      recipients: [
        {
          id: placeholder.id,
          email: invite.targetEmail,
          name: recipientName,
        },
      ],
      title: `Talent Partner Letter of Intent — ${recipientName}`,
      externalId: `invite:${code}`,
      meta: {
        redirectUrl: `${origin}/invite/${code}/code`,
      },
    });
    signingUrl = generated.recipients?.[0]?.signingUrl;
    // Activate the envelope (DRAFT -> PENDING) so the signing URL
    // stops returning 404. sendEmail: false suppresses Documenso's
    // own notification; we already have the on-screen redirect path.
    if (generated.id) {
      await sendDocument(generated.id, { sendEmail: false });
    }
  } catch (err) {
    if (err instanceof DocumensoError) {
      throw new Error(
        `Documenso rejected the LOI envelope: ${err.message} (HTTP ${err.status}). ` +
          `Check DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI and the template on sign.afuturemodern.com.`,
      );
    }
    throw err;
  }

  if (!signingUrl) {
    throw new Error(
      "Documenso returned no signing URL. Retry, or contact the admin who sent your invitation.",
    );
  }

  redirect(signingUrl);
}

/**
 * Complete the invite: enforce T&C acceptance, provision the User row
 * from the invite's target tier, consume the invite, mint a session
 * cookie so the invitee lands on /welcome already signed in, then
 * redirect to the welcome landing.
 *
 * Idempotent-ish on the user side: if a user row with the invite's
 * targetEmail already exists (e.g. someone signed in as a viewer with
 * the same email before completing the ceremony), reuse it and upgrade
 * its membershipTier to the invite's target tier. This avoids the
 * ceremony creating a duplicate account.
 *
 * Data opt-in TODO: persist a talent-data agreement row when opted in
 * (see legal.md talent-data-agreement). MVP does not yet write this;
 * the checkbox exists so consent is captured client-side and can be
 * backfilled once the agreements table is wired.
 *
 * FormData:
 *   - code               invite code (required)
 *   - termsAccepted      "on" if the required Terms checkbox is checked
 *   - dataOptIn          "on" if the optional data-participation checkbox is checked
 */
export async function completeInviteSignup(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  const termsAccepted = String(formData.get("termsAccepted") ?? "") === "on";
  const dataOptIn = String(formData.get("dataOptIn") ?? "") === "on";

  if (!code) throw new Error("Invite code is required.");
  if (!termsAccepted) {
    throw new Error(
      "You must accept the Terms of Service to complete signup.",
    );
  }

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite) throw new Error("Invite not found.");
  if (invite.consumedAt) {
    throw new Error("This invitation has already been used.");
  }
  if (invite.revokedAt) {
    throw new Error("This invitation has been revoked.");
  }

  // Find or create the User row for this invitee. If a viewer-tier
  // account already exists with the same email (someone signed in
  // before completing the ceremony), reuse it and promote the tier.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invite.targetEmail))
    .limit(1);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({
        membershipTier: invite.targetTier,
        name: invite.targetName ?? undefined,
      })
      .where(eq(users.id, userId));
  } else {
    userId = await createFmUser({
      email: invite.targetEmail,
      name: invite.targetName,
      membershipTier: invite.targetTier,
      // emailVerified — the invite click plus LOI signature is enough
      // trust; mark verified so downstream flows don't ask again.
      emailVerified: new Date(),
    });
  }

  const now = new Date().toISOString();
  await db
    .update(inviteLinks)
    .set({
      consumedAt: now,
      consumedByUserId: userId,
    })
    .where(eq(inviteLinks.id, invite.id));

  // TODO: persist dataOptIn as a talent-data agreement row.
  void dataOptIn;

  // Mint the session cookie so the invitee lands on /welcome signed in.
  await createDirectSession(userId);

  revalidatePath("/admin/agreements");
  revalidatePath("/admin/members");
  redirect(`/invite/${code}/welcome`);
}
