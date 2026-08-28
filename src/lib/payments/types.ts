/**
 * Task #63 — Payments hub shared types.
 *
 * The cooperative moves money in two directions and the rails are
 * NOT symmetric:
 *
 *   INBOUND  (client → cooperative)  — invoices, orders, donations.
 *     Already modeled by `PaymentMethod` in types.ts (Mercury ACH/wire,
 *     Stripe card, check, other). This module does not replace that.
 *
 *   OUTBOUND (cooperative → contributor) — payouts against revenue
 *     splits. THIS is what the payments hub adds. Before #63 the only
 *     outbound rail was Stripe Connect Express, hardcoded onto
 *     `users.stripeAccountId`. A contributor without a Stripe account
 *     simply could not be paid.
 *
 * The hub generalizes outbound into a registry: a contributor may
 * register several payout methods, marks one default, and the
 * settlement engine dispatches through whichever rail that method
 * names.
 *
 * ─────────────────────────────────────────────────────────────
 * RAIL REALITY CHECK — read before wiring any driver.
 *
 * These rails are not equivalent in what they can automate. Getting
 * this wrong means building a UI that promises something the network
 * cannot deliver.
 *
 *   stripe_connect — Full API disbursement. `transfers.create` to a
 *     connected `acct_*`. KYC handled by Stripe. This is the mature
 *     path and stays the recommended default.
 *
 *   PayPal and Venmo are deliberately NOT supported. Removed
 *     2026-08-28 at Jamar's direction — the cooperative does not want
 *     to route contributor earnings through PayPal's service.
 *     Venmo went with it out of necessity, not preference: Venmo is
 *     PayPal-owned and has no standalone payout API. The only way to
 *     disburse to a Venmo handle is the PayPal Payouts endpoint with
 *     `recipient_wallet: "VENMO"`, which requires a PayPal business
 *     account. No PayPal account means no Venmo rail. If FM ever
 *     wants Venmo back, it necessarily comes with a PayPal
 *     relationship attached.
 *
 *   zelle — NO PUBLIC DISBURSEMENT API. Zelle moves money bank-to-bank
 *     through member financial institutions; there is no third-party
 *     API a platform can call to push funds. Any "Zelle integration"
 *     that claims otherwise is either a bank-specific treasury product
 *     (Mercury does not currently expose one) or a scraper.
 *     → Modeled here as a MANUAL rail: the hub records the intent,
 *       an admin sends it by hand from the cooperative's bank UI, and
 *       marks it dispatched with a reference. Honest, auditable, and
 *       does not pretend to automation that does not exist.
 *
 *   plaid_ach — Plaid is NOT a payment network. It is bank-account
 *     verification plus (via Plaid Transfer) an ACH origination
 *     product. Used here for two distinct jobs:
 *       1. Verify a contributor's bank account (`/link/token/create`
 *          → Auth product) so we hold a verified account/routing pair.
 *       2. Optionally originate the ACH debit/credit via Plaid
 *          Transfer, which requires separate underwriting.
 *     If Transfer underwriting is not in place, the verified account
 *     still feeds a Mercury-originated ACH — which is how most of
 *     this will actually run at FM's volume.
 *
 *   crypto_wallet — USDC (or other stablecoin) to the address already
 *     captured by the wallet connector on /wallet. Settlement is
 *     on-chain; there is no chargeback and no reversal. Gate this
 *     behind an explicit contributor acknowledgment.
 *
 *   manual_check — Escape hatch. Admin cuts a check, records the
 *     number. Same shape as zelle: intent recorded, human dispatches.
 * ─────────────────────────────────────────────────────────────
 */

/** Outbound payout rails the hub can dispatch through. */
export type PayoutRail =
  | "stripe_connect"
  | "zelle"
  | "plaid_ach"
  | "crypto_wallet"
  | "manual_check";

export const PAYOUT_RAIL_LABELS: Record<PayoutRail, string> = {
  stripe_connect: "Stripe Connect",
  zelle: "Zelle",
  plaid_ach: "Bank account (ACH)",
  crypto_wallet: "Crypto wallet (USDC)",
  manual_check: "Check",
};

