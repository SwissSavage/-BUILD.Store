/**
 * Task #27 — Documenso member-account perk actions.
 *
 * Two paths:
 *   - Admin-triggered from /admin/members/[id]: invitesMemberToDocumenso
 *     stamps documensoInvitedAt on the user row and fires an in-app
 *     notification with a deep link to sign.afuturemodern.com/signup
 *     pre-filled with the member's FM email. Member clicks through
 *     and completes signup on the Documenso side.
 *   - Member-triggered from /profile: claimDocumensoAccount marks the
 *     linked state once the member confirms the account is live.
 *
 * When OIDC federation (task #7) lands, this becomes auto-provisioned
 * on first sign-in and both actions become no-ops. Kept as the bridge
 * until then so the perk is real, not just promised.
 *
 * Non-goal for MVP: verifying the Documenso side actually created the
 * account. Documenso self-hosted's user-listing API is admin-scoped
 * and not part of the public v1 surface; verifying would require an
 * admin token we haven't provisioned. Member self-report is the honor-
 * system MVP until OIDC.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { Notification } from "@/lib/types";

const DOCUMENSO_BASE =
  process.env.DOCUMENSO_BASE_URL ?? "https://sign.afuturemodern.com";

/**
 * Admin-triggered: invite a Partner or Member to claim a Documenso
 * account. Stamps documensoInvitedAt + fires a notification with a
 * deep link that pre-fills their FM email on the Documenso signup.
 * Idempotent: re-invitation refreshes the timestamp and re-fires
 * the notification (useful if the member missed it).
 */
export async function inviteMemberToDocumenso(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("userId required.");

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) throw new Error("User not found.");
  if (
    target.membershipTier !== "partner" &&
    target.membershipTier !== "member"
  ) {
    throw new Error(
      "Documenso account perk is Partner and Member only. Promote the user first.",
    );
  }
  if (target.documensoAccountLinkedAt) {
    throw new Error(
      "This user already has a linked Documenso account. No re-invite needed.",
    );
  }

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ documensoInvitedAt: now })
    .where(eq(users.id, userId));

  const signupUrl = `${DOCUMENSO_BASE.replace(/\/$/, "")}/signup?email=${encodeURIComponent(target.email)}`;

  const ntf: Notification = {
    id: `ntf_dmns_${userId}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    kind: "documenso_account_ready",
    title: "Your Documenso account is ready to claim",
    body: `As a ${target.membershipTier === "member" ? "Member" : "Partner"}, you get a free Documenso account on ${DOCUMENSO_BASE}. Claim it and use it to send + track your own signed documents.`,
    href: signupUrl,
    createdAt: now,
    readAt: null,
  };
  MOCK_NOTIFICATIONS.push(ntf);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "user",
    resourceId: userId,
    before: { documensoInvitedAt: target.documensoInvitedAt },
    after: {
      documensoInvitedAt: now,
      signupUrl,
      perkKind: "documenso_account",
    },
    reason: "Admin invited member to claim Documenso account.",
  });

  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/profile");
}

/**
 * Member-triggered: confirm the Documenso account is live. Honor-system
 * self-report until OIDC federation gives us programmatic linkage.
 * Sets documensoAccountLinkedAt on the current user's row so the
 * profile surface reflects the linked state.
 */
export async function claimDocumensoAccount() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");
  if (
    user.membershipTier !== "partner" &&
    user.membershipTier !== "member"
  ) {
    throw new Error(
      "The Documenso account perk is Partner and Member only.",
    );
  }

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) throw new Error("User row not found.");
  if (row.documensoAccountLinkedAt) return; // already claimed, no-op

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ documensoAccountLinkedAt: now })
    .where(eq(users.id, user.id));

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "config.setting_changed",
    resourceKind: "user",
    resourceId: user.id,
    before: { documensoAccountLinkedAt: null },
    after: {
      documensoAccountLinkedAt: now,
      perkKind: "documenso_account",
      selfClaimed: true,
    },
    reason: "Member self-claimed Documenso account.",
  });

  revalidatePath("/profile");
  revalidatePath(`/admin/members/${user.id}`);
}
