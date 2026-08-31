/**
 * $BUILD voucher ledger admin actions.
 *
 * Issue, mark-pending-swap, complete-swap, forfeit. Sandbox mutates
 * MOCK_BUILD_VOUCHERS in memory; production persists to the Drizzle
 * `build_vouchers` table (see src/db/schema.ts).
 *
 * Design posture:
 *   - Every mutation writes to the audit log with a `voucher.*` verb
 *     so the swap lifecycle is fully traceable — critical because
 *     the voucher IS the accounting mirror of the real token, and
 *     regulators + counsel will want the full trail when the
 *     multisig contract (or new spin-up) settles the batch swap.
 *   - Supply-cap enforcement runs at issuance time. Cannot issue a
 *     voucher that would push cumulative unforfeited issuance above
 *     BUILD_VOUCHER_SUPPLY_CAP (10M). Forfeited vouchers do NOT
 *     count against the cap — reclaimed supply is returned to
 *     issuance headroom.
 *   - Amounts flow as strings end-to-end (Postgres numeric round-
 *     trips through Drizzle as string) with Number() coercion for
 *     arithmetic. Cap arithmetic is safe because 10M * 1e8 = 1e15,
 *     comfortably under Number.MAX_SAFE_INTEGER (9e15).
 *   - Swap transitions are one-directional:
 *       unswapped → pending_swap → swapped
 *       unswapped → forfeited (admin reclaim before swap)
 *       pending_swap → swapped (batch executed)
 *       pending_swap → unswapped (batch cancelled — admin can undo
 *                                 the pending-swap flag if a batch
 *                                 window closes without executing)
 *     No path from swapped back — once the on-chain settlement
 *     lands, the voucher is done. If a swap needs to be reversed,
 *     that's a chain-level action (refund, burn) outside this
 *     ledger's scope.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_BUILD_VOUCHERS } from "@/lib/mock-data/vouchers";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { issueVoucherInternal } from "@/lib/voucher-issuance";
import {
  BUILD_VOUCHER_SUPPLY_CAP,
  type BuildVoucher,
  type BuildVoucherSourceType,
} from "@/lib/types";

const SOURCE_TYPES: readonly BuildVoucherSourceType[] = [
  "project_completion",
  "referral",
  "collaboration",
  "governance",
  "admin_grant",
] as const;

function isSourceType(raw: string): raw is BuildVoucherSourceType {
  return (SOURCE_TYPES as readonly string[]).includes(raw);
}

/**
 * Sum all voucher amounts across the ledger, filtered by swap
 * status. Forfeited vouchers are excluded from the default filter
 * because they no longer count against the supply cap. Callers that
 * want the full-history sum can pass an explicit status list.
 */
export async function totalIssuedSupply(
  statuses: readonly BuildVoucher["swapStatus"][] = [
    "unswapped",
    "pending_swap",
    "swapped",
  ],
): Promise<number> {
  return MOCK_BUILD_VOUCHERS.filter((v) => statuses.includes(v.swapStatus)).reduce(
    (sum, v) => sum + Number(v.amount),
    0,
  );
}

/**
 * Remaining headroom against the 10M cap. Convenience wrapper on
 * top of totalIssuedSupply so the admin surface can render "X of
 * 10M issued, Y remaining."
 */
export async function remainingSupply(): Promise<number> {
  const issued = await totalIssuedSupply();
  return BUILD_VOUCHER_SUPPLY_CAP - issued;
}

/**
 * Parse and validate a decimal amount input. Accepts either an
 * integer-shaped string ("125000") or a decimal string
 * ("125000.5"), and normalizes to 8-decimal Postgres numeric
 * ("125000.00000000"). Rejects negative, zero, non-finite, and
 * strings with more than 8 decimal places (per the numeric(18,8)
 * schema constraint).
 */
function parseVoucherAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Amount is required.");
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Amount "${raw}" is not a valid number.`);
  }
  if (parsed <= 0) {
    throw new Error("Amount must be positive.");
  }
  // Numeric(18,8) is safe within JS number precision at this cap.
  // 10M * 1e8 = 1e15 << Number.MAX_SAFE_INTEGER (9e15).
  const decimals = trimmed.includes(".") ? trimmed.split(".")[1].length : 0;
  if (decimals > 8) {
    throw new Error("Amount cannot have more than 8 decimal places.");
  }
  return parsed.toFixed(8);
}

/**
 * Issue a new voucher. Admin-authored — an end-of-project bonus
 * release, an OG-onboarding backfill, an admin_grant for edge cases,
 * etc. Supply cap enforced BEFORE the row is pushed so we never
 * over-issue and roll back.
 *
 * When wired into the project-completion / referral / collaboration
 * / governance earning flows, this same action fires from the
 * server-side of those flows with `issuedByUserId` set to the
 * completing user (self-issuance is allowed for machine-driven
 * earning events).
 */
export async function issueVoucher(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const sourceTypeRaw = String(formData.get("sourceType") ?? "").trim();
  const sourceRefId = String(formData.get("sourceRefId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!userId) throw new Error("Pick a user to issue the voucher to.");
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  const amount = parseVoucherAmount(amountRaw);

  if (!isSourceType(sourceTypeRaw)) {
    throw new Error(
      `Unknown source type "${sourceTypeRaw}". Allowed: ${SOURCE_TYPES.join(", ")}`,
    );
  }
  const sourceType = sourceTypeRaw;

  // Shared internal helper handles supply-cap guard + audit-log.
  // This admin action just wraps it with requireAdmin + form-level
  // validation. Automated earning-event handlers (bonus release,
  // order split, etc.) call the same helper directly.
  issueVoucherInternal({
    userId,
    amount,
    sourceType,
    sourceRefId,
    notes:
      notes ??
      `Admin-issued voucher for ${user.firstName} ${user.lastName ?? ""}`.trim(),
    issuedByUserId: admin.id,
  });

  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/wallet");
}

/**
 * Flip an unswapped voucher into pending_swap. Signals to the
 * batch-swap surface that this row is queued for the next window.
 * Reversible until the swap actually executes (see
 * cancelPendingSwap).
 */
export async function markVoucherPendingSwap(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Voucher id is required.");

  const row = MOCK_BUILD_VOUCHERS.find((v) => v.id === id);
  if (!row) throw new Error("Voucher not found.");
  if (row.swapStatus !== "unswapped") {
    throw new Error(
      `Only unswapped vouchers can be queued for swap. This one is ${row.swapStatus}.`,
    );
  }

  const before = { swapStatus: row.swapStatus };
  row.swapStatus = "pending_swap";
  row.updatedAt = new Date().toISOString();

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "voucher.marked_pending_swap",
    resourceKind: "build_voucher",
    resourceId: row.id,
    before,
    after: { swapStatus: row.swapStatus },
    reason: null,
  });

  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/members/${row.userId}`);
  revalidatePath("/wallet");
}

