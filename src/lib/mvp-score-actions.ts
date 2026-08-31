/**
 * MVP Score admin actions — compliance penalty apply / rescind +
 * snapshot recompute helper.
 *
 * The compliance penalty mechanic (DnD Exhaustion / Death Saving Throws
 * shape) is the load-bearing piece of the cooperative-covenant
 * enforcement layer: each violation = -9 OVR for 90 days, stacking.
 * Real-time application is the structural prevention of the Chibu
 * pattern — admin sees decline as it happens and acts inside the cycle,
 * not after a year of slow decay.
 *
 * Sandbox semantics: mutate the in-memory penalty + snapshot stores,
 * revalidate every surface that renders MVP data. Production swap
 * persists to `mvp_compliance_penalties` (append-only) and recomputes
 * the user's snapshot on the daily compute pass.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mvpCompliancePenalties } from "@/db/schema";
import { getUserById } from "@/lib/readers/users";
import {
  recomputeMvpScore,
  setProvisional,
  setSubRating as writeSubRating,
} from "@/lib/writers/mvp-score";
import { mvpScoreReader } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { buildSnapshot } from "@/lib/mvp-score";
import {
  MVP_VIOLATION_DURATION_DAYS,
  MVP_VIOLATION_OVR_IMPACT,
} from "@/lib/mvp-score";
import type { MvpCompliancePenalty } from "@/lib/types";

function newPenaltyId(): string {
  return `mvp_pen_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function ninetyDaysOut(now: Date): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + MVP_VIOLATION_DURATION_DAYS);
  return d.toISOString();
}

/**
 * Recompute now delegates to src/lib/writers/mvp-score.ts, which
 * derives sub-ratings from real peer reviews and persists the
 * snapshot. The old local version read existing.subRatings and wrote
 * them straight back, so an OVR never moved regardless of how many
 * reviews a member received.
 */

/**
 * Admin applies a compliance penalty to a Member. Per locked mechanic:
 * -9 OVR for 90 days from now. Stacks with existing active penalties.
 *
 * Reason text is required and admin-only (peer view shows the existence
 * of penalties via count, never the reason).
 */
export async function applyCompliancePenalty(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) throw new Error("userId is required");
  if (reason.length < 10) {
    throw new Error(
      "Reason must be at least 10 characters — penalties are admin-only but recorded for arbitration.",
    );
  }
  const target = await getUserById(userId);
  if (!target) throw new Error("Target user not found");

  const now = new Date();
  const penalty: MvpCompliancePenalty = {
    id: newPenaltyId(),
    userId,
    appliedAt: now.toISOString(),
    expiresAt: ninetyDaysOut(now),
    ovrImpact: MVP_VIOLATION_OVR_IMPACT,
    reason,
  };
  // Writer swap 2026-08-28: penalties were in-memory, so a compliance
  // action an admin took vanished on the next deploy and the member's
  // OVR silently recovered.
  await db.insert(mvpCompliancePenalties).values(penalty);
  await recomputeMvpScore(userId);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "mvp.compliance_penalty_applied",
    resourceKind: "mvp_penalty",
    resourceId: penalty.id,
    before: null,
    after: {
      userId,
      ovrImpact: penalty.ovrImpact,
      expiresAt: penalty.expiresAt,
    },
    reason,
  });

  // Every surface that renders MVP signal needs to refresh.
  revalidatePath("/admin/mvp");
  revalidatePath(`/admin/mvp/${userId}`);
  revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile");
  revalidatePath("/admin");
}

/**
 * Admin updates a single sub-rating on a member's snapshot. Snapshot
 * recomputes immediately so the OVR + standing band shift live.
 *
 * Production semantics: sub-ratings are computed from inputs (attribution,
 * peer review, client feedback, milestone-hit, etc.) on the daily refresh
 * job. Admin overrides should be rare and recorded; sandbox simplifies
 * to direct edit on the snapshot inputs.
 */
