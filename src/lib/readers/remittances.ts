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
import { remittances, revenueSplits } from "@/db/schema";
import type { PayoutStatus } from "@/lib/types";

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
  /**
   * Payment state of the underlying split. The statement issues at
   * settle saying what is OWED; for a record-mode rail the money has
   * usually not moved yet. Confirm does not unlock until this is sent,
   * so confirming always means both "the amount is right" and "I
   * received it". See #113.
   */
  payoutStatus: PayoutStatus | null;
  payoutSentAt: string | null;
  /** What it cost to send. Null means there was no fee. */
  payoutFee: number | null;
  /** Who paid it. The deduction follows the payer. */
  payoutFeeBorneBy: "recipient" | "treasury" | null;
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
    payoutStatus: null,
    payoutSentAt: null,
    payoutFee: null,
    payoutFeeBorneBy: null,
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

  // The payment state is live while the basis stays frozen. A
  // statement is still evidence of what somebody was told at the time;
  // only "has it been paid yet" moves.
  const splits = await db
    .select({
      contractId: revenueSplits.contractId,
      recipientId: revenueSplits.recipientId,
      pool: revenueSplits.pool,
      payoutStatus: revenueSplits.payoutStatus,
      payoutSentAt: revenueSplits.payoutSentAt,
      payoutFee: revenueSplits.payoutFee,
      payoutFeeBorneBy: revenueSplits.payoutFeeBorneBy,
    })
    .from(revenueSplits)
    .where(eq(revenueSplits.recipientId, recipientId));

  const key = (c: string | null, p: string) => `${c ?? ""}:${p}`;
  const byKey = new Map(
    splits.map((sp) => [key(sp.contractId, sp.pool), sp]),
  );

  return rows.map((r) => {
    const base = shape(r);
    const sp = byKey.get(key(r.contractId, r.pool));
    return {
      ...base,
      payoutStatus: (sp?.payoutStatus as PayoutStatus) ?? null,
      payoutSentAt: sp?.payoutSentAt ?? null,
      payoutFee: sp?.payoutFee === null || sp?.payoutFee === undefined
        ? null
        : Number(sp.payoutFee),
      payoutFeeBorneBy: sp?.payoutFeeBorneBy ?? null,
    };
  });
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