/**
 * Reverse a pending_swap back to unswapped. Used when a batch
 * window closes without executing and the queued rows need to
 * clear so they can be re-queued in the next window.
 */
export async function cancelPendingSwap(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Voucher id is required.");

  const row = MOCK_BUILD_VOUCHERS.find((v) => v.id === id);
  if (!row) throw new Error("Voucher not found.");
  if (row.swapStatus !== "pending_swap") {
    throw new Error(
      `Only pending_swap vouchers can be reverted to unswapped. This one is ${row.swapStatus}.`,
    );
  }

  const before = { swapStatus: row.swapStatus };
  row.swapStatus = "unswapped";
  row.updatedAt = new Date().toISOString();

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    // Uses marked_pending_swap verb for both directions — the
    // before/after payload disambiguates. Keeping one verb per
    // state transition keeps the audit-verb enum manageable.
    action: "voucher.marked_pending_swap",
    resourceKind: "build_voucher",
    resourceId: row.id,
    before,
    after: { swapStatus: row.swapStatus },
    reason: "Reverted from pending_swap after batch window closed unexecuted.",
  });

  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/members/${row.userId}`);
  revalidatePath("/wallet");
}

/**
 * Complete a batch swap by attaching the on-chain tx hash and
 * flipping the row to `swapped`. Terminal state — no path back.
 * Accepts either pending_swap or unswapped as the starting state
 * (an admin executing an ad-hoc swap outside the queue is allowed).
 */
export async function completeVoucherSwap(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const txHash = String(formData.get("txHash") ?? "").trim();
  if (!id) throw new Error("Voucher id is required.");
  if (!txHash) {
    throw new Error(
      "Transaction hash is required to complete a swap. Paste the on-chain tx hash from the batch settlement.",
    );
  }

  const row = MOCK_BUILD_VOUCHERS.find((v) => v.id === id);
  if (!row) throw new Error("Voucher not found.");
  if (row.swapStatus === "swapped") {
    throw new Error("This voucher has already been swapped.");
  }
  if (row.swapStatus === "forfeited") {
    throw new Error("Forfeited vouchers cannot be swapped.");
  }

  const before = {
    swapStatus: row.swapStatus,
    swappedToTxHash: row.swappedToTxHash,
    swappedAt: row.swappedAt,
  };
  const now = new Date().toISOString();
  row.swapStatus = "swapped";
  row.swappedToTxHash = txHash;
  row.swappedAt = now;
  row.updatedAt = now;

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "voucher.swapped",
    resourceKind: "build_voucher",
    resourceId: row.id,
    before,
    after: {
      swapStatus: row.swapStatus,
      swappedToTxHash: row.swappedToTxHash,
      swappedAt: row.swappedAt,
    },
    reason: `Batch swap executed. Tx hash: ${txHash}`,
  });

  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/members/${row.userId}`);
  revalidatePath("/wallet");
}

/**
 * Reclaim a voucher. Used for covenant-violation resolutions,
 * dispute outcomes, or the OG-cluster probation/revoked posture.
 * Does NOT touch the underlying TokenTransaction — the historical
 * earning record stays for the audit trail. The forfeited amount
 * returns to issuance headroom (excluded from the supply-cap sum).
 */
export async function forfeitVoucher(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!id) throw new Error("Voucher id is required.");
  if (!reason) {
    throw new Error(
      "Forfeiture reason is required. This is a consequential action and needs a written justification in the audit trail.",
    );
  }

  const row = MOCK_BUILD_VOUCHERS.find((v) => v.id === id);
  if (!row) throw new Error("Voucher not found.");
  if (row.swapStatus === "swapped") {
    throw new Error(
      "Cannot forfeit a swapped voucher — the on-chain settlement is done. If reversal is needed, that's a chain-level action.",
    );
  }
  if (row.swapStatus === "forfeited") {
    throw new Error("This voucher is already forfeited.");
  }

  const before = { swapStatus: row.swapStatus };
  row.swapStatus = "forfeited";
  row.updatedAt = new Date().toISOString();

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "voucher.forfeited",
    resourceKind: "build_voucher",
    resourceId: row.id,
    before,
    after: { swapStatus: row.swapStatus },
    reason,
  });

  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/members/${row.userId}`);
  revalidatePath("/wallet");
}
