/**
 * Shared settlement-splits engine.
 *
 * ONE canonical function that writes revenue-split rows for any
 * settlement event — contract close, order settlement, bonus release,
 * donation. Callers hand in the gross amount + source metadata +
 * recipient allocations, and this module handles the pool math,
 * sentinel routing (Treasury / LP), row generation, and audit-log
 * emission.
 *
 * Split invariants (locked by build-vision.md):
 *   - Contributor pool = 85% of gross
 *   - Admin pool       = 12% of gross (evenly across admins on the deal)
 *   - Treasury         = 1.5% of gross
 *   - Liquidity Pool   = 1.5% of gross
 *
 * Donations follow the war-chest exception:
 *   - Contributor pool = 0
 *   - Admin pool       = 0
 *   - Treasury         = 50% of gross
 *   - LP               = 50% of gross
 *
 * Sandbox mutates MOCK_SPLITS in memory. Production writes to the
 * Drizzle `revenue_splits` table.
 *
 * NOTE: this module writes CASH splits only. $BUILD voucher issuance
 * for the same settlement event fires through
 * `distributeBuild()` → `issueVoucherInternal()`. Tier 28 will unify
 * the two so a single settlement call produces cash + voucher rows
 * atomically.
 */
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import { MOCK_USERS } from "@/lib/mock-data/users";
import type {
  RevenueSplit,
  RevenueSplitSourceKind,
} from "@/lib/types";

// ────────────────────────────────────────────────────────────────
//  Canonical split ratios
// ────────────────────────────────────────────────────────────────

/** Standard settlement (contracts, orders, bonus release). */
export const CONTRIBUTOR_PCT = 0.85;
export const ADMIN_PCT = 0.12;
export const TREASURY_PCT = 0.015;
export const LP_PCT = 0.015;

/** Donation war-chest exception. */
export const DONATION_TREASURY_PCT = 0.5;
export const DONATION_LP_PCT = 0.5;

/** Sentinel recipient ids for structural pools. Not real users. */
export const HOUSE_TREASURY_ID = "house_treasury";
export const HOUSE_LP_ID = "house_liquidity_pool";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toMoney(n: number): string {
  return round2(n).toFixed(2);
}

