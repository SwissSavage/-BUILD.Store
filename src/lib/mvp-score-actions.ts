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
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MOCK_MVP_PENALTIES,
  MOCK_MVP_SCORES,
} from "@/lib/mock-data/mvp-scores";
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
 * Recompute the published snapshot for one user against the latest
 * sub-ratings + penalty stack. Sandbox shortcut — production runs this
 * once a day across all users from the compute job.
 */
function recomputeSnapshot(userId: string): void {
  const existing = MOCK_MVP_SCORES.find((s) => s.userId === userId);
  if (!existing) return;
  const penalties = MOCK_MVP_PENALTIES.filter((p) => p.userId === userId);
  const fresh = buildSnapshot({
    userId,
    subRatings: existing.subRatings,
    penalties,
    publishedAt: new Date().toISOString(),
  });
  // Replace the existing snapshot in place so the array reference stays stable.
  const idx = MOCK_MVP_SCORES.findIndex((s) => s.userId === userId);
  if (idx >= 0) MOCK_MVP_SCORES[idx] = fresh;
}

/**
 * Admin applies a compliance penalty to a Member. Per locked mechanic:
 * -9 OVR for 90 days from now. Stacks with existing active penalties.
 *
 * Reason text is required and admin-only (peer view shows the existence
 * of penalties via count, never the reason).
 */
export async function applyCompliancePenalty(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) throw new Error("userId is required");
  if (reason.length < 10) {
    throw new Error(
      "Reason must be at least 10 characters — penalties are admin-only but recorded for arbitration.",
    );
  }
  const target = MOCK_USERS.find((u) => u.id === userId);
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
  MOCK_MVP_PENALTIES.push(penalty);
  recomputeSnapshot(userId);

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
  await requireAdmin();
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

  const snapshot = MOCK_MVP_SCORES.find((s) => s.userId === userId);
  if (!snapshot) throw new Error("Snapshot not found for user");

  snapshot.subRatings[subRating as keyof typeof snapshot.subRatings] = Math.round(raw);
  recomputeSnapshot(userId);

  const target = MOCK_USERS.find((u) => u.id === userId);
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
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("userId is required");
  const snapshot = MOCK_MVP_SCORES.find((s) => s.userId === userId);
  if (!snapshot) throw new Error("Snapshot not found");
  if (!snapshot.isProvisional) {
    throw new Error("Already off provisional standing.");
  }
  snapshot.isProvisional = false;
  recomputeSnapshot(userId);

  const target = MOCK_USERS.find((u) => u.id === userId);
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
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("userId is required");
  const snapshot = MOCK_MVP_SCORES.find((s) => s.userId === userId);
  if (!snapshot) throw new Error("Snapshot not found");
  snapshot.isProvisional = true;
  recomputeSnapshot(userId);

  const target = MOCK_USERS.find((u) => u.id === userId);
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
  await requireAdmin();
  const penaltyId = String(formData.get("penaltyId") ?? "").trim();
  if (!penaltyId) throw new Error("penaltyId is required");
  const idx = MOCK_MVP_PENALTIES.findIndex((p) => p.id === penaltyId);
  if (idx < 0) throw new Error("Penalty not found");
  const userId = MOCK_MVP_PENALTIES[idx].userId;
  MOCK_MVP_PENALTIES.splice(idx, 1);
  recomputeSnapshot(userId);

  const target = MOCK_USERS.find((u) => u.id === userId);
  revalidatePath("/admin/mvp");
  revalidatePath(`/admin/mvp/${userId}`);
  if (target) revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile");
  revalidatePath("/admin");
}
