/**
 * Payout statements, read from the rows that were actually issued.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-29)
 *
 * A remittance is deliberately a snapshot, so these readers do almost
 * nothing: no joins, no recomputation, no enrichment from the live
 * split. Whatever the recipient was told at issue is what comes back.
 * The moment this file starts reconstructing a figure from current
 * state, the document stops being evidence.
 *
 * No seed fallback, same rule as every other reader here. A fabricated
 * payout statement is worse than an empty page.
 * ─────────────────────────────────────────────────────────────
 */
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { remittances } from "@/db/schema";

export interface RemittanceRow {
  id: string;
  contractId: string;
  recipientId: string;
  pool: "contributor" | "admin" | "treasury" | "liquidity_pool";
  cashAmount: number;
  sharePct: number | null;
  voucherAmount: number;
  basis: { label: string; value: string }[];
  recipientLabel: string;
  issuedAt: string;
  acknowledgedAt: string | null;
  disputedAt: string | null;
  disputeNote: string | null;
}

/** numeric() comes back as a string from node-postgres. See task #94. */
function shape(r: typeof remittances.$inferSelect): RemittanceRow {
  return {
    id: r.id,
    contractId: r.contractId,
    recipientId: r.recipientId,
    pool: r.pool,
    cashAmount: Number(r.cashAmount),
    sharePct: r.sharePct === null ? null : Number(r.sharePct),
    voucherAmount: Number(r.voucherAmount),
    basis: Array.isArray(r.basis) ? r.basis : [],
    recipientLabel: r.recipientLabel,
    issuedAt: r.issuedAt,
    acknowledgedAt: r.acknowledgedAt,
    disputedAt: r.disputedAt,
    disputeNote: r.disputeNote,
  };
}

/** "What have I been paid, and did I agree to it." */
export async function getRemittancesForRecipient(
  recipientId: string,
): Promise<RemittanceRow[]> {
  const rows = await db
    .select()
    .from(remittances)
    .where(eq(remittances.recipientId, recipientId))
    .orderBy(desc(remittances.issuedAt));
  return rows.map(shape);
}

/** The admin side: every statement on one deal, with its state. */
export async function getRemittancesForContract(
  contractId: string,
): Promise<RemittanceRow[]> {
  const rows = await db
    .select()
    .from(remittances)
    .where(eq(remittances.contractId, contractId))
    .orderBy(desc(remittances.issuedAt));
  return rows.map(shape);
}

/**
 * Open disputes across every deal, for the admin contract hub to
 * surface without the admin having to go looking deal by deal.
 */
export async function getOpenRemittanceDisputes(): Promise<RemittanceRow[]> {
  const rows = await db
    .select()
    .from(remittances)
    .where(
      and(
        isNotNull(remittances.disputedAt),
        // A dispute the recipient later withdrew by acknowledging is
        // closed. disputeRemittance clears acknowledgedAt and
        // acknowledgeRemittance clears disputedAt, so the pair is
        // never both set, but the condition is here on purpose: this
        // query is what an admin trusts to be the open list.
        isNull(remittances.acknowledgedAt),
      ),
    )
    .orderBy(desc(remittances.issuedAt));
  return rows.map(shape);
}
