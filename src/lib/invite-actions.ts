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
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { inviteLinks } from "@/db/schema";
import {
  MOCK_INVITE_LINKS,
  createInviteLinkRecord,
  findInviteById,
} from "@/lib/mock-data/invite-links";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { MembershipTier } from "@/lib/types";
import {
  DOCUMENSO_TEMPLATES,
  DocumensoError,
  generateDocumentFromTemplate,
  getTemplate,
} from "@/lib/documenso";

// ────────────────────────────────────────────────────────────────
//  Admin: generate + revoke invite links
// ────────────────────────────────────────────────────────────────

const VALID_TIERS: MembershipTier[] = [
  "viewer",
  "prospect",
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
  if (!targetTier || !VALID_TIERS.includes(targetTier as MembershipTier)) {
    throw new Error("Pick a target tier.");
  }

  const invite = createInviteLinkRecord({
    targetEmail,
    targetTier: targetTier as MembershipTier,
    targetName: targetName.length > 0 ? targetName : null,
    note: note.length > 0 ? note : null,
    createdByUserId: admin.id,
  });

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

  revalidatePath("/admin/members");
  revalidatePath("/admin/members/invite");
  revalidatePath("/admin/audit-log");
}

export async function revokeInviteLink(formData: FormData) {
  const admin = await requireAdmin();
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!inviteId) throw new Error("inviteId is required");
  const invite = findInviteById(inviteId);
  if (!invite) throw new Error("Invite not found");
  if (invite.revokedAt) throw new Error("Invite is already revoked");
  if (invite.consumedAt) {
    throw new Error(
      "Invite was already consumed; revoke the resulting user account instead of the invite.",
    );
  }

  invite.revokedAt = new Date().toISOString();
  invite.revokedReason = reason.length > 0 ? reason : null;

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
 * Complete the invite: enforce T&C acceptance, optionally record data
 * opt-in, consume the invite, redirect to the welcome landing.
 *
 * MVP: does not yet create the User row — that lands with the Auth.js
 * activation sprint (see task #7). Placeholder here consumes the
 * invite so the flow has a terminal state.
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

  const now = new Date().toISOString();
  await db
    .update(inviteLinks)
    .set({
      consumedAt: now,
      // consumedByUserId lands when the User row is created (Auth.js sprint).
    })
    .where(eq(inviteLinks.id, invite.id));

  // TODO (Auth.js activation): create the User row here, seed
  // membership_tier from invite.targetTier, kick off session, redirect
  // to /dashboard. Also persist dataOptIn as a talent-data agreement
  // row (see legal.md talent-data-agreement) when opted in.
  void dataOptIn;

  revalidatePath("/admin/agreements");
  revalidatePath("/admin/members");
  redirect(`/invite/${code}/welcome`);
}