function nextSplitId(prefix: string): string {
  return `split_${Date.now().toString(36)}_${prefix}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

// ────────────────────────────────────────────────────────────────
//  Recipient allocation input
// ────────────────────────────────────────────────────────────────

/**
 * How to split the contributor pool. Callers provide user ids +
 * their per-user amounts (NOT percentages — the amounts should sum
 * to the contributor pool). This shape supports the internal-invoice
 * pattern where each contributor bills their exact rate rather than
 * a proportional share of a lump sum.
 *
 * If `amounts` is omitted, the pool splits evenly across the userIds
 * (fallback for the naive MVP path).
 */
export interface ContributorAllocation {
  userIds: string[];
  /** Per-user amounts (matching userIds by index). If omitted, even split. */
  amounts?: string[];
}

/**
 * How to split the admin pool. Even split by default across the
 * userIds. Supports optional per-admin percentages (sums to 100)
 * for the settleContract legacy path where admin can override.
 */
export interface AdminAllocation {
  userIds: string[];
  /** Per-admin percentages (matching userIds by index, sum to 100). If omitted, even split. */
  percentages?: number[];
}

// ────────────────────────────────────────────────────────────────
//  Main entry point
// ────────────────────────────────────────────────────────────────

export interface WriteStandardSplitsInput {
  /** Gross amount to split (invoice/order/bonus value). */
  gross: number;
  sourceKind: Exclude<RevenueSplitSourceKind, "donation">;
  /** Opaque source id — project id / order id / etc. */
  sourceId: string;
  /** Legacy project id for back-compat (null for order settlements). */
  contractId: string | null;
  contributors: ContributorAllocation;
  admins: AdminAllocation;
  /** Admin performing the settlement (for audit log actor). */
  actorUserId: string;
  /** Optional per-row note context. */
  noteContext?: string;
}

export interface WriteSplitsResult {
  rows: RevenueSplit[];
  contributorPool: number;
  adminPool: number;
  treasury: number;
  liquidityPool: number;
}

/**
 * Write the four-pool split for a standard settlement event.
 *
 * Throws before mutating anything if:
 *   - contributors.userIds is empty (no one to pay)
 *   - admins.userIds is empty (need at least one admin for the pool)
 *   - amounts don't sum to the contributor pool (within $0.01 tolerance)
 *   - percentages don't sum to 100 (within 0.01% tolerance)
 */
export function writeStandardSettlementSplits(
  input: WriteStandardSplitsInput,
): WriteSplitsResult {
  if (input.gross <= 0) {
    throw new Error(`Cannot settle non-positive gross amount: ${input.gross}`);
  }
  if (input.contributors.userIds.length === 0) {
    throw new Error("At least one contributor required for settlement.");
  }
  if (input.admins.userIds.length === 0) {
    throw new Error("At least one admin required for the commission pool.");
  }

  const contributorPool = round2(input.gross * CONTRIBUTOR_PCT);
  const adminPool = round2(input.gross * ADMIN_PCT);
  const treasury = round2(input.gross * TREASURY_PCT);
  const liquidityPool = round2(input.gross * LP_PCT);

  const now = new Date().toISOString();
  const actor = MOCK_USERS.find((u) => u.id === input.actorUserId) ?? null;
  const rows: RevenueSplit[] = [];

  // ── Contributor rows ─────────────────────────────────────────
  const contribAmounts = input.contributors.amounts
    ? input.contributors.amounts.map((a) => Number(a))
    : new Array(input.contributors.userIds.length).fill(
        contributorPool / input.contributors.userIds.length,
      );

  const contribTotal = contribAmounts.reduce((s, a) => s + a, 0);
  if (Math.abs(contribTotal - contributorPool) > 0.02) {
    throw new Error(
      `Contributor amounts sum to ${toMoney(contribTotal)} but pool is ${toMoney(contributorPool)}. Off by ${toMoney(Math.abs(contribTotal - contributorPool))}.`,
    );
  }

  input.contributors.userIds.forEach((userId, i) => {
    const amount = contribAmounts[i];
    const sharePct = (amount / contributorPool) * 100;
    rows.push({
      id: nextSplitId("c"),
      contractId: input.contractId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      recipientId: userId,
      pool: "contributor",
      sharePct: sharePct.toFixed(3),
      amount: toMoney(amount),
      auto: false,
      decidedBy: input.actorUserId,
      decidedAt: now,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: input.noteContext ?? null,
    });
  });

  // ── Admin rows ───────────────────────────────────────────────
  const adminPercentages = input.admins.percentages
    ? input.admins.percentages
    : new Array(input.admins.userIds.length).fill(
        100 / input.admins.userIds.length,
      );

  const adminPctTotal = adminPercentages.reduce((s, p) => s + p, 0);
  if (Math.abs(adminPctTotal - 100) > 0.01) {
    throw new Error(
      `Admin percentages sum to ${adminPctTotal.toFixed(2)}%, expected 100%.`,
    );
  }

  input.admins.userIds.forEach((userId, i) => {
    const pct = adminPercentages[i];
    rows.push({
      id: nextSplitId("a"),
      contractId: input.contractId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      recipientId: userId,
      pool: "admin",
      sharePct: pct.toFixed(3),
      amount: toMoney((adminPool * pct) / 100),
      auto: false,
      decidedBy: input.actorUserId,
      decidedAt: now,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: input.noteContext ?? null,
    });
  });

  // ── Reserve rows: Treasury (1.5% of gross) + LP (1.5%) ──────
  rows.push(makeReserveRow({
    input,
    now,
    recipientId: HOUSE_TREASURY_ID,
    amount: treasury,
    label: "operating treasury",
  }));
  rows.push(makeReserveRow({
    input,
    now,
    recipientId: HOUSE_LP_ID,
    amount: liquidityPool,
    label: "$BUILD liquidity pool",
  }));

  // Commit all rows atomically (sandbox: single splice). Fail-fast
  // above means we never end up with partial writes.
  MOCK_SPLITS.push(...rows);

  logAuditEvent({
    actorUserId: input.actorUserId,
    actorRoleSnapshot: snapshotActorRole(actor),
    action: "contract.revenue_split_recorded",
    resourceKind: input.sourceKind === "order_settlement" ? "project" : "project",
    resourceId: input.sourceId,
    before: null,
    after: {
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      gross: toMoney(input.gross),
      contributorPool: toMoney(contributorPool),
      adminPool: toMoney(adminPool),
      treasury: toMoney(treasury),
      liquidityPool: toMoney(liquidityPool),
      contributorCount: input.contributors.userIds.length,
      adminCount: input.admins.userIds.length,
    },
    reason: input.noteContext ?? null,
  });

  return { rows, contributorPool, adminPool, treasury, liquidityPool };
}

function makeReserveRow(args: {
  input: WriteStandardSplitsInput;
  now: string;
  recipientId: string;
  amount: number;
  label: string;
}): RevenueSplit {
  return {
    id: nextSplitId("r"),
    contractId: args.input.contractId,
    sourceKind: args.input.sourceKind,
    sourceId: args.input.sourceId,
    recipientId: args.recipientId,
    pool: "reserve",
    sharePct: "50.000",
    amount: toMoney(args.amount),
    auto: true,
    decidedBy: null,
    decidedAt: null,
    payoutStatus: "queued",
    payoutSentAt: null,
    stripeTransferId: null,
    notes: `Auto-routed: 1.5% of gross to ${args.label}.`,
  };
}

// ────────────────────────────────────────────────────────────────
//  Donation split (war-chest exception: 50/50 Treasury/LP only)
// ────────────────────────────────────────────────────────────────

export interface WriteDonationSplitInput {
  gross: number;
  /** whitelist_purchase id. */
  sourceId: string;
  actorUserId: string | null;
  noteContext?: string;
}

export function writeDonationSplit(
  input: WriteDonationSplitInput,
): WriteSplitsResult {
  if (input.gross <= 0) {
    throw new Error(`Cannot settle non-positive donation: ${input.gross}`);
  }
  const treasury = round2(input.gross * DONATION_TREASURY_PCT);
  const liquidityPool = round2(input.gross - treasury);
  const now = new Date().toISOString();
  const actor = input.actorUserId
    ? MOCK_USERS.find((u) => u.id === input.actorUserId) ?? null
    : null;

  const rows: RevenueSplit[] = [
    {
      id: nextSplitId("d_t"),
      contractId: null,
      sourceKind: "donation",
      sourceId: input.sourceId,
      recipientId: HOUSE_TREASURY_ID,
      pool: "reserve",
      sharePct: "50.000",
      amount: toMoney(treasury),
      auto: true,
      decidedBy: null,
      decidedAt: null,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: input.noteContext ?? "War-chest donation: 50% to Treasury.",
    },
    {
      id: nextSplitId("d_lp"),
      contractId: null,
      sourceKind: "donation",
      sourceId: input.sourceId,
      recipientId: HOUSE_LP_ID,
      pool: "reserve",
      sharePct: "50.000",
      amount: toMoney(liquidityPool),
      auto: true,
      decidedBy: null,
      decidedAt: null,
      payoutStatus: "queued",
      payoutSentAt: null,
      stripeTransferId: null,
      notes: input.noteContext ?? "War-chest donation: 50% to LP.",
    },
  ];
  MOCK_SPLITS.push(...rows);

  logAuditEvent({
    actorUserId: input.actorUserId,
    actorRoleSnapshot: snapshotActorRole(actor),
    action: "contract.revenue_split_recorded",
    resourceKind: "project",
    resourceId: input.sourceId,
    before: null,
    after: {
      sourceKind: "donation",
      sourceId: input.sourceId,
      gross: toMoney(input.gross),
      treasury: toMoney(treasury),
      liquidityPool: toMoney(liquidityPool),
    },
    reason: input.noteContext ?? "Donation split routed 50/50 Treasury/LP.",
  });

  return {
    rows,
    contributorPool: 0,
    adminPool: 0,
    treasury,
    liquidityPool,
  };
}
