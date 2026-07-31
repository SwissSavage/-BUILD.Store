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
import { MOCK_BUILD_VOUCHERS } from "@/lib/mock-data/vouchers";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import { MOCK_USERS } from "@/lib/mock-data/users";
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
 * Compute current issued supply (excludes forfeited — reclaimed
 * amounts return to headroom). Kept synchronous / non-async so
 * callers inside plain functions like `distributeBuild()` can use
 * it without inheriting the async color.
 */
function currentIssuedSupply(): number {
  return MOCK_BUILD_VOUCHERS.filter(
    (v) => v.swapStatus !== "forfeited",
  ).reduce((sum, v) => sum + Number(v.amount), 0);
}

function newVoucherId(): string {
  return `voucher_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
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
export function issueVoucherInternal(
  input: IssueVoucherInput,
): IssueVoucherResult {
  const amountNum = Number(input.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error(
      `Cannot issue voucher: amount "${input.amount}" is not a positive finite number.`,
    );
  }

  const supplyBefore = currentIssuedSupply();
  const supplyAfter = supplyBefore + amountNum;
  if (supplyAfter > BUILD_VOUCHER_SUPPLY_CAP) {
    const headroom = BUILD_VOUCHER_SUPPLY_CAP - supplyBefore;
    throw new Error(
      `Voucher issuance would exceed the ${BUILD_VOUCHER_SUPPLY_CAP.toLocaleString()} supply cap. ` +
        `Current issuance: ${supplyBefore.toLocaleString()}. Requested: ${amountNum.toLocaleString()}. ` +
        `Remaining headroom: ${headroom.toLocaleString()}.`,
    );
  }

  const now = new Date().toISOString();
  const voucher: BuildVoucher = {
    id: newVoucherId(),
    userId: input.userId,
    amount: amountNum.toFixed(8),
    sourceType: input.sourceType,
    sourceRefId: input.sourceRefId,
    swapStatus: "unswapped",
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: now,
    notes: input.notes,
    issuedByUserId: input.issuedByUserId,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_BUILD_VOUCHERS.push(voucher);

  const actor = input.issuedByUserId
    ? MOCK_USERS.find((u) => u.id === input.issuedByUserId) ?? null
    : null;
  logAuditEvent({
    actorUserId: input.issuedByUserId,
    actorRoleSnapshot: snapshotActorRole(actor),
    action: "voucher.issued",
    resourceKind: "build_voucher",
    resourceId: voucher.id,
    before: null,
    after: {
      userId: input.userId,
      amount: voucher.amount,
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId,
      supplyBefore,
      supplyAfter,
    },
    reason: input.notes,
  });

  return { voucher, supplyBefore, supplyAfter };
}
