/**
 * Payment processing fee calculator.
 *
 * The cooperative's default rail is Mercury (ACH/wire — no per-transaction
 * fee). When a contract opts into accepting credit cards, Stripe's fee comes
 * out of the gross we charge the client. To keep the cooperative whole, we
 * gross up the subtotal so the *net* received equals what we would have
 * charged on Mercury.
 *
 * Standard Stripe US rates (cards present, 2026): 2.9% + $0.30 per
 * transaction. Reference: https://stripe.com/pricing — keep this in sync
 * with whatever the dashboard reports for the connected account.
 *
 * Math:
 *   net = gross * (1 - rate) - flat
 *   solving for gross:
 *   gross = (net + flat) / (1 - rate)
 *   processingFee = gross - net
 *
 * The line-item generator is the *only* surface allowed to write
 * `isProcessingFee=true` rows on an Invoice — admin editors should treat
 * the row as locked and re-run the calculator on subtotal change.
 *
 * REPLACE WITH: read live rate from the connected Stripe account once we
 * wire real Connect (rates differ for international cards, AmEx, etc.).
 */
import type { InvoiceLineItem } from "@/lib/types";

/** Stripe US standard rate for card present / Connect Express. */
export const STRIPE_RATE = 0.029;
export const STRIPE_FLAT = 0.3;

/**
 * Round to cents using banker's-style half-up so display matches the
 * numeric(12,2) column we'll persist to.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface GrossUpResult {
  /** What the client pays (subtotal + processingFee). */
  gross: number;
  /** Markup added to keep the cooperative whole on the original subtotal. */
  processingFee: number;
}

/**
 * Gross up a subtotal so the cooperative nets the original amount after
 * Stripe takes its cut. Returns numbers (callers serialize to numeric(12,2)
 * strings for storage).
 *
 * @param subtotal Original cooperative-net amount (USD).
 * @param rate Percentage rate (default 2.9%).
 * @param flat Per-transaction flat fee (default $0.30).
 */
export function grossUpForCard(
  subtotal: number,
  rate: number = STRIPE_RATE,
  flat: number = STRIPE_FLAT,
): GrossUpResult {
  if (subtotal <= 0) return { gross: 0, processingFee: 0 };
  const gross = round2((subtotal + flat) / (1 - rate));
  const processingFee = round2(gross - subtotal);
  return { gross, processingFee };
}

/**
 * Build the locked processing-fee line item for an invoice opting into
 * card payment. Caller is responsible for replacing any prior
 * `isProcessingFee` row before inserting this.
 */
export function buildProcessingFeeLineItem(
  subtotal: number,
  opts?: { id?: string; description?: string },
): InvoiceLineItem {
  const { processingFee } = grossUpForCard(subtotal);
  return {
    id: opts?.id ?? `li_processing_fee_${Date.now()}`,
    description:
      opts?.description ??
      `Payment processing fee (${(STRIPE_RATE * 100).toFixed(1)}% + $${STRIPE_FLAT.toFixed(2)})`,
    amount: processingFee.toFixed(2),
    isProcessingFee: true,
  };
}

/**
 * Sum non-processing-fee line items. Used by admin editor and by the
 * settle/AR pages to show "subtotal" cleanly.
 */
export function sumSubtotal(lineItems: InvoiceLineItem[]): number {
  return lineItems
    .filter((li) => !li.isProcessingFee)
    .reduce((acc, li) => acc + Number(li.amount), 0);
}

/** Sum of processing-fee rows (0 unless invoice accepts card). */
export function sumProcessingFee(lineItems: InvoiceLineItem[]): number {
  return lineItems
    .filter((li) => li.isProcessingFee)
    .reduce((acc, li) => acc + Number(li.amount), 0);
}

/** Convenience: subtotal + processingFee for the grand total. */
export function sumTotal(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((acc, li) => acc + Number(li.amount), 0);
}
