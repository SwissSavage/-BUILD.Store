/**
 * Voucher issuance internals — the shared helper that BOTH the
 * admin form action and the automated earning-event handlers call.
 *
 * Lives in its own module (no "use server" directive) so plain
 * functions like `distributeBuild()` can call it directly without
 * going through the server-action machinery. The admin form action
 * in `voucher-actions.ts` wraps this same helper with a
 * requireAdmin() gate.
 *
 * Every issuance path — manual admin entry, automated bonus
 * release, automated order-split settlement, future project-
 * completion event handlers — routes through here. That gives us
 * one supply-cap check, one audit-log call, and one place to
 * evolve the issuance semantics as the token contract situation
 * settles.
 */
import { randomUUID } from "crypto";
import { ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { buildVouchers } from "@/db/schema";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { getUserById } from "@/lib/readers/users";
import {
  buildSplitForGross,
  voucherSourceTypeFor,
} from "@/lib/build-formula";
import {
  HOUSE_LP_ID,
  HOUSE_TREASURY_ID,
} from "@/lib/settlement-splits";
import {
  BUILD_VOUCHER_SUPPLY_CAP,
  type BuildVoucher,
  type BuildVoucherSourceType,
} from "@/lib/types";

export interface IssueVoucherInput {
  userId: string;
  /** Decimal string (numeric(18,8) precision). Must be positive. */
  amount: string;
  sourceType: BuildVoucherSourceType;
  /** TokenTransaction id, order id, project id — whichever real
   *  event triggered this issuance. Null for admin_grant paths. */
  sourceRefId: string | null;
  notes: string | null;
  /** Actor for the audit trail. Null = system-initiated (e.g.,
   *  automated bonus-release cascade). */
  issuedByUserId: string | null;
}

export interface IssueVoucherResult {
  voucher: BuildVoucher;
  supplyBefore: number;
  supplyAfter: number;
}

/**
 * Advisory-lock key for voucher issuance. Any transaction that reads
 * the supply in order to decide whether it may issue takes this first,
 * so the read-check-insert sequence is serialized.
 *
 * Without it the cap is advisory only: two concurrent issuances can
 * both read a supply under the cap, both pass, and both insert. That
 * is not a hypothetical for a settlement cascade, which issues several
 * vouchers from one event.
 */
const VOUCHER_SUPPLY_LOCK = 8_231_004;

/**
 * Current issued supply, excluding forfeited — reclaimed amounts
 * return to headroom.
 *
 * Summed in SQL. Reading every voucher row to add up a number would
 * get slower with every issuance, and this runs on the hot path of
 * every settlement.
 */
async function currentIssuedSupply(
  tx: Pick<typeof db, "select">,
): Promise<number> {
  const [row] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(${buildVouchers.amount}), 0)`,
    })
    .from(buildVouchers)
    .where(ne(buildVouchers.swapStatus, "forfeited"));
  return Number(row?.total ?? 0);
}

function newVoucherId(): string {
  return `voucher_${randomUUID()}`;
}

/** One voucher's worth of input, before ids and timestamps. */
interface PendingVoucher {
  userId: string;
  amountNum: number;
  sourceType: BuildVoucherSourceType;
  sourceRefId: string | null;
  notes: string | null;
}

/**
 * Issue a batch of vouchers atomically.
 *
 * The cap is checked once against the total of the whole batch, inside
 * the same transaction that inserts them. This matters for the
 * settlement cascade: checking per-voucher in a loop means a batch that
 * crosses the cap partway through leaves the earlier vouchers issued
 * and the settlement permanently half-applied, with no signal that it
 * happened. Either the whole split lands or none of it does.
 *
 * Audit events are emitted after the commit, so the log never claims
 * an issuance that rolled back.
 */
async function issueVouchersAtomic(
  pending: PendingVoucher[],
  issuedByUserId: string | null,
): Promise<{
  vouchers: BuildVoucher[];
  supplyBefore: number;
  supplyAfter: number;
}> {
  for (const v of pending) {
    if (!Number.isFinite(v.amountNum) || v.amountNum <= 0) {
      throw new Error(
        `Cannot issue voucher: amount "${v.amountNum}" is not a positive finite number.`,
      );
    }
  }

  const now = new Date().toISOString();
  const vouchers: BuildVoucher[] = pending.map((v) => ({
    id: newVoucherId(),
    userId: v.userId,
    amount: v.amountNum.toFixed(8),
    sourceType: v.sourceType,
    sourceRefId: v.sourceRefId,
    // Vouchers stay vouchers. This is a claim on future $BUILD, not a
    // token transfer — the swap to an on-chain balance is a separate,
    // later step that sets swapStatus and swappedToTxHash.
    swapStatus: "unswapped" as const,
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: now,
    notes: v.notes,
    issuedByUserId,
    createdAt: now,
    updatedAt: now,
  }));

  const batchTotal = pending.reduce((sum, v) => sum + v.amountNum, 0);

  const { supplyBefore, supplyAfter } = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${VOUCHER_SUPPLY_LOCK})`);

    const before = await currentIssuedSupply(tx);
    const after = before + batchTotal;
    if (after > BUILD_VOUCHER_SUPPLY_CAP) {
      const headroom = BUILD_VOUCHER_SUPPLY_CAP - before;
      throw new Error(
        `Voucher issuance would exceed the ${BUILD_VOUCHER_SUPPLY_CAP.toLocaleString()} supply cap. ` +
          `Current issuance: ${before.toLocaleString()}. Requested: ${batchTotal.toLocaleString()}. ` +
          `Remaining headroom: ${headroom.toLocaleString()}.`,
      );
    }

    await tx.insert(buildVouchers).values(
      vouchers.map((v) => ({
        id: v.id,
        userId: v.userId,
        amount: v.amount,
        sourceType: v.sourceType,
        sourceRefId: v.sourceRefId,
        swapStatus: v.swapStatus,
        swappedToTxHash: v.swappedToTxHash,
        swappedAt: v.swappedAt,
        issuedAt: v.issuedAt,
        notes: v.notes,
        issuedByUserId: v.issuedByUserId,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    );

    return { supplyBefore: before, supplyAfter: after };
  });

  const actor = issuedByUserId ? await getUserById(issuedByUserId) : null;
  let running = supplyBefore;
  for (const v of vouchers) {
    const next = running + Number(v.amount);
    await logAuditEvent({
      actorUserId: issuedByUserId,
      actorRoleSnapshot: snapshotActorRole(actor),
      action: "voucher.issued",
      resourceKind: "build_voucher",
      resourceId: v.id,
      before: null,
      after: {
        userId: v.userId,
        amount: v.amount,
        sourceType: v.sourceType,
        sourceRefId: v.sourceRefId,
        supplyBefore: running,
        supplyAfter: next,
      },
      reason: v.notes,
    });
    running = next;
  }

  return { vouchers, supplyBefore, supplyAfter };
}

