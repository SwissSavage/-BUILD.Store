/**
 * Contract Reserve Pool sandbox stores — ledger of credits/debits
 * per contract + snapshotted triangulated composites.
 *
 * PRODUCTION SWAP:
 *   - Replace MOCK_RESERVE_POOL_LEDGER with a Drizzle read against
 *     `reserve_pool_ledger` — balance derives from SUM(amount) per
 *     projectId.
 *   - Replace MOCK_TRIANGULATED_COMPOSITES with a read against
 *     `triangulated_composites` — one row per contributor per
 *     contract close.
 *   - Ledger is append-only in production too — corrections happen
 *     via offsetting entries, never edits.
 */
import type {
  ReservePoolLedgerEntry,
  TriangulatedComposite,
} from "@/lib/types";

export const MOCK_RESERVE_POOL_LEDGER: ReservePoolLedgerEntry[] = [
  // p_004 (URL Media editorial series) — clean settlement, all-5-star
  // client + composite. Full reserve released, nothing residual.
  {
    id: "rpl_p004_credit_001",
    projectId: "p_004",
    amount: "2000.00",
    direction: "credit",
    creditReason: "invoice_collection",
    debitReason: null,
    recipientId: null,
    actorUserId: "u_jamar",
    rationale:
      "Top − bottom delta on collection: Aliza's $2K bonus range credited to reserve at invoice paid.",
    createdAt: "2026-02-20T00:00:00Z",
  },
  {
    id: "rpl_p004_debit_001",
    projectId: "p_004",
    amount: "-2000.00",
    direction: "debit",
    creditReason: null,
    debitReason: "bonus_release",
    recipientId: "u_aliza",
    actorUserId: "u_jamar",
    rationale:
      "Composite cleared: admin 5, peer 5, client 5 → weighted 5.0 → full bonus release.",
    createdAt: "2026-02-21T14:00:00Z",
  },
];

export const MOCK_TRIANGULATED_COMPOSITES: TriangulatedComposite[] = [
  // Snapshot of Aliza's composite on p_004 at bonus decision time.
  {
    id: "tc_p004_aliza_001",
    projectId: "p_004",
    contributorUserId: "u_aliza",
    adminRating: 5,
    peerRating: 5,
    clientRating: 5,
    effectiveWeights: { admin: 0.4, peer: 0.4, client: 0.2 },
    weightedComposite: 5.0,
    bonusReleaseFraction: 1.0,
    computedAt: "2026-02-21T14:00:00Z",
  },
];

/** Sum reserve pool ledger for a project — positive = current balance. */
export function reservePoolBalance(projectId: string): number {
  return MOCK_RESERVE_POOL_LEDGER.filter((e) => e.projectId === projectId).reduce(
    (sum, e) => sum + Number(e.amount),
    0,
  );
}

/** Ledger entries for a project, freshest last (append-only order). */
export function reservePoolLedgerForProject(
  projectId: string,
): ReservePoolLedgerEntry[] {
  return MOCK_RESERVE_POOL_LEDGER.filter((e) => e.projectId === projectId).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );
}

/** Triangulated composite for a contributor on a specific contract. */
export function compositeForContributor(
  projectId: string,
  contributorUserId: string,
): TriangulatedComposite | null {
  return (
    MOCK_TRIANGULATED_COMPOSITES.find(
      (c) =>
        c.projectId === projectId && c.contributorUserId === contributorUserId,
    ) ?? null
  );
}

/** Every contributor's composite on a project. */
export function compositesForProject(
  projectId: string,
): TriangulatedComposite[] {
  return MOCK_TRIANGULATED_COMPOSITES.filter((c) => c.projectId === projectId);
}