export async function setSubRating(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const subRating = String(formData.get("subRating") ?? "").trim();
  const raw = Number(formData.get("value") ?? "0");
  if (!userId) throw new Error("userId is required");
  if (!Number.isFinite(raw) || raw < 0 || raw > 99) {
    throw new Error("Sub-rating value must be between 0 and 99.");
  }

  const validSubs = new Set([
    "quality",
    "outcomes",
    "reliability",
    "hustle",
    "collaboration",
    "attendance",
    "referrals_bd",
  ]);
  if (!validSubs.has(subRating)) {
    throw new Error(`Unknown sub-rating: ${subRating}`);
  }

  const snapshot = await mvpScoreReader.byId(userId);
  if (!snapshot) throw new Error("Snapshot not found for user");

  const key = subRating as keyof typeof snapshot.subRatings;
  const previous = snapshot.subRatings[key];
  const rounded = Math.round(raw);
  await writeSubRating(userId, key, rounded);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "mvp.sub_rating_set",
    resourceKind: "mvp_score",
    resourceId: userId,
    before: { [subRating]: previous },
    after: { [subRating]: rounded },
  });

  const target = await getUserById(userId);
  revalidatePath("/admin/mvp");
  revalidatePath(`/admin/mvp/${userId}`);
  if (target) revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile");
  revalidatePath("/admin");
}

/**
 * Promote a member off provisional standing. Their snapshot starts
 * being scored normally (band / Court eligibility / penalties apply).
 * Production criterion: ~3 completed engagements + 2 peer reviews
 * received. Sandbox: single-click admin promotion with no gate.
 */
export async function promoteFromProvisional(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("userId is required");
  const snapshot = await mvpScoreReader.byId(userId);
  if (!snapshot) throw new Error("Snapshot not found");
  if (!snapshot.isProvisional) {
    throw new Error("Already off provisional standing.");
  }
  await setProvisional(userId, false);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "mvp.provisional_promoted",
    resourceKind: "mvp_score",
    resourceId: userId,
    before: { isProvisional: true },
    after: { isProvisional: false },
  });

  const target = await getUserById(userId);
  revalidatePath("/admin/mvp");
  revalidatePath(`/admin/mvp/${userId}`);
  if (target) revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile");
  revalidatePath("/admin");
}

/**
 * Demote a member back to provisional (admin override — e.g. for testing
 * the UI, or for production cases where a member's input pipeline broke
 * and the OVR isn't trustworthy yet).
 */
export async function demoteToProvisional(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("userId is required");
  const snapshot = await mvpScoreReader.byId(userId);
  if (!snapshot) throw new Error("Snapshot not found");
  const wasProvisional = snapshot.isProvisional;
  await setProvisional(userId, true);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "mvp.provisional_demoted",
    resourceKind: "mvp_score",
    resourceId: userId,
    before: { isProvisional: wasProvisional },
    after: { isProvisional: true },
  });

  const target = await getUserById(userId);
  revalidatePath("/admin/mvp");
  revalidatePath(`/admin/mvp/${userId}`);
  if (target) revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile");
  revalidatePath("/admin");
}

/**
 * Admin rescinds a previously-applied penalty (mistaken trigger, found-
 * not-violated on review, etc.). Removes the penalty row entirely.
 *
 * Production behavior should record this as an offsetting entry on the
 * append-only ledger rather than a delete, mirroring the attribution-
 * ledger posture. Sandbox simplifies to in-place removal.
 */
export async function rescindCompliancePenalty(formData: FormData) {
  const admin = await requireAdmin();
  const penaltyId = String(formData.get("penaltyId") ?? "").trim();
  if (!penaltyId) throw new Error("penaltyId is required");
  const [original] = await db
    .select()
    .from(mvpCompliancePenalties)
    .where(eq(mvpCompliancePenalties.id, penaltyId))
    .limit(1);
  if (!original) throw new Error("Penalty not found");
  const userId = original.userId;
  await db
    .delete(mvpCompliancePenalties)
    .where(eq(mvpCompliancePenalties.id, penaltyId));
  await recomputeMvpScore(userId);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "mvp.compliance_penalty_rescinded",
    resourceKind: "mvp_penalty",
    resourceId: penaltyId,
    before: {
      userId,
      ovrImpact: original.ovrImpact,
      appliedAt: original.appliedAt,
      expiresAt: original.expiresAt,
      reason: original.reason,
    },
    after: null,
    reason: "Admin rescinded penalty",
  });

  const target = await getUserById(userId);
  revalidatePath("/admin/mvp");
  revalidatePath(`/admin/mvp/${userId}`);
  if (target) revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile");
  revalidatePath("/admin");
}
