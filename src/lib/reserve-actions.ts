/**
 * Contract Reserve Pool server actions + internal helpers.
 *
 * The primitive that funds the reserve on invoice collection, does
 * the graduated bonus release + rebate + peer-coverage cascade at
 * close time, and routes residuals to the Engagement Recovery Pool.
 *
 * Split into:
 *   - Internal helpers (non-server-action functions callable from
 *     other server actions like markInvoicePaid) that credit the
 *     reserve or record composites without their own auth gate —
 *     the caller has already checked.
 *   - Server actions (issueClientRebate, executeGraduatedBonusRelease)
 *     that carry their own requireAdmin() and revalidatePath.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  MOCK_RESERVE_POOL_LEDGER,
  MOCK_TRIANGULATED_COMPOSITES,
  reservePoolBalance,
} from "@/lib/mock-data/reserve-pool";
import { creditPool as creditRecoveryPool } from "@/lib/mock-data/engagement-recovery-pools";
import {
  computeRebateMultiplier,
  computeTriangulatedComposite,
  distributePeerCoverage,
  type PeerCoverageContributor,
} from "@/lib/triangulation";
import type {
  ReserveCreditReason,
  ReserveDebitReason,
  ReservePoolLedgerEntry,
  TriangulatedComposite,
} from "@/lib/types";

// ────────────────────────────────────────────────────────────────
//  Internal (non-server-action) helpers
// ────────────────────────────────────────────────────────────────

function nextLedgerId(prefix: string): string {
  return `rpl_${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function nextCompositeId(): string {
  return `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Append a credit or debit entry to the reserve pool ledger. Not a
 * server action — callable from any server context that has already
 * validated the caller. Returns the created row.
 */
function appendReserveEntry(input: {
  projectId: string;
  amount: number;
  direction: "credit" | "debit";
  creditReason: ReserveCreditReason | null;
  debitReason: ReserveDebitReason | null;
  recipientId: string | null;
  actorUserId: string | null;
  rationale: string | null;
}): ReservePoolLedgerEntry {
  const signedAmount =
    input.direction === "credit"
      ? Math.abs(input.amount)
      : -Math.abs(input.amount);
  const row: ReservePoolLedgerEntry = {
    id: nextLedgerId(input.direction === "credit" ? "c" : "d"),
    projectId: input.projectId,
    amount: signedAmount.toFixed(2),
    direction: input.direction,
    creditReason: input.creditReason,
    debitReason: input.debitReason,
    recipientId: input.recipientId,
    actorUserId: input.actorUserId,
    rationale: input.rationale,
    createdAt: new Date().toISOString(),
  };
  MOCK_RESERVE_POOL_LEDGER.push(row);
  return row;
}

/**
 * Credit the reserve pool when an external invoice is fully paid.
 * Called from the invoice-payment path — no separate admin gate
 * because the caller has already checked. Uses
 * `project.talentBonusAmount` as the credit amount for MVP (the
 * top-end vs bottom-end delta already lives there).
 *
 * Idempotent-ish: refuses to credit twice for the same project by
 * checking whether an invoice_collection credit already exists.
 * Callers can safely re-invoke.
 */
export async function creditReserveOnInvoiceCollection(input: {
  projectId: string;
  actorUserId: string | null;
}): Promise<ReservePoolLedgerEntry | null> {
  const project = MOCK_PROJECTS.find((p) => p.id === input.projectId);
  if (!project) return null;
  if (!project.talentBonusAmount) return null;
  const amount = Number(project.talentBonusAmount);
  if (amount <= 0) return null;

  const alreadyCredited = MOCK_RESERVE_POOL_LEDGER.some(
    (e) =>
      e.projectId === input.projectId &&
      e.direction === "credit" &&
      e.creditReason === "invoice_collection",
  );
  if (alreadyCredited) return null;

  const row = appendReserveEntry({
    projectId: input.projectId,
    amount,
    direction: "credit",
    creditReason: "invoice_collection",
    debitReason: null,
    recipientId: null,
    actorUserId: input.actorUserId,
    rationale: `Top − bottom delta credited on external invoice payment (${amount.toFixed(2)}).`,
  });

  const actor = input.actorUserId
    ? MOCK_USERS.find((u) => u.id === input.actorUserId) ?? null
    : null;
  logAuditEvent({
    actorUserId: input.actorUserId,
    actorRoleSnapshot: snapshotActorRole(actor),
    action: "reserve.credited",
    resourceKind: "reserve_pool",
    resourceId: input.projectId,
    before: null,
    after: { amount: amount.toFixed(2), reason: "invoice_collection" },
    reason: null,
  });

  return row;
}

/**
 * Snapshot and store a triangulated composite for a contributor on
 * a specific contract. Freezes the current ratings so the historical
 * decision stays auditable even if underlying ratings change later.
 */
