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
