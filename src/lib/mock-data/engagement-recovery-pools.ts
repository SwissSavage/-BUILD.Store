/**
 * Engagement Recovery Pool — destination ledger for bonus reclaimed when
 * the bonus-release gate fails at settlement.
 *
 * Per locked policy in `future-modern.md` "Compensation structure" section:
 * "we billed the upper end, this person didn't earn their pay, so they
 * got the minimum and we used the extra to hire someone else." This
 * store captures the extra.
 *
 * Scoped per-engagement (one pool per Project). Drawable to fund
 * corrective hires for the same client. Residue at engagement close
 * folds back to treasury.
 *
 * REPLACE WITH: Drizzle `engagement_recovery_pools` table (one row per
 * project) + `engagement_recovery_draws` (append-only ledger of draws
 * against the pool).
 */
import type { EngagementRecoveryPool } from "@/lib/types";

export const MOCK_RECOVERY_POOLS: EngagementRecoveryPool[] = [];

export function poolForProject(projectId: string): EngagementRecoveryPool | null {
  return MOCK_RECOVERY_POOLS.find((p) => p.projectId === projectId) ?? null;
}

export function ensurePoolForProject(projectId: string): EngagementRecoveryPool {
  const existing = poolForProject(projectId);
  if (existing) return existing;
  const fresh: EngagementRecoveryPool = {
    id: `erp_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    projectId,
    balanceUsd: "0.00",
    drawnUsd: "0.00",
    status: "open",
    createdAt: new Date().toISOString(),
    closedAt: null,
  };
  MOCK_RECOVERY_POOLS.push(fresh);
  return fresh;
}

export function creditPool(projectId: string, amountUsd: string): EngagementRecoveryPool {
  const pool = ensurePoolForProject(projectId);
  const next = (Number(pool.balanceUsd) + Number(amountUsd)).toFixed(2);
  pool.balanceUsd = next;
  return pool;
}