function snapshotComposite(input: {
  projectId: string;
  contributorUserId: string;
  adminRating: number | null;
  peerRating: number | null;
  clientRating: number | null;
  actorUserId: string | null;
}): TriangulatedComposite {
  const result = computeTriangulatedComposite({
    adminRating: input.adminRating,
    peerRating: input.peerRating,
    clientRating: input.clientRating,
  });
  const row: TriangulatedComposite = {
    id: nextCompositeId(),
    projectId: input.projectId,
    contributorUserId: input.contributorUserId,
    adminRating: result.adminRating,
    peerRating: result.peerRating,
    clientRating: result.clientRating,
    effectiveWeights: result.effectiveWeights,
    weightedComposite: result.weightedComposite,
    bonusReleaseFraction: result.bonusReleaseFraction,
    computedAt: new Date().toISOString(),
  };
  MOCK_TRIANGULATED_COMPOSITES.push(row);

  const actor = input.actorUserId
    ? MOCK_USERS.find((u) => u.id === input.actorUserId) ?? null
    : null;
  logAuditEvent({
    actorUserId: input.actorUserId,
    actorRoleSnapshot: snapshotActorRole(actor),
    action: "composite.computed",
    resourceKind: "triangulated_composite",
    resourceId: row.id,
    before: null,
    after: {
      projectId: input.projectId,
      contributorUserId: input.contributorUserId,
      weightedComposite: result.weightedComposite,
      bonusReleaseFraction: result.bonusReleaseFraction,
    },
    reason: null,
  });
  return row;
}

// ────────────────────────────────────────────────────────────────
//  Server actions
// ────────────────────────────────────────────────────────────────

/**
 * Graduated bonus release for a contract close. Replaces the binary
 * bonus_decision path with the triangulated composite math.
 *
 * Form contract (per contributor):
 *   - contributorId (repeated)
 *   - adminRating<contributorId>
 *   - peerRating<contributorId>
 *   - clientRating<contributorId>  (optional)
 *   - internalInvoiceAmount<contributorId>  (for peer-coverage weighting)
 *
 * Cascade at close:
 *   1. Snapshot composite per contributor
 *   2. For each: debit reserve by (their bonus share × composite/5)
 *      → recipient = the contributor themselves
 *   3. Sum unreleased bonus amounts → peer coverage pool
 *   4. Distribute pool to contributors with composite ≥ 4.5,
 *      proportional to their internal invoice share
 *   5. Any residual → Engagement Recovery Pool
 */
export async function executeGraduatedBonusRelease(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Project id is required.");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");
  if (!project.talentBonusAmount) {
    throw new Error(
      "No bonus amount on this contract — nothing to release.",
    );
  }
  if (project.bonusDecision === "released" || project.bonusDecision === "reclaimed") {
    throw new Error(
      `Bonus decision already recorded (${project.bonusDecision}).`,
    );
  }

  const contributorIds = formData.getAll("contributorId").map(String);
  if (contributorIds.length === 0) {
    throw new Error("At least one contributor required.");
  }

  const totalBonus = Number(project.talentBonusAmount);
  const perContribBonus = totalBonus / contributorIds.length; // MVP: even split of bonus pool

  // 1. Compute + snapshot composites per contributor
  const composites: Array<{
    userId: string;
    composite: TriangulatedComposite;
    internalInvoiceAmount: string;
    releasedAmount: number;
    unreleasedAmount: number;
  }> = [];

  for (const contribId of contributorIds) {
    const admRaw = formData.get(`adminRating_${contribId}`);
    const peerRaw = formData.get(`peerRating_${contribId}`);
    const cliRaw = formData.get(`clientRating_${contribId}`);
    const invRaw = formData.get(`internalInvoiceAmount_${contribId}`);
    const adminRating = admRaw !== null && admRaw !== "" ? Number(admRaw) : null;
    const peerRating = peerRaw !== null && peerRaw !== "" ? Number(peerRaw) : null;
    const clientRating =
      cliRaw !== null && cliRaw !== "" ? Number(cliRaw) : null;

    const composite = snapshotComposite({
      projectId,
      contributorUserId: contribId,
      adminRating,
      peerRating,
      clientRating,
      actorUserId: admin.id,
    });

    const releasedAmount = perContribBonus * composite.bonusReleaseFraction;
    const unreleasedAmount = perContribBonus - releasedAmount;

    composites.push({
      userId: contribId,
      composite,
      internalInvoiceAmount: String(invRaw ?? perContribBonus.toFixed(2)),
      releasedAmount,
      unreleasedAmount,
    });
  }

  // 2. Debit reserve for each contributor's graduated release
  for (const c of composites) {
    if (c.releasedAmount <= 0) continue;
    appendReserveEntry({
      projectId,
      amount: c.releasedAmount,
      direction: "debit",
      creditReason: null,
      debitReason: "bonus_release",
      recipientId: c.userId,
      actorUserId: admin.id,
      rationale: `Composite ${c.composite.weightedComposite}/5 → released ${(c.composite.bonusReleaseFraction * 100).toFixed(1)}% of ${perContribBonus.toFixed(2)} bonus share.`,
    });
    logAuditEvent({
      actorUserId: admin.id,
      actorRoleSnapshot: snapshotActorRole(admin),
      action: "reserve.bonus_released",
      resourceKind: "reserve_pool",
      resourceId: projectId,
      before: null,
      after: {
        contributorUserId: c.userId,
        amount: c.releasedAmount.toFixed(2),
        composite: c.composite.weightedComposite,
      },
      reason: null,
    });
  }

  // 3. Sum unreleased → peer coverage pool
  const unreleasedPool = composites.reduce(
    (s, c) => s + c.unreleasedAmount,
    0,
  );

  if (unreleasedPool > 0) {
    const candidates: PeerCoverageContributor[] = composites.map((c) => ({
      userId: c.userId,
      weightedComposite: c.composite.weightedComposite,
      internalInvoiceAmount: c.internalInvoiceAmount,
    }));

    // 4. Distribute peer coverage
    const distributions = distributePeerCoverage({
      poolAmount: unreleasedPool,
      candidates,
    });

    let distributed = 0;
    for (const d of distributions) {
      appendReserveEntry({
        projectId,
        amount: d.amount,
        direction: "debit",
        creditReason: null,
        debitReason: "peer_coverage",
        recipientId: d.recipientUserId,
        actorUserId: admin.id,
        rationale: `Peer-coverage bonus: ${d.sharePct.toFixed(2)}% of ${unreleasedPool.toFixed(2)} unreleased pool.`,
      });
      logAuditEvent({
        actorUserId: admin.id,
        actorRoleSnapshot: snapshotActorRole(admin),
        action: "reserve.peer_coverage_distributed",
        resourceKind: "reserve_pool",
        resourceId: projectId,
        before: null,
        after: {
          recipientUserId: d.recipientUserId,
          amount: d.amount.toFixed(2),
        },
        reason: null,
      });
      distributed += d.amount;
    }

    // 5. Any remaining residual → Engagement Recovery Pool
    const residual = unreleasedPool - distributed;
    if (residual > 0.01) {
      appendReserveEntry({
        projectId,
        amount: residual,
        direction: "debit",
        creditReason: null,
        debitReason: "recovery_pool",
        recipientId: null,
        actorUserId: admin.id,
        rationale: `Residual after peer-coverage distribution — routed to Engagement Recovery Pool.`,
      });
      creditRecoveryPool(projectId, residual.toFixed(2));
      logAuditEvent({
        actorUserId: admin.id,
        actorRoleSnapshot: snapshotActorRole(admin),
        action: "reserve.recovery_routed",
        resourceKind: "reserve_pool",
        resourceId: projectId,
        before: null,
        after: { amount: residual.toFixed(2) },
        reason: null,
      });
    }
  }

  project.bonusDecision = "released";
  project.bonusDecidedAt = new Date().toISOString();
  project.updatedAt = project.bonusDecidedAt;

  revalidatePath(`/admin/contracts/${projectId}/settle`);
}

