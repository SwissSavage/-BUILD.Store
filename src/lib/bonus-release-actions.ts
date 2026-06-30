/**
 * Bonus-release settlement actions.
 *
 * Two-step flow:
 *   1. Admin captures PM engagement rating (1-5) on the settle surface.
 *      Feeds the composite fallback when client rating is absent /
 *      below threshold. Optional but recommended.
 *   2. Admin executes the bonus decision. Reads the gate via
 *      `evaluateBonusGate`, then either marks the bonus as released
 *      (paid to talent under standard split engine pacing) or reclaims
 *      it to the Engagement Recovery Pool.
 *
 * Sandbox: mutate the in-memory project + recovery-pool stores.
 * Production swap: persist decision + recovery-pool credit to
 * `engagement_recovery_pools` ledger + Stripe-Connect transfer for the
 * release path on the bonus amount.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { feedbackForContext } from "@/lib/mock-data/customer-feedback";
import { MOCK_PEER_REVIEWS } from "@/lib/mock-data/peer-reviews";
import { creditPool, ensurePoolForProject } from "@/lib/mock-data/engagement-recovery-pools";
import { evaluateBonusGate } from "@/lib/bonus-gate";

function findProject(id: string) {
  const p = MOCK_PROJECTS.find((x) => x.id === id);
  if (!p) throw new Error("Project not found");
  return p;
}

/**
 * PM (account-owning admin) captures their engagement rating at
 * settlement. Feeds the composite fallback.
 */
export async function setPmEngagementRating(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const raw = Number(formData.get("rating") ?? "0");
  if (!Number.isFinite(raw) || raw < 1 || raw > 5) {
    throw new Error("Rating must be an integer from 1 to 5.");
  }
  const project = findProject(projectId);
  project.pmEngagementRating = Math.round(raw);
  project.updatedAt = new Date().toISOString();
  revalidatePath(`/admin/contracts/${projectId}/settle`);
}

/**
 * Execute the bonus-release decision based on the canonical gate.
 * Idempotent: re-running on a project with `bonusDecision` already set
 * to something other than "pending" throws so we don't double-credit.
 *
 * Release path: project.bonusDecision = "released"; talent receives the
 * bonus alongside the standard 85% split (sandbox just marks the row).
 *
 * Reclaim path: project.bonusDecision = "reclaimed"; bonus amount is
 * credited to the Engagement Recovery Pool for this project.
 */
export async function executeBonusDecision(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const project = findProject(projectId);

  if (!project.talentBonusAmount) {
    throw new Error("No bonus amount on this contract — nothing to decide.");
  }
  if (project.bonusDecision !== null && project.bonusDecision !== "pending") {
    throw new Error(
      `Bonus decision already recorded (${project.bonusDecision}). Cannot re-decide without an offsetting entry.`,
    );
  }

  const feedback = feedbackForContext(projectId)[0] ?? null;
  const peerReviews = MOCK_PEER_REVIEWS.filter(
    (r) => r.contextId === projectId,
  );
  const decision = evaluateBonusGate({
    feedback,
    peerReviews,
    pmRating: project.pmEngagementRating,
    gate: project.bonusGate,
  });

  if (decision.outcome === "reclaim") {
    creditPool(projectId, project.talentBonusAmount);
    project.bonusDecision = "reclaimed";
  } else {
    // Release or release-by-default both pay talent.
    // Sandbox marks the row; production fires the Stripe Connect transfer.
    project.bonusDecision = "released";
  }
  project.bonusDecidedAt = new Date().toISOString();
  project.updatedAt = new Date().toISOString();
  // Initialize the pool row regardless so the surface has something to
  // render even on the release path (it'll just sit at $0).
  ensurePoolForProject(projectId);

  revalidatePath(`/admin/contracts/${projectId}/settle`);
}
