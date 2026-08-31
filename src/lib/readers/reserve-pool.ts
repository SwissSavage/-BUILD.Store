/**
 * Reserve pool, composite, and recovery pool reads.
 *
 * Drop-in async replacements for the helpers that used to live in
 * `mock-data/reserve-pool.ts` and `mock-data/engagement-recovery-pools.ts`,
 * with the same names and shapes so call sites only gain an `await`.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  engagementRecoveryPools,
  reservePoolLedger,
  triangulatedComposites,
} from "@/db/schema";
import type {
  EngagementRecoveryPool,
  ReservePoolLedgerEntry,
  TriangulatedComposite,
} from "@/lib/types";

/**
 * Net reserve balance for a project.
 *
 * Summed in SQL. Credits are positive and debits negative, so the
 * balance is always the sum of the ledger's own history — there is no
 * stored total that can drift out of agreement with the entries
 * behind it.
 */
export async function reservePoolBalance(projectId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${reservePoolLedger.amount}), 0)` })
    .from(reservePoolLedger)
    .where(eq(reservePoolLedger.projectId, projectId));
  return Number(row?.total ?? 0);
}

/** Ledger entries for a project, freshest last (append-only order). */
export async function reservePoolLedgerForProject(
  projectId: string,
): Promise<ReservePoolLedgerEntry[]> {
  const rows = await db
    .select()
    .from(reservePoolLedger)
    .where(eq(reservePoolLedger.projectId, projectId))
    .orderBy(asc(reservePoolLedger.createdAt));
  return rows as unknown as ReservePoolLedgerEntry[];
}

/** Every ledger entry. Admin reserve console. */
export async function allReserveEntries(): Promise<ReservePoolLedgerEntry[]> {
  const rows = await db
    .select()
    .from(reservePoolLedger)
    .orderBy(asc(reservePoolLedger.createdAt));
  return rows as unknown as ReservePoolLedgerEntry[];
}

/**
 * Has this project already been credited for a given reason? Backs the
 * idempotency guard on invoice-collection funding.
 */
export async function hasReserveCredit(
  projectId: string,
  creditReason: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: reservePoolLedger.id })
    .from(reservePoolLedger)
    .where(
      and(
        eq(reservePoolLedger.projectId, projectId),
        eq(reservePoolLedger.direction, "credit"),
        eq(reservePoolLedger.creditReason, creditReason as "invoice_collection"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** The frozen composite for one contributor on one project. */
export async function getComposite(
  projectId: string,
  contributorUserId: string,
): Promise<TriangulatedComposite | null> {
  const rows = await db
    .select()
    .from(triangulatedComposites)
    .where(
      and(
        eq(triangulatedComposites.projectId, projectId),
        eq(triangulatedComposites.contributorUserId, contributorUserId),
      ),
    )
    .limit(1);
  return (rows[0] as unknown as TriangulatedComposite) ?? null;
}

/** Every composite frozen for a project. */
export async function getCompositesForProject(
  projectId: string,
): Promise<TriangulatedComposite[]> {
  const rows = await db
    .select()
    .from(triangulatedComposites)
    .where(eq(triangulatedComposites.projectId, projectId));
  return rows as unknown as TriangulatedComposite[];
}

/** The recovery pool for a project, or null if none has been opened. */
export async function poolForProject(
  projectId: string,
): Promise<EngagementRecoveryPool | null> {
  const rows = await db
    .select()
    .from(engagementRecoveryPools)
    .where(eq(engagementRecoveryPools.projectId, projectId))
    .limit(1);
  return (rows[0] as unknown as EngagementRecoveryPool) ?? null;
}

/** Every recovery pool. Admin pools console. */
export async function allRecoveryPools(): Promise<EngagementRecoveryPool[]> {
  const rows = await db.select().from(engagementRecoveryPools);
  return rows as unknown as EngagementRecoveryPool[];
}
