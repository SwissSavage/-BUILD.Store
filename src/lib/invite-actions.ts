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

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111; background: #fff;">
  <p style="margin: 0 0 16px;">${greeting}</p>
  <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.5;"><strong>${tierLine}</strong></p>
  <p style="margin: 0 0 24px; line-height: 1.6;">${expectation}</p>
  <p style="margin: 0 0 24px;">
    <a href="${input.inviteUrl}" style="display: inline-block; padding: 12px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 999px; font-weight: 500;">Open your invitation</a>
  </p>
  <p style="margin: 0 0 24px; font-size: 13px; color: #666;">Or copy this link:<br/><a href="${input.inviteUrl}" style="color: #666; word-break: break-all;">${input.inviteUrl}</a></p>
  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">This link is single-use and expires in 14 days.</p>
  <p style="margin: 24px 0 0; font-size: 13px; color: #666;">— ${input.senderName}<br/>A Future Modern</p>
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
 * the invite's targetEmail + targetName, does NOT call sendDocument
 * (the invitee is looking at the screen and gets redirected straight
 * into the signing URL — Documenso's email would be redundant), then
 * redirects into the signingUrl from the create-response.
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
