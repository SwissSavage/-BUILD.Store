/**
 * Invite-link admin server actions.
 *
 * Admin generates an invite for a beta / handoff cohort target;
 * sandbox displays the URL in the admin surface for manual send
 * (email, DM, Signal, whatever), production dispatches by the
 * configured email provider (see production-swap-checklist §7c).
 *
 * Revocation is possible pre-consumption; consumption is what the
 * signup route calls when the target lands on the redemption URL.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
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