/**
 * Cap-guarded voucher issuance. Throws before mutating anything if
 * the supply cap would be exceeded — critical property because
 * callers rely on this being transactional (bonus-release cascade
 * shouldn't mark the project as released, then silently over-issue
 * a voucher).
 *
 * Amount validation is minimal here (positive + finite) — the
 * server-action wrapper handles user-facing form validation with
 * more granular error messages. Automated callers already know
 * their amounts are well-formed.
 */
export async function issueVoucherInternal(
  input: IssueVoucherInput,
): Promise<IssueVoucherResult> {
  const { vouchers, supplyBefore, supplyAfter } = await issueVouchersAtomic(
    [
      {
        userId: input.userId,
        amountNum: Number(input.amount),
        sourceType: input.sourceType,
        sourceRefId: input.sourceRefId,
        notes: input.notes,
      },
    ],
    input.issuedByUserId,
  );
  return { voucher: vouchers[0], supplyBefore, supplyAfter };
}

// ────────────────────────────────────────────────────────────────
//  Settlement cascade — issues the 4-way $BUILD split from a
//  settlement gross using the canonical build-formula constants.
// ────────────────────────────────────────────────────────────────

export interface IssueBuildFromSettlementInput {
  /** Gross cash amount for the settlement (invoice value / order
   *  subtotal / bonus amount). $BUILD is generated on network fees
   *  = 15% of this, per the canonical formula. */
  gross: number;
  cashSourceKind:
    | "contract_settlement"
    | "order_settlement"
    | "bonus_release";
  /** Opaque source id — project id / order id. Feeds sourceRefId on
   *  every voucher issued so admin can round-trip back to the event. */
  sourceId: string;
  /** Contributor user ids receiving the 80% talent share. Amounts
   *  optional — if provided, distributes proportionally to each
   *  contributor's share of the sum; if omitted, splits evenly. */
  contributors: { userIds: string[]; amounts?: string[] };
  /** Admin user ids receiving the 16% admin share. Split evenly. */
  admins: { userIds: string[] };
  /** Actor for the audit trail. Null = system-initiated. */
  actorUserId: string | null;
  /** Free-form note stored on every voucher issued. */
  noteContext?: string;
}

