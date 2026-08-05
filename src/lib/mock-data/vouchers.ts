/**
 * $BUILD voucher ledger — the sandbox mirror of what will live in
 * the Postgres `build_vouchers` table.
 *
 * One row per earning event's redeemable claim on real $BUILD.
 * Coexists with MOCK_TRANSACTIONS — TokenTransaction is the log of
 * what was earned, BuildVoucher is the ledger of what is claimable
 * (accounting for the 10M supply cap, swap lifecycle, forfeiture).
 * See the BuildVoucher docblock in src/lib/types.ts for the full
 * architectural rationale.
 *
 * PRODUCTION SWAP:
 *   - Replace this in-memory array with a Drizzle read against the
 *     `build_vouchers` table (see src/db/schema.ts).
 *   - Amounts are strings because Postgres numeric(18,8) round-trips
 *     through Drizzle as a string. Matches the TokenTransaction
 *     convention.
 *   - Seed rows below hit every swap-status band so the admin
 *     ledger, member wallet, and supply-cap arithmetic all have
 *     something to render + validate against.
 */
import type { BuildVoucher } from "@/lib/types";

export const MOCK_BUILD_VOUCHERS: BuildVoucher[] = [
  // Founder equity — unswapped project_completion baseline.
  {
    id: "voucher_jamar_founder_001",
    userId: "u_jamar",
    amount: "125000.00000000",
    sourceType: "project_completion",
    sourceRefId: null,
    swapStatus: "unswapped",
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: "2026-05-01T09:00:00Z",
    notes:
      "Founder cumulative project completion, pre-registry. Backfilled to seed the ledger with a realistic founder position.",
    issuedByUserId: "u_jamar",
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
  },
  // Referral — unswapped, mid-size.
  {
    id: "voucher_bayu_referral_001",
    userId: "u_bayu",
    amount: "18500.00000000",
    sourceType: "referral",
    sourceRefId: null,
    swapStatus: "unswapped",
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: "2026-07-05T10:00:00Z",
    notes: "Client referral into the URL Media engagement.",
    issuedByUserId: "u_jamar",
    createdAt: "2026-07-05T10:00:00Z",
    updatedAt: "2026-07-05T10:00:00Z",
  },
  // Collaboration — unswapped, small amount, illustrates the
  // secondary source-type.
  {
    id: "voucher_bbg_collab_001",
    userId: "u_bbg",
    amount: "8200.00000000",
    sourceType: "collaboration",
    sourceRefId: null,
    swapStatus: "unswapped",
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: "2026-06-20T14:00:00Z",
    notes: null,
    issuedByUserId: "u_jamar",
    createdAt: "2026-06-20T14:00:00Z",
    updatedAt: "2026-06-20T14:00:00Z",
  },
  // Pending swap — mid-lifecycle example so the admin batch-swap
  // surface has something to act on.
  {
    id: "voucher_sunny_project_001",
    userId: "u_sunny",
    amount: "22000.00000000",
    sourceType: "project_completion",
    sourceRefId: null,
    swapStatus: "pending_swap",
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: "2026-06-10T11:00:00Z",
    notes: "Queued for the next batch-swap window.",
    issuedByUserId: "u_jamar",
    createdAt: "2026-06-10T11:00:00Z",
    updatedAt: "2026-07-25T12:00:00Z",
  },
  // Swapped — end-state example with a placeholder tx hash so the
  // admin surface + wallet can render the "settled" state.
  {
    id: "voucher_michael_project_001",
    userId: "u_michael",
    amount: "14500.00000000",
    sourceType: "project_completion",
    sourceRefId: null,
    swapStatus: "swapped",
    swappedToTxHash:
      "0xPLACEHOLDER_swap_batch_2026_05_bee1234567890abcdef1234567890abcdef",
    swappedAt: "2026-05-30T16:00:00Z",
    issuedAt: "2026-05-15T13:00:00Z",
    notes: "Settled in the May batch. Placeholder tx hash for sandbox.",
    issuedByUserId: "u_jamar",
    createdAt: "2026-05-15T13:00:00Z",
    updatedAt: "2026-05-30T16:00:00Z",
  },
  // Forfeited — Chibu-cluster example. Original TokenTransaction
  // (if one existed) would stay for the historical record; the
  // voucher is no longer claimable. Ties into the probation/revoked
  // posture logged in key-people.md.
  {
    id: "voucher_chibu_forfeit_001",
    userId: "u_chibu",
    amount: "35000.00000000",
    sourceType: "project_completion",
    sourceRefId: null,
    swapStatus: "forfeited",
    swappedToTxHash: null,
    swappedAt: null,
    issuedAt: "2025-11-01T09:00:00Z",
    notes:
      "Forfeited under the probation/revoked posture — standing revoked, claim withdrawn. Reinstatable if the dispute resolves cleanly.",
    issuedByUserId: "u_jamar",
    createdAt: "2025-11-01T09:00:00Z",
    updatedAt: "2026-07-15T18:00:00Z",
  },
];

/** Every voucher a user holds, freshest issue first. */
export function vouchersForUser(userId: string): BuildVoucher[] {
  return MOCK_BUILD_VOUCHERS.filter((v) => v.userId === userId).sort((a, b) =>
    b.issuedAt.localeCompare(a.issuedAt),
  );
}

/**
 * Sum of a user's voucher amounts, filtered by swap status.
 * Returns a plain number for display — safe because 10M cap * 1e8
 * fits comfortably under Number.MAX_SAFE_INTEGER.
 */
export function voucherBalanceForUser(
  userId: string,
  statuses: readonly BuildVoucher["swapStatus"][] = ["unswapped", "pending_swap"],
): number {
  return MOCK_BUILD_VOUCHERS.filter(
    (v) => v.userId === userId && statuses.includes(v.swapStatus),
  ).reduce((sum, v) => sum + Number(v.amount), 0);
}