/**
 * How a rail actually moves money. Drives UI copy, admin queue
 * behavior, and whether the settlement engine can fire automatically.
 *
 *   api      — driver calls the network, funds move without a human.
 *   assisted — driver prepares + validates, but a human confirms the
 *              send in an external UI (Zelle, check).
 */
export type RailDispatchMode = "api" | "assisted";

export const RAIL_DISPATCH_MODE: Record<PayoutRail, RailDispatchMode> = {
  stripe_connect: "api",
  zelle: "assisted",
  plaid_ach: "api",
  crypto_wallet: "api",
  manual_check: "assisted",
};

/**
 * What a rail needs from the contributor before it can be used.
 * Rendered as the "add method" form and validated server-side.
 *
 * NOTE: we never persist raw bank account or routing numbers. The
 * plaid_ach rail stores Plaid's `access_token` + `account_id` pair
 * and nothing else. PCI/NACHA scope stays with the processor.
 */
export interface RailCredentialSpec {
  rail: PayoutRail;
  /** Field keys the contributor fills in. */
  fields: Array<{
    key: string;
    label: string;
    /** Input hint for the form. */
    type: "text" | "email" | "tel" | "wallet_address";
    placeholder: string;
    required: boolean;
    /** Shown under the field. Use for constraints + honest caveats. */
    help?: string;
  }>;
  /** Copy shown above the form. Set expectations about the rail here. */
  notice?: string;
}

/**
 * A contributor's registered payout method. One row per rail the
 * contributor has set up; `isDefault` picks the settlement target.
 *
 * `externalRef` is the rail's own identifier for this destination:
 *   stripe_connect → acct_1Q9...
 *   zelle          → email or phone the contributor receives at
 *   plaid_ach      → plaid account_id (access_token held separately)
 *   crypto_wallet  → 0x address
 *   manual_check   → mailing address key
 *
 * `verifiedAt` is null until the rail confirms the destination is
 * real and reachable. Settlement refuses unverified methods.
 */
export interface PayoutMethod {
  id: string;
  userId: string;
  rail: PayoutRail;
  /** Contributor-facing label, e.g. "Chase checking" or "Main PayPal". */
  displayLabel: string;
  externalRef: string;
  /** Non-sensitive extras (venmo phone last-4, wallet chain id, etc.). */
  metadata: Record<string, string> | null;
  isDefault: boolean;
  verifiedAt: string | null;
  /** Set when a rail rejects the destination; surfaced to the user. */
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchPayoutInput {
  method: PayoutMethod;
  /** USD amount. Rails that need minor units convert internally. */
  amountUsd: number;
  /** revenue_splits.id — carried through for reconciliation. */
  splitId: string;
  /** Shown on the recipient's statement where the rail supports it. */
  memo: string;
  /**
   * Idempotency key. Settlement may retry; rails must not double-send.
   * Convention: `payout_<splitId>_<attempt>`.
   */
  idempotencyKey: string;
}

export interface DispatchPayoutResult {
  rail: PayoutRail;
  mode: RailDispatchMode;
  /**
   * "sent"      — funds are moving, rail confirmed.
   * "queued"    — rail accepted, settles async (ACH, most crypto).
   * "awaiting_manual" — assisted rail; recorded, human must send.
   */
  status: "sent" | "queued" | "awaiting_manual";
  /** Rail's transaction id. Null for assisted rails until confirmed. */
  externalTxId: string | null;
  /** Fee the rail took, if it reports one. USD. */
  feeUsd: number | null;
  /** Human-readable detail for the admin queue + audit log. */
  detail: string;
  dispatchedAt: string;
}

export interface RailHealth {
  rail: PayoutRail;
  status: "ok" | "degraded" | "unhealthy" | "not_configured";
  mode: RailDispatchMode;
  detail: string;
  /** Which env vars this rail needs, and whether each is present. */
  envSummary: Record<string, boolean>;
}

/** Thrown by rail drivers. Carries the rail so the router can log it. */
export class PayoutError extends Error {
  constructor(
    public rail: PayoutRail,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "PayoutError";
  }
}