export interface IssueBuildFromSettlementResult {
  talentVouchers: BuildVoucher[];
  adminVouchers: BuildVoucher[];
  treasuryVoucher: BuildVoucher | null;
  liquidityPoolVoucher: BuildVoucher | null;
  totalGenerated: number;
}

/**
 * Cascade the 4-way $BUILD split from a settlement event. Talent
 * gets 80% (proportional to their internal-invoice share when
 * amounts provided, else evenly), admins get 16% (evenly), Treasury
 * gets 2%, LP gets 2%. Every voucher is issued through
 * `issueVoucherInternal` so the supply-cap guard fires on the
 * cumulative issuance.
 *
 * Skips zero-amount issuances (an empty admin roster, an empty
 * contributor list, or a gross so small the split rounds to zero).
 */
export async function issueBuildFromSettlement(
  input: IssueBuildFromSettlementInput,
): Promise<IssueBuildFromSettlementResult> {
  const split = buildSplitForGross(input.gross);
  const sourceType = voucherSourceTypeFor(input.cashSourceKind);

  // Assemble the entire split first, then issue it in one atomic
  // batch. The previous shape issued each leg separately, so a cap
  // breach partway through the cascade left talent paid and Treasury
  // not, with the settlement recorded as complete.
  const pending: PendingVoucher[] = [];
  const note = (role: string) =>
    input.noteContext ?? `$BUILD ${role} on ${input.cashSourceKind}`;

  let talentCount = 0;
  if (input.contributors.userIds.length > 0 && split.talent > 0) {
    const perAmounts =
      input.contributors.amounts &&
      input.contributors.amounts.length === input.contributors.userIds.length
        ? proportionateShares(input.contributors.amounts, split.talent)
        : evenSplit(split.talent, input.contributors.userIds.length);
    input.contributors.userIds.forEach((userId, i) => {
      const amt = perAmounts[i];
      if (amt <= 0) return;
      pending.push({
        userId,
        amountNum: amt,
        sourceType,
        sourceRefId: input.sourceId,
        notes: note("talent share"),
      });
      talentCount += 1;
    });
  }

  let adminCount = 0;
  if (input.admins.userIds.length > 0 && split.admin > 0) {
    const perAdmin = split.admin / input.admins.userIds.length;
    input.admins.userIds.forEach((userId) => {
      pending.push({
        userId,
        amountNum: perAdmin,
        sourceType,
        sourceRefId: input.sourceId,
        notes: note("admin-pool share"),
      });
      adminCount += 1;
    });
  }

  const hasTreasury = split.treasury > 0;
  if (hasTreasury) {
    pending.push({
      userId: HOUSE_TREASURY_ID,
      amountNum: split.treasury,
      sourceType,
      sourceRefId: input.sourceId,
      notes: note("Treasury share"),
    });
  }

  const hasLp = split.liquidityPool > 0;
  if (hasLp) {
    pending.push({
      userId: HOUSE_LP_ID,
      amountNum: split.liquidityPool,
      sourceType,
      sourceRefId: input.sourceId,
      notes: note("LP share"),
    });
  }

  if (pending.length === 0) {
    return {
      talentVouchers: [],
      adminVouchers: [],
      treasuryVoucher: null,
      liquidityPoolVoucher: null,
      totalGenerated: split.totalGenerated,
    };
  }

  const { vouchers } = await issueVouchersAtomic(pending, input.actorUserId);

  // Slice the result back into legs, in the order they were pushed.
  let cursor = 0;
  const talentVouchers = vouchers.slice(cursor, (cursor += talentCount));
  const adminVouchers = vouchers.slice(cursor, (cursor += adminCount));
  const treasuryVoucher = hasTreasury ? vouchers[cursor++] : null;
  const liquidityPoolVoucher = hasLp ? vouchers[cursor++] : null;

  return {
    talentVouchers,
    adminVouchers,
    treasuryVoucher,
    liquidityPoolVoucher,
    totalGenerated: split.totalGenerated,
  };
}

/**
 * Given per-contributor amount strings (e.g. from internal invoice
 * totals), compute each contributor's share of `totalPool` in
 * proportion to their amount. Returns per-user numbers summing to
 * totalPool within rounding tolerance.
 */
function proportionateShares(
  amounts: string[],
  totalPool: number,
): number[] {
  const numeric = amounts.map((a) => Number(a));
  const sum = numeric.reduce((s, n) => s + n, 0);
  if (sum <= 0) return numeric.map(() => 0);
  return numeric.map((n) => (n / sum) * totalPool);
}

function evenSplit(total: number, n: number): number[] {
  if (n === 0) return [];
  const each = total / n;
  return new Array(n).fill(each);
}