/**
 * Admin-approved client rebate. Requires a written rationale — this
 * is a consequential debit that shows up on the client-record
 * pattern surface (task #266). The multiplier is computed by the
 * triangulation math from the client + composite shortfalls; the
 * admin sizes the payment against the available reserve.
 */
export async function issueClientRebate(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const contributorUserId = String(
    formData.get("contributorUserId") ?? "",
  ).trim();
  const rationale = String(formData.get("rationale") ?? "").trim();

  if (!projectId) throw new Error("Project id is required.");
  if (!rationale) {
    throw new Error(
      "Rationale required. Rebates are consequential and need a written justification.",
    );
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Rebate amount must be a positive number.");
  }
  const balance = reservePoolBalance(projectId);
  if (amount > balance) {
    throw new Error(
      `Rebate ${amount.toFixed(2)} exceeds current reserve balance ${balance.toFixed(2)}.`,
    );
  }

  // Anti-abuse sanity check — if a composite exists for the
  // contributor, compute the rebate multiplier ceiling and warn if
  // the requested amount exceeds what the math would support. Not
  // a hard block (admin discretion may exceed the algorithm), but
  // captured in the audit trail.
  const composite = contributorUserId
    ? MOCK_TRIANGULATED_COMPOSITES.find(
        (c) =>
          c.projectId === projectId && c.contributorUserId === contributorUserId,
      )
    : null;
  let multiplierNote = "";
  if (composite) {
    const multiplier = computeRebateMultiplier({
      clientRating: composite.clientRating,
      weightedComposite: composite.weightedComposite,
    });
    const supported = balance * multiplier;
    multiplierNote = ` (triangulation supports up to ${supported.toFixed(2)} at multiplier ${multiplier})`;
  }

  appendReserveEntry({
    projectId,
    amount,
    direction: "debit",
    creditReason: null,
    debitReason: "client_rebate",
    recipientId: "client",
    actorUserId: admin.id,
    rationale: rationale + multiplierNote,
  });

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "reserve.rebate_issued",
    resourceKind: "reserve_pool",
    resourceId: projectId,
    before: null,
    after: { amount: amount.toFixed(2), rationale, multiplierNote },
    reason: rationale,
  });

  revalidatePath(`/admin/contracts/${projectId}/settle`);
}
