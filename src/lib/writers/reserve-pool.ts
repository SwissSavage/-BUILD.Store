/**
 * Contract Reserve Pool + Engagement Recovery Pool writers.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-30)
 *
 * The reserve ledger, the triangulated composites, and the recovery
 * pool balances were all in-memory arrays.
 *
 * That is the money path. `creditReserveOnInvoiceCollection` funds the
 * bonus pool when a client pays. `executeGraduatedBonusRelease` reads
 * that balance to decide what each contributor is owed, snapshots the
 * ratings it based the decision on, and routes the residual to the
 * recovery pool. None of it survived a deploy, which means the
 * evidence for why a contributor received the amount they did did not
 * survive either.
 *
 * The composites in particular are the record of a decision. Their
 * whole purpose is to freeze the ratings at release time so the
 * decision stays auditable after the underlying ratings move. A frozen
 * snapshot that evaporates is worse than no snapshot, because the
 * surrounding code is written as though the evidence exists.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  engagementRecoveryPools,
  reservePoolLedger,
  triangulatedComposites,
} from "@/db/schema";
import type {
  ReserveCreditReason,
  ReserveDebitReason,
  ReservePoolLedgerEntry,
  TriangulatedComposite,
} from "@/lib/types";

export interface AppendReserveEntryInput {
  projectId: string;
  amount: number;
  direction: "credit" | "debit";
  creditReason: ReserveCreditReason | null;
  debitReason: ReserveDebitReason | null;
  recipientId: string | null;
  actorUserId: string | null;
  rationale: string | null;
}

/**
 * Append one credit or debit to the reserve ledger.
 *
 * The ledger is append-only: a correction is a new opposing entry, not
 * an edit. Balance is always the sum of entries, never a stored field,
 * so there is no cached total that can drift away from its own history.
 */
export async function appendReserveEntry(
  input: AppendReserveEntryInput,
): Promise<ReservePoolLedgerEntry> {
  const signedAmount =
    input.direction === "credit"
      ? Math.abs(input.amount)
      : -Math.abs(input.amount);

  const row: ReservePoolLedgerEntry = {
    id: `rpl_${input.direction === "credit" ? "c" : "d"}_${randomUUID()}`,
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

  await db.insert(reservePoolLedger).values({
    id: row.id,
    projectId: row.projectId,
    amount: row.amount,
    direction: row.direction,
    creditReason: row.creditReason,
    debitReason: row.debitReason,
    recipientId: row.recipientId,
    actorUserId: row.actorUserId,
    rationale: row.rationale,
    createdAt: row.createdAt,
  });

  return row;
}

/**
 * Persist a frozen triangulated composite.
 *
 * Upsert on (project, contributor). Recomputing a composite for a
 * contributor replaces the previous freeze rather than appending a
 * second row — two rows for one pair have no defined winner, and the
 * bonus amount would then depend on row order.
 */
export async function insertComposite(
  row: Omit<TriangulatedComposite, "id"> & { id?: string },
): Promise<TriangulatedComposite> {
  const full: TriangulatedComposite = {
    ...row,
    id: row.id ?? `tc_${randomUUID()}`,
  };

  // numeric() columns round-trip as strings in Drizzle. The domain
  // type carries numbers, so the conversion happens here rather than
  // leaking string ratings into the release math.
  const num = (v: number | null) => (v === null ? null : String(v));

  const values = {
    id: full.id,
    projectId: full.projectId,
    contributorUserId: full.contributorUserId,
    adminRating: num(full.adminRating),
    peerRating: num(full.peerRating),
    clientRating: num(full.clientRating),
    effectiveWeights: full.effectiveWeights,
    weightedComposite: String(full.weightedComposite),
    bonusReleaseFraction: String(full.bonusReleaseFraction),
    computedAt: full.computedAt,
  };

  await db
    .insert(triangulatedComposites)
    .values(values)
    .onConflictDoUpdate({
      target: [
        triangulatedComposites.projectId,
        triangulatedComposites.contributorUserId,
      ],
      set: {
        adminRating: values.adminRating,
        peerRating: values.peerRating,
        clientRating: values.clientRating,
        effectiveWeights: values.effectiveWeights,
        weightedComposite: values.weightedComposite,
        bonusReleaseFraction: values.bonusReleaseFraction,
        computedAt: values.computedAt,
      },
    });

  return full;
}

/**
 * Credit the Engagement Recovery Pool for a project, creating it on
 * first use.
 *
 * Upsert plus a SQL-side increment rather than read-modify-write: two
 * residuals routed to the same project in quick succession would
 * otherwise both read the same starting balance and one would
 * overwrite the other, quietly losing money that had already left the
 * reserve ledger.
 */
export async function creditRecoveryPool(
  projectId: string,
  amountUsd: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .insert(engagementRecoveryPools)
    .values({
      id: `erp_${randomUUID()}`,
      projectId,
      balanceUsd: Number(amountUsd).toFixed(2),
      drawnUsd: "0.00",
      status: "open",
      createdAt: now,
      closedAt: null,
    })
    .onConflictDoUpdate({
      target: engagementRecoveryPools.projectId,
      set: {
        balanceUsd: sql`${engagementRecoveryPools.balanceUsd} + ${amountUsd}::numeric`,
      },
    });
}

/** Mark a recovery pool closed. */
export async function closeRecoveryPool(projectId: string): Promise<void> {
  await db
    .update(engagementRecoveryPools)
    .set({ status: "closed", closedAt: new Date().toISOString() })
    .where(
      and(
        eq(engagementRecoveryPools.projectId, projectId),
        eq(engagementRecoveryPools.status, "open"),
      ),
    );
}
