/**
 * How money actually leaves, per method.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03) — the full model is task #113.
 *
 * Jamar: "there needs to be a toggle for when it's active routing vs
 * record keeping... but everything downstream of the selected method
 * needs to follow a distinct protocol ideal for that methodology."
 *
 * Settlement assumed it initiates every payout. It does not. Found has
 * no API, so a human sends the money and the app records it after the
 * fact, usually days later. With that distinction missing from the
 * model, the engine asserted things it never did: splits marked
 * `failed` for people who are simply not paid through Stripe, and
 * house pool rows marked `sent` with an invented transfer id.
 *
 * ROUTING vs RECORD
 *   routing  the app initiates through an API. The API response IS the
 *            evidence, so the transition is self-evidencing, and
 *            `failed` means something genuinely broke.
 *   record   the money moves elsewhere. The app must not attempt a
 *            transfer, must not report failure for an attempt it never
 *            made, and must demand the reference, the real date and
 *            the payout document, because it did not witness the
 *            event. This is the rule markReceived broke when it
 *            invented `merc_${uuid}`.
 *
 * WHY METHODS ARE CONFIG, NOT A DATABASE ENUM
 *
 * payout_methods.rail is a pg enum: stripe_connect, zelle, plaid_ach,
 * crypto_wallet, manual_check. Adding Wise or Whop for Bayu would mean
 * a migration every time. The set of methods is configuration, same
 * lesson as REMIT_ACCOUNTS: the split row stores a method id, and the
 * definition carries the behaviour.
 *
 * WHO BEARS THE FEE (decided by Jamar, 2026-11-03)
 *
 * Anticipated digital-payment fees are priced into the contract
 * upfront, so the client covers them — the same move the card gross-up
 * already makes on the inbound side.
 *
 * Backend fees fall on whoever requires the method. Treasury only when
 * no one can be assigned.
 *
 * This includes geography, deliberately. Jamar: "we know Bayu is
 * outside the US, so he bills accordingly. He's already making a
 * premium by operating in our market, which is why he does." Someone
 * pricing their work for this market has already priced in the cost of
 * being paid from it, so the rate carries the fee and the split does
 * not need to subsidise it. An earlier draft of this note argued that
 * a sole eligible rail means the method was required OF someone rather
 * than BY them; that is answered by the rate, not by the pool.
 *
 * The fee is recorded on the split either way, because it is a
 * deductible business expense for whoever paid it and a deduction
 * needs a number and a date. Confirm with the accountant before
 * treating that as settled: it is a tax question, not a code one.
 *
 * ELIGIBILITY IS PART OF THE DEFINITION
 *
 * Found and Zelle are US-domestic. Offering a rail that cannot reach
 * someone is how a payout sits unclaimed for three weeks. A method
 * declares who it can reach, and the per-recipient list is filtered.
 * ─────────────────────────────────────────────────────────────
 */

export type PayoutMode = "routing" | "record";

export interface PayoutMethodDefinition {
  /** Stored on revenue_splits.payout_method_id. Discloses nothing. */
  id: string;
  label: string;
  mode: PayoutMode;
  /**
   * Countries this method can reach, as ISO-3166-1 alpha-2, or "any".
   * Found and Zelle are US-only; this is what stops the picker
   * offering Bayu a rail that cannot pay him.
   */
  reaches: string[] | "any";
  /** Shown under the picker so the operator knows what happens next. */
  note?: string;
  /**
   * Whether sending on this rail can cost anything.
   *
   * Jamar: "that shouldn't show up at all until they select a payout
   * method that incurs fees." The confirm form asked for a fee and a
   * payer on every payout, including domestic Found, which is free.
   * A field that cannot have a non-empty answer is a field that
   * teaches people to ignore the form.
   *
   * False is the honest default for the rails we run: domestic ACH
   * and a posted check cost nothing to send. Wires, cross-border and
   * card-funded transfers do, which is why this is per-method rather
   * than a global setting.
   */
  incursFee: boolean;
}

/**
 * The methods that exist today. Found is the only live one, and it is
 * deliberately `record`: it has no API, so every Found payout is
 * recorded retroactively and always will be.
 *
 * Stripe Connect stays defined because the dispatch path still exists
 * for recipients who opt in, and because `routing` needs at least one
 * real example for the distinction to mean anything.
 *
 * REPLACE WITH: a configured list read from env, the way
 * REMIT_ACCOUNTS is, once there is a second live method to justify the
 * indirection. Hardcoding one honest list beats an empty config that
 * silently offers nothing.
 */
export const PAYOUT_METHODS: PayoutMethodDefinition[] = [
  {
    id: "found_ach",
    label: "Found (ACH)",
    mode: "record",
    reaches: ["US"],
    // Domestic Found ACH is free to send.
    incursFee: false,
    note: "Found texts and emails the recipient, who claims it. Record the date, reference and payout record once it is sent.",
  },
  {
    id: "manual_check",
    label: "Check",
    mode: "record",
    reaches: ["US"],
    // A stamp is not a transfer fee and is not worth a column.
    incursFee: false,
    note: "Record the check number and the date it was written.",
  },
  {
    id: "stripe_connect",
    label: "Stripe Connect",
    mode: "routing",
    reaches: "any",
    // Per-transfer fee, which is the whole reason Connect is opt-in
    // rather than the default rail.
    incursFee: true,
    note: "Dispatched automatically. Only works for recipients who completed Connect onboarding.",
  },
];

export function payoutMethodById(
  id: string | null | undefined,
): PayoutMethodDefinition | null {
  if (!id) return null;
  return PAYOUT_METHODS.find((m) => m.id === id) ?? null;
}

/**
 * True when the app must not attempt the transfer itself.
 *
 * Defaults to record for an unknown or missing method. An unrecognised
 * id should never cause a transfer: the safe failure is "a human looks
 * at it", not "dispatch and hope".
 */
/**
 * Whether to ask about a fee at all.
 *
 * Defaults to FALSE for an unknown method, unlike isRecordMode, which
 * defaults to the cautious answer. The asymmetry is deliberate: the
 * risk there is dispatching money we should not have, and the risk
 * here is only that an operator has to tell us about a fee some other
 * way. Showing a field nobody can answer is the failure being fixed.
 */
export function incursFee(id: string | null | undefined): boolean {
  const method = payoutMethodById(id);
  return method ? method.incursFee : false;
}

export function isRecordMode(id: string | null | undefined): boolean {
  const method = payoutMethodById(id);
  return method ? method.mode === "record" : true;
}

/** Methods that can actually reach a recipient in `country`. */
export function methodsReaching(
  country: string | null | undefined,
): PayoutMethodDefinition[] {
  const c = (country ?? "US").toUpperCase();
  return PAYOUT_METHODS.filter(
    (m) => m.reaches === "any" || m.reaches.includes(c),
  );
}

/**
 * The status a freshly written split should carry for this method.
 *
 * Record methods land in awaiting_manual, never queued: queued implies
 * something is going to pick it up, and for Found nothing is.
 */
export function initialPayoutStatus(
  id: string | null | undefined,
): "queued" | "awaiting_manual" {
  return isRecordMode(id) ? "awaiting_manual" : "queued";
}
