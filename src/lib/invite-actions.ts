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
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth-stub";
import { createDirectSession, createFmUser } from "@/lib/auth";
import { db } from "@/db/client";
import { recordInviteCeremonyAgreements } from "@/lib/writers/agreements";
import { inviteLinks, users } from "@/db/schema";
import { MOCK_INVITE_LINKS } from "@/lib/mock-data/invite-links";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { MembershipTier } from "@/lib/types";
import {
  DOCUMENSO_TEMPLATES,
  DocumensoError,
  generateDocumentFromTemplate,
  getTemplate,
  sendDocument,
} from "@/lib/documenso";
import { dispatchInviteEmail } from "@/lib/invite-email";

/** Admin countersigner defaults when no admin-specific override is set. */
function adminSenderName(admin: {
  firstName?: string | null;
  lastName?: string | null;
  handle?: string;
}): string {
  return (
    [admin.firstName, admin.lastName].filter(Boolean).join(" ") ||
    admin.handle ||
    "Future Modern"
  );
}

// Default invite lifetime — 14 days from issue.
const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function newInviteId(): string {
  return `invite_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function newInviteCode(): string {
  // 32 bytes → 43-char base64url token. URL-safe, hard to guess.
  return randomBytes(32).toString("base64url");
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
  // Optional: the contract this person is being brought in for. Drives
  // where they land after the ceremony.
  const targetProjectId =
    String(formData.get("targetProjectId") ?? "").trim() || null;

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
    targetProjectId,
    createdByUserId: admin.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS).toISOString(),
    consumedAt: null,
    consumedByUserId: null,
    revokedAt: null,
    revokedReason: null,
  };

  await db.insert(inviteLinks).values(invite);

  await logAuditEvent({
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

  // Countersign-first flow: create the Documenso LOI now with the
  // admin as the first signer and the invitee as the second. Activate
  // it, then redirect the admin straight to their signing URL. The
  // invitee email fires from the Documenso webhook once the admin
  // completes their signature — that way the invitee opens a
  // pre-countersigned LOI and only has to add their own signature.
  //
  // If the template lookup or generation fails, log and re-throw. The
  // invite row stays in the DB with no consumedAt so an admin can
  // retry from /admin/members/invite once the underlying issue is
  // fixed (bad template id, Documenso down, etc.).
  const templateId = DOCUMENSO_TEMPLATES.TALENT_PARTNER_LOI;
  if (!templateId) {
    throw new Error(
      "DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI is not set. Populate the template id in Dokploy env before generating invites.",
    );
  }

  const template = await getTemplate(templateId);
  const templateRecipients = template.Recipient ?? [];
  if (templateRecipients.length < 2) {
    throw new Error(
      `Talent Partner LOI template ${templateId} needs 2 placeholder recipients (admin countersigner + invitee). Currently has ${templateRecipients.length}. Add the missing slot in Documenso admin.`,
    );
  }

  const adminName = adminSenderName(admin);
  const inviteeName = invite.targetName ?? invite.targetEmail;
  const adminEmail =
    process.env.FM_COUNTERSIGNER_EMAIL ??
    admin.email ??
    "hello@afuturemodern.com";

  // Fill recipients in template order. First slot = admin countersigner,
  // remaining = invitee (any additional slots also get invitee — templates
  // shouldn't have 3+ recipients for this flow, but safe fallback).
  const recipients = templateRecipients.map((r, idx) =>
    idx === 0
      ? { id: r.id, email: adminEmail, name: adminName }
      : { id: r.id, email: invite.targetEmail, name: inviteeName },
  );

  let adminSigningUrl: string | undefined;
  try {
    const origin = (
      process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ""
    ).replace(/\/$/, "");
    const generated = await generateDocumentFromTemplate({
      templateId,
      recipients,
      title: `Talent Partner Letter of Intent — ${inviteeName}`,
      externalId: `invite:${invite.code}`,
      meta: {
        // Both signers land on the same return page (Documenso's
        // redirectUrl is doc-level, not per-recipient). The return
        // page routes them by session: admin → admin surface,
        // invitee → T&C page.
        redirectUrl: `${origin}/invite/${invite.code}/return`,
      },
    });
    const docId = generated.documentId ?? generated.id;
    if (!docId) {
      throw new DocumensoError(
        "Documenso returned no document id from generate-document.",
        500,
        null,
      );
    }
    // Match admin recipient by email — order isn't guaranteed.
    const adminRecipient = generated.recipients?.find(
      (r) => r.email?.toLowerCase() === adminEmail.toLowerCase(),
    );
    adminSigningUrl = adminRecipient?.signingUrl;
    // Activate the envelope (DRAFT → PENDING) so both signing URLs
    // become live. sendEmail: false suppresses Documenso's own emails
    // — we redirect the admin directly, and the invitee gets our
    // branded email from the webhook after admin countersigns.
    await sendDocument(docId, { sendEmail: false });
    // Persist the document id so the invitee's /sign page + the
    // webhook can resolve the same envelope without re-creating it.
    await db
      .update(inviteLinks)
      .set({ documensoDocumentId: String(docId) })
      .where(eq(inviteLinks.id, invite.id));
  } catch (err) {
    console.error("[invite] documenso countersign setup failed", {
      inviteId: invite.id,
      targetEmail: invite.targetEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof DocumensoError) {
      throw new Error(
        `Documenso rejected the countersign envelope: ${err.message} (HTTP ${err.status}). Check DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI and the template.`,
      );
    }
    throw err;
  }

  if (!adminSigningUrl) {
    throw new Error(
      "Documenso returned no signing URL for the admin countersigner. Retry, or check the template's recipient configuration.",
    );
  }

  revalidatePath("/admin/members");
  revalidatePath("/admin/members/invite");
  revalidatePath("/admin/audit-log");

  // Redirect the admin straight into Documenso to countersign. On
  // completion, Documenso redirects back to
  // /admin/members/invite?countersigned=<inviteId> (see meta.redirectUrl
  // above) and the webhook fires the invitee email in parallel.
  redirect(adminSigningUrl);
}

/**
 * Task #25 — resend an invite email for a live, unconsumed invite.
 * Reuses the invite's existing code + redemption URL so the target
 * doesn't get a new link. Fires the audit trail so admin can see how
 * many nudges an unresponsive invitee has received.
 */
export async function resendInviteLink(formData: FormData) {
  const admin = await requireAdmin();
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  if (!inviteId) throw new Error("inviteId is required");

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.id, inviteId))
    .limit(1);
  if (!invite) throw new Error("Invite not found");
  if (invite.revokedAt) throw new Error("Cannot resend a revoked invite");
  if (invite.consumedAt) throw new Error("Cannot resend a consumed invite");
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error(
      "Cannot resend an expired invite. Extend expiry first, or revoke + reissue.",
    );
  }

  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const inviteUrl = `${base.replace(/\/$/, "")}/invite/${invite.code}`;
  await dispatchInviteEmail({
    targetEmail: invite.targetEmail,
    targetName: invite.targetName,
    targetTier: invite.targetTier,
    inviteUrl,
    senderName: adminSenderName(admin),
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.invited",
    resourceKind: "user",
    resourceId: invite.id,
    before: null,
    after: {
      resent: true,
      targetEmail: invite.targetEmail,
      senderName: adminSenderName(admin),
    },
    reason: "Invite email resent by admin.",
  });

  revalidatePath("/admin/members/invite");
  revalidatePath("/admin/audit-log");
}

/**
 * Task #25 — push out the expiry on a live invite by 14 days from
 * now (not additive on top of the existing expiry, since additive
 * lets an invite drift indefinitely). Only valid on live invites.
 */
export async function extendInviteExpiry(formData: FormData) {
  const admin = await requireAdmin();
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  if (!inviteId) throw new Error("inviteId is required");

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.id, inviteId))
    .limit(1);
  if (!invite) throw new Error("Invite not found");
  if (invite.revokedAt) throw new Error("Cannot extend a revoked invite");
  if (invite.consumedAt) throw new Error("Cannot extend a consumed invite");

  const previousExpiry = invite.expiresAt;
  const newExpiry = new Date(Date.now() + INVITE_LIFETIME_MS).toISOString();
  await db
    .update(inviteLinks)
    .set({ expiresAt: newExpiry })
    .where(eq(inviteLinks.id, invite.id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.invited",
    resourceKind: "user",
    resourceId: invite.id,
    before: { expiresAt: previousExpiry },
    after: {
      expiresAt: newExpiry,
      targetEmail: invite.targetEmail,
      extendedByDays: 14,
    },
    reason: "Invite expiry extended by admin.",
  });

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

  await logAuditEvent({
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
 * /invite/[code]/sign page.
 *
 * Countersign-first flow: the LOI envelope was already created at
 * invite-generation time (see generateInviteLink above) with both the
 * admin and the invitee as recipients, and the admin has already
 * countersigned. This action just resolves the invitee's existing
 * signing URL from that same envelope and redirects into it — no new
 * document is created, so the invitee opens a document that already
 * carries the admin's signature.
 *
 * If the invite predates the countersign-first flow (no
 * documensoDocumentId column on the row) or the admin countersign
 * hasn't landed yet, we fall back to the previous behavior of
 * generating a fresh document scoped to just the invitee.
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

  // Preferred path: use the existing envelope created at invite time.
  if (invite.documensoDocumentId) {
    let signingUrl: string | undefined;
    try {
      const { getDocument } = await import("@/lib/documenso");
      const doc = await getDocument(invite.documensoDocumentId);
      const inviteeRecipient = doc.recipients?.find(
        (r) => r.email?.toLowerCase() === invite.targetEmail.toLowerCase(),
      );
      signingUrl = inviteeRecipient?.signingUrl;
    } catch (err) {
      console.error("[invite] failed to resolve existing envelope", {
        code,
        docId: invite.documensoDocumentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (signingUrl) {
      redirect(signingUrl);
    }
    // Fall through to fresh-envelope creation if the lookup didn't
    // produce a usable URL — better to let the invitee sign a
    // one-recipient doc than block them entirely.
  }

  // Fallback path (legacy invites or lookup miss): create a fresh
  // single-recipient envelope for the invitee. Loses the pre-applied
  // admin countersign but keeps the invitee unblocked.
  const templateId = DOCUMENSO_TEMPLATES.TALENT_PARTNER_LOI;
  if (!templateId) {
    throw new DocumensoError(
      "DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI env var is not set. Populate the numeric template id from Documenso.",
      500,
      null,
    );
  }

  const template = await getTemplate(templateId);
  const templateRecipients = template.Recipient ?? [];
  if (templateRecipients.length === 0) {
    throw new DocumensoError(
      `Talent Partner LOI template ${templateId} has no placeholder recipient. Add one in Documenso.`,
      400,
      null,
    );
  }

  const recipientName = invite.targetName ?? invite.targetEmail;
  const countersignerEmail =
    process.env.FM_COUNTERSIGNER_EMAIL ?? "hello@afuturemodern.com";
  const countersignerName =
    process.env.FM_COUNTERSIGNER_NAME ?? "A Future Modern";

  const recipients = templateRecipients.map((r, idx) =>
    idx === 0
      ? { id: r.id, email: invite.targetEmail, name: recipientName }
      : { id: r.id, email: countersignerEmail, name: countersignerName },
  );

  let signingUrl: string | undefined;
  try {
    const generated = await generateDocumentFromTemplate({
      templateId,
      recipients,
      title: `Talent Partner Letter of Intent — ${recipientName}`,
      externalId: `invite:${code}`,
      meta: {
        redirectUrl: `${origin}/invite/${code}/code`,
      },
    });
    const docId = generated.documentId ?? generated.id;
    if (!docId) {
      throw new DocumensoError(
        "Documenso returned no document id from generate-document.",
        500,
        null,
      );
    }
    const inviteeRecipient = generated.recipients?.find(
      (r) => r.email?.toLowerCase() === invite.targetEmail.toLowerCase(),
    );
    signingUrl = inviteeRecipient?.signingUrl ?? generated.recipients?.[0]?.signingUrl;
    await sendDocument(docId, { sendEmail: false });
  } catch (err) {
    if (err instanceof DocumensoError) {
      console.error("[invite] documenso failure", {
        code, message: err.message, status: err.status,
      });
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

  // ─────────────────────────────────────────────────────────────
  // WHY THESE REDIRECT INSTEAD OF THROWING (2026-09-01)
  //
  // A thrown Error here hits the route boundary and the invitee sees
  // "The route hit an error" with a digest. That is what an invited
  // member got instead of "tick the terms box", on the one page that
  // stands between her and joining.
  //
  // Every condition below is an expected state of a real invite, not a
  // fault. They belong on the page that can explain them.
  // ─────────────────────────────────────────────────────────────
  if (!code) redirect("/");
  if (!termsAccepted) {
    redirect(`/invite/${encodeURIComponent(code)}/code?issue=terms`);
  }

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite) {
    redirect(`/invite/${encodeURIComponent(code)}/code?issue=notfound`);
  }
  if (invite.consumedAt) {
    redirect(`/invite/${encodeURIComponent(code)}/code?issue=used`);
  }
  if (invite.revokedAt) {
    redirect(`/invite/${encodeURIComponent(code)}/code?issue=revoked`);
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

  // The paperwork this ceremony produced. Both rows land here: the
  // Documenso-signed LOI or covenant, and the Tier-2 data opt-in that
  // used to be read off the form and thrown away.
  await recordInviteCeremonyAgreements({
    userId,
    inviteCode: code,
    targetTier: invite.targetTier,
    documensoDocumentId: invite.documensoDocumentId ?? null,
    dataOptIn,
  });

  // Also reflect the opt-in on the user row, so /profile's toggle and
  // the agreements list agree with each other rather than telling the
  // member two different things.
  if (dataOptIn) {
    await db
      .update(users)
      .set({ dataParticipation: true, updatedAt: now })
      .where(eq(users.id, userId));
  }

  // Mint the session cookie so the invitee lands on /welcome signed in.
  await createDirectSession(userId);

  revalidatePath("/admin/agreements");
  revalidatePath("/admin/members");
  // Land them on the contract they were invited for, when the invite
  // named one. Someone brought in for a specific piece of work should
  // arrive at that work rather than a generic welcome page and a hunt.
  if (invite.targetProjectId) {
    redirect(`/contracts/${invite.targetProjectId}?welcome=1`);
  }
  redirect(`/invite/${code}/welcome`);
}
