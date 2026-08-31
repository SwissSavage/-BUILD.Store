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
import { creditRecoveryPool } from "@/lib/writers/reserve-pool";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { evaluateBonusGate } from "@/lib/bonus-gate";
import { writeStandardSettlementSplits } from "@/lib/settlement-splits";
import { hasValidPayoutDocument } from "@/lib/payout-gate";
import { issueBuildFromSettlement } from "@/lib/voucher-issuance";

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
  const admin = await requireAdmin();
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
  // Payout gate: bonus release rides on the same client payment that
  // authorized the base contract settlement. If no external invoice
  // (or retroactive receipt) exists on this project, block.
  if (!(await hasValidPayoutDocument(projectId, "bonus_release"))) {
    throw new Error(
      "Bonus release refused: no external invoice or retroactive receipt on this contract. Attach one before firing the bonus decision.",
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
    await creditRecoveryPool(projectId, project.talentBonusAmount);
    project.bonusDecision = "reclaimed";
  } else {
    // Release or release-by-default both pay talent. In sandbox
    // we also cascade a $BUILD distribution across the project's
    // assigned members — equal shares of the bonus amount, sourced
    // as project_completion. The cascade fires voucher issuance
    // via the distributeBuild → issueVoucherInternal hook, so the
    // off-chain voucher ledger stays in lockstep with the earning
    // event.
    //
    // Equal shares is the intentionally naive MVP split — real
    // per-member allocation logic (roles, seniority, contribution
    // vectors) belongs in the split engine and is a follow-on. See
    // task list for the pre-Beta refinement.
    //
    // Production: bonus dollars fire via Stripe Connect; the
    // $BUILD side fires via the multisig propose flow. Both routes
    // still call this same cascade so voucher accounting stays
    // consistent.
    project.bonusDecision = "released";

    const members = project.assignedMemberIds;
    const bonusAmount = Number(project.talentBonusAmount);
    if (members.length > 0 && bonusAmount > 0) {
      // Write the full 85/12/1.5/1.5 split against the bonus
      // amount so admin/treasury/LP get their proportional cut
      // alongside the talent bonus. Uses the same shared engine
      // as contract + order settlement.
      const adminIds =
        project.adminUserIds.length > 0 ? project.adminUserIds : members;
      const talentShare = (bonusAmount * 0.85) / members.length;
      try {
        await writeStandardSettlementSplits({
          gross: bonusAmount,
          sourceKind: "bonus_release",
          sourceId: project.id,
          contractId: project.id,
          contributors: {
            userIds: members,
            amounts: members.map(() => talentShare.toFixed(2)),
          },
          admins: {
            userIds: adminIds,
          },
          actorUserId: admin.id,
          noteContext: `Bonus release on ${project.title}`,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[bonus-release] writeStandardSettlementSplits failed for project ${project.id}:`,
          err,
        );
      }

      // $BUILD cascade — canonical 6.087× network fees formula on
      // the bonus amount, split 80/16/2/2 across talent / admin
      // pool / Treasury / LP. Follow-on #260 refines the talent
      // share allocation from equal split to per-member weighting
      // when internal invoices are attached to the bonus release.
      try {
        await issueBuildFromSettlement({
          gross: bonusAmount,
          cashSourceKind: "bonus_release",
          sourceId: project.id,
          contributors: { userIds: members },
          admins: { userIds: adminIds },
          actorUserId: admin.id,
          noteContext: `$BUILD generation — bonus release on ${project.title}`,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[bonus-release] issueBuildFromSettlement failed for project ${project.id}:`,
          err,
        );
      }
    }
  }
  project.bonusDecidedAt = new Date().toISOString();
  project.updatedAt = new Date().toISOString();
  // Initialize the pool row regardless so the surface has something to
  // render even on the release path (it'll just sit at $0).
  // Opening the pool is the same upsert as crediting it with zero —
  // one code path, so a pool can never be created by one route with a
  // shape the other doesn't expect.
  await creditRecoveryPool(projectId, "0");

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action:
      project.bonusDecision === "released"
        ? "contract.bonus_released"
        : "contract.bonus_reclaimed",
    resourceKind: "project",
    resourceId: project.id,
    before: { bonusDecision: "pending" },
    after: {
      bonusDecision: project.bonusDecision,
      talentBonusAmount: project.talentBonusAmount,
      bonusDecidedAt: project.bonusDecidedAt,
    },
    reason: decision.explanation,
  });

  revalidatePath(`/admin/contracts/${projectId}/settle`);
}
