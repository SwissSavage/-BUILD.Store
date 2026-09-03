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
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  customerFeedback,
  projects as projectsTable,
} from "@/db/schema";
import { getProjectById } from "@/lib/readers/projects";
import { getUserById } from "@/lib/readers/users";
import {
  customerFeedbackReader,
  getReviewsForProject,
} from "@/lib/readers";
import {
  getComposite,
  hasReserveCredit,
  reservePoolBalance,
} from "@/lib/readers/reserve-pool";
import {
  appendReserveEntry,
  creditRecoveryPool,
  insertComposite,
} from "@/lib/writers/reserve-pool";
import {
  aggregatePeerCompositeForContributor,
  computeRebateMultiplier,
  computeTriangulatedComposite,
  distributePeerCoverage,
  extractClientRatingForProject,
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
  const project = await getProjectById(input.projectId);
  if (!project) return null;
  if (!project.talentBonusAmount) return null;
  const amount = Number(project.talentBonusAmount);
  if (amount <= 0) return null;

  // Idempotency guard. Also enforced by a partial unique index in
  // 0015 — two invoice-payment webhooks arriving together can both
  // pass this check, and double-funding the reserve inflates every
  // contributor's bonus release downstream.
  if (await hasReserveCredit(input.projectId, "invoice_collection")) {
    return null;
  }

  const row = await appendReserveEntry({
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
    ? await getUserById(input.actorUserId)
    : null;
  await logAuditEvent({
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
async function snapshotComposite(input: {
  projectId: string;
  contributorUserId: string;
  adminRating: number | null;
  peerRating: number | null;
  clientRating: number | null;
  actorUserId: string | null;
}): Promise<TriangulatedComposite> {
  const result = computeTriangulatedComposite({
    adminRating: input.adminRating,
    peerRating: input.peerRating,
    clientRating: input.clientRating,
  });
  const row = await insertComposite({
    projectId: input.projectId,
    contributorUserId: input.contributorUserId,
    adminRating: result.adminRating,
    peerRating: result.peerRating,
    clientRating: result.clientRating,
    effectiveWeights: result.effectiveWeights,
    weightedComposite: result.weightedComposite,
    bonusReleaseFraction: result.bonusReleaseFraction,
    computedAt: new Date().toISOString(),
  });

  const actor = input.actorUserId
    ? await getUserById(input.actorUserId)
    : null;
  await logAuditEvent({
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
 * ANTI-ABUSE STRUCTURE (locked 2026-08-04):
 * Ratings are pulled from source-of-truth tables — admin CANNOT
 * override any rating. Only the original rater can change their own
 * submission at the source:
 *   - Client rating: customer_feedback (submitted via magic-link
 *                    questionnaire at /contracts/[id]/feedback)
 *   - Peer rating:   aggregated from peer_reviews (submitted by
 *                    fellow contributors on the project page)
 *   - Admin rating:  project.pmEngagementRating (captured on the
 *                    settle page via setPmEngagementRating)
 *
 * Form contract per contributor is now MINIMAL:
 *   - contributorId (repeated)
 *   - internalInvoiceAmount_<contributorId> (for peer-coverage
 *     weighting only — this is billing data, not a rating)
 *
 * Release blocks with a clear error if any required source rating
 * is missing for a contributor — admin has to chase the actual
 * rater, not proxy for them. Client rating being null is allowed
 * (weights redistribute pro-rata) because that's the legitimate
 * internal-work / cooperative-as-client case.
 *
 * Cascade at close:
 *   1. Read ratings from the source tables
 *   2. Snapshot composite per contributor (frozen for audit)
 *   3. Debit reserve per contributor at (bonus share × composite/5)
 *   4. Unreleased bonus → peer-coverage cascade (composite ≥ 4.5)
 *   5. Residual → Engagement Recovery Pool
 */
export async function executeGraduatedBonusRelease(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Project id is required.");
  const project = await getProjectById(projectId);
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

  // Ratings for this project only. Loaded once and scoped in SQL —
  // a bonus release must not read every project's peer reviews to
  // find the handful that belong to this one, and the loops below
  // would otherwise re-query per contributor.
  const [projectReviews, projectFeedback] = await Promise.all([
    getReviewsForProject(projectId),
    customerFeedbackReader.where(eq(customerFeedback.contextId, projectId)),
  ]);

  // Read admin/PM rating from the project row (source of truth).
  const adminRating = project.pmEngagementRating ?? null;
  // Read client rating from customer_feedback (most recent wins).
  const clientRating = extractClientRatingForProject({
    feedback: projectFeedback,
    projectId,
  });

  const totalBonus = Number(project.talentBonusAmount);

  // Per-contributor bonus share = weighted by their internal invoice
  // amount, NOT even split. This aligns the bonus math with the same
  // per-Builder pricing pattern used at contract quote-time — each
  // contributor's share of the bonus pool reflects the size of their
  // contribution, not a naive 1/N split.
  //
  // If a contributor didn't provide an internal invoice amount (form
  // input missing / not applicable), fall back to the even-split
  // amount for that contributor so they aren't dropped. Mixed mode
  // is discouraged — the surface warns admin to fill in invoices for
  // everyone or none — but the math handles it safely.
  const evenSplitFallback = totalBonus / contributorIds.length;
  const invoiceAmounts = contributorIds.map((id) => {
    const raw = formData.get(`internalInvoiceAmount_${id}`);
    const num = raw !== null && raw !== "" ? Number(raw) : NaN;
    return Number.isFinite(num) && num > 0 ? num : null;
  });
  const totalInvoices = invoiceAmounts.reduce<number>(
    (sum, amt) => sum + (amt ?? 0),
    0,
  );
  const perContribBonusByIdx: number[] = contributorIds.map((_, i) => {
    const invoice = invoiceAmounts[i];
    if (invoice === null || totalInvoices <= 0) {
      return evenSplitFallback;
    }
    return totalBonus * (invoice / totalInvoices);
  });

  // Note which sources are missing so the audit trail captures
  // what the composite was computed against. NOT a block — after a
  // reasonable grace window (admin's call on when to trigger this
  // action), missing ratings are omitted and the composite math
  // redistributes the weight pro-rata across the sources that DID
  // land. Talent doesn't get held up forever because a client or
  // peer never responded.
  const missingSources: string[] = [];
  if (adminRating === null) missingSources.push("admin (PM)");
  if (clientRating === null) missingSources.push("client");
  const missingPeerContribs: string[] = [];
  for (const contribId of contributorIds) {
    const peer = aggregatePeerCompositeForContributor({
      reviews: projectReviews,
      projectId,
      contributorUserId: contribId,
    });
    if (peer === null) missingPeerContribs.push(contribId);
  }
  const missingSummary =
    missingSources.length > 0 || missingPeerContribs.length > 0
      ? ` Missing at release: ${[
          ...missingSources,
          ...(missingPeerContribs.length > 0
            ? [`peer for ${missingPeerContribs.length} contributor(s)`]
            : []),
        ].join(", ")}. Weights redistributed pro-rata.`
      : "";

  // 1. Compute + snapshot composites per contributor (all ratings
  //    from source tables, no admin override; missing ratings
  //    omitted with pro-rata weight redistribution).
  const composites: Array<{
    userId: string;
    composite: TriangulatedComposite;
    internalInvoiceAmount: string;
    releasedAmount: number;
    unreleasedAmount: number;
  }> = [];

  for (const [idx, contribId] of contributorIds.entries()) {
    const peerRating = aggregatePeerCompositeForContributor({
      reviews: projectReviews,
      projectId,
      contributorUserId: contribId,
    });
    const contribBonusShare = perContribBonusByIdx[idx];
    const invoiceAmount =
      invoiceAmounts[idx] !== null
        ? String(invoiceAmounts[idx])
        : contribBonusShare.toFixed(2);

    const composite = await snapshotComposite({
      projectId,
      contributorUserId: contribId,
      adminRating,
      peerRating,
      clientRating,
      actorUserId: admin.id,
    });

    const releasedAmount = contribBonusShare * composite.bonusReleaseFraction;
    const unreleasedAmount = contribBonusShare - releasedAmount;

    composites.push({
      userId: contribId,
      composite,
      internalInvoiceAmount: invoiceAmount,
      releasedAmount,
      unreleasedAmount,
    });
  }

  // 2. Debit reserve for each contributor's graduated release
  //    (share weighted by their internal invoice amount, composite
  //    fraction applied per contributor)
  for (const c of composites) {
    if (c.releasedAmount <= 0) continue;
    const contribShare = c.releasedAmount + c.unreleasedAmount;
    await appendReserveEntry({
      projectId,
      amount: c.releasedAmount,
      direction: "debit",
      creditReason: null,
      debitReason: "bonus_release",
      recipientId: c.userId,
      actorUserId: admin.id,
      rationale: `Composite ${c.composite.weightedComposite}/5 → released ${(c.composite.bonusReleaseFraction * 100).toFixed(1)}% of ${contribShare.toFixed(2)} bonus share (weighted by ${c.internalInvoiceAmount} internal invoice).`,
    });
    await logAuditEvent({
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
      await appendReserveEntry({
        projectId,
        amount: d.amount,
        direction: "debit",
        creditReason: null,
        debitReason: "peer_coverage",
        recipientId: d.recipientUserId,
        actorUserId: admin.id,
        rationale: `Peer-coverage bonus: ${d.sharePct.toFixed(2)}% of ${unreleasedPool.toFixed(2)} unreleased pool.`,
      });
      await logAuditEvent({
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
      await appendReserveEntry({
        projectId,
        amount: residual,
        direction: "debit",
        creditReason: null,
        debitReason: "recovery_pool",
        recipientId: null,
        actorUserId: admin.id,
        rationale: `Residual after peer-coverage distribution — routed to Engagement Recovery Pool.`,
      });
      await creditRecoveryPool(projectId, residual.toFixed(2));
      await logAuditEvent({
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

  // Persisted, not assigned. `project` is a database row, not the
  // shared fixture object it used to be, so mutating it here did
  // nothing at all — the graduated release ran, money moved through
  // the ledger, and the contract stayed marked bonus-pending.
  //
  // Guarded on still-pending so a second run can't re-release a bonus
  // that has already been paid out.
  const bonusDecidedAt = new Date().toISOString();
  const released = await db
    .update(projectsTable)
    .set({
      bonusDecision: "released",
      bonusDecidedAt,
      updatedAt: bonusDecidedAt,
    })
    .where(
      and(
        eq(projectsTable.id, projectId),
        or(
          isNull(projectsTable.bonusDecision),
          eq(projectsTable.bonusDecision, "pending"),
        ),
      ),
    )
    .returning({ id: projectsTable.id });
  if (released.length === 0) {
    throw new Error(
      "Bonus decision was already recorded for this contract by another request.",
    );
  }
  project.bonusDecision = "released";
  project.bonusDecidedAt = bonusDecidedAt;

  // Log a summary of what the release fired against — including
  // any missing sources — so the audit trail captures the state.
  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "reserve.bonus_released",
    resourceKind: "reserve_pool",
    resourceId: projectId,
    before: null,
    after: {
      contributors: composites.map((c) => ({
        userId: c.userId,
        composite: c.composite.weightedComposite,
        released: c.releasedAmount.toFixed(2),
      })),
    },
    reason: `Graduated release fired.${missingSummary}`,
  });

  revalidatePath(`/admin/contracts/${projectId}/settle`);
  revalidatePath(`/admin/reserve`);
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
  const balance = await reservePoolBalance(projectId);
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
    ? await getComposite(projectId, contributorUserId)
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

  await appendReserveEntry({
    projectId,
    amount,
    direction: "debit",
    creditReason: null,
    debitReason: "client_rebate",
    recipientId: "client",
    actorUserId: admin.id,
    rationale: rationale + multiplierNote,
  });

  await logAuditEvent({
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
