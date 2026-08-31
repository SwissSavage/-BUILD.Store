/**
 * Task #63 — Payments hub router. One API, five outbound rails.
 *
 * Settlement code should import ONLY from this file. It never picks a
 * rail itself; it hands over a PayoutMethod and the router dispatches
 * to whichever driver that method names. Adding a rail means adding a
 * driver and one switch arm here, with no change to callers.
 *
 * Mirrors the storage router (src/lib/storage/index.ts) deliberately —
 * same shape, same health-probe pattern, same audit-logging posture.
 *
 * ─────────────────────────────────────────────────────────────
 * INVARIANT: the payout gate still runs first.
 *
 * `src/lib/payout-gate.ts` enforces that no distribution fires without
 * a linked invoice or receipt. This router does NOT re-implement that
 * check and does NOT bypass it. Settlement calls the gate, then calls
 * dispatchPayout. Wiring dispatchPayout directly into a UI button
 * would skip the gate — don't.
 * ─────────────────────────────────────────────────────────────
 */
import type {
  DispatchPayoutInput,
  DispatchPayoutResult,
  PayoutMethod,
  PayoutRail,
  RailHealth,
} from "./types";
import { PayoutError, RAIL_DISPATCH_MODE } from "./types";
import { stripeDispatch, stripeHealth, stripeVerify } from "./stripe-rail";
import { manualDispatch, manualHealth, manualVerify } from "./manual-rail";
import { plaidDispatch, plaidHealth, plaidVerify } from "./plaid-rail";
import { cryptoDispatch, cryptoHealth, cryptoVerify } from "./crypto-rail";
import { logAuditEvent } from "@/lib/writers/audit-log";

export type {
  DispatchPayoutInput,
  DispatchPayoutResult,
  PayoutMethod,
  PayoutRail,
  RailHealth,
};
export { PayoutError };
export { RAIL_SPECS, validateRailFields, externalRefForRail } from "./rail-specs";
export {
  PAYOUT_RAIL_LABELS,
  RAIL_DISPATCH_MODE,
} from "./types";

/**
 * Rails that can carry a payout end-to-end without a human. Used by
 * the settlement engine to decide whether a batch can run unattended
 * or needs to land in the admin queue.
 */
export const AUTOMATED_RAILS: PayoutRail[] = [
  "stripe_connect",
  "plaid_ach",
  "crypto_wallet",
];

/**
 * Dispatch a single payout through the rail its method names.
 *
 * Throws PayoutError on refusal. Callers should catch, mark the split
 * `failed` with the message, and surface it in the admin queue rather
 * than letting a settlement batch die on one bad destination.
 */
export async function dispatchPayout(
  input: DispatchPayoutInput,
): Promise<DispatchPayoutResult> {
  const { method } = input;

  if (input.amountUsd <= 0) {
    throw new PayoutError(method.rail, "Payout amount must be positive.", false);
  }
  if (!input.idempotencyKey) {
    throw new PayoutError(
      method.rail,
      "Missing idempotency key — refusing to dispatch a payout that could double-send.",
      false,
    );
  }

  let result: DispatchPayoutResult;
  try {
    switch (method.rail) {
      case "stripe_connect":
        result = await stripeDispatch(input);
        break;
      case "plaid_ach":
        result = await plaidDispatch(input);
        break;
      case "crypto_wallet":
        result = await cryptoDispatch(input);
        break;
      case "zelle":
      case "manual_check":
        result = await manualDispatch(input);
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAuditEvent({
      actorUserId: null,
      actorRoleSnapshot: "system",
      action: "payout.dispatch_failed",
      resourceKind: "revenue_split",
      resourceId: input.splitId,
      before: null,
      after: null,
      reason: `${method.rail}: ${message}`,
    });
    throw err;
  }

  await logAuditEvent({
    actorUserId: null,
    actorRoleSnapshot: "system",
    action: "payout.dispatched",
    resourceKind: "revenue_split",
    resourceId: input.splitId,
    before: null,
    after: {
      rail: result.rail,
      status: result.status,
      externalTxId: result.externalTxId,
      amountUsd: input.amountUsd,
    },
    reason: result.detail,
  });

  return result;
}

/**
 * Ask a rail whether a destination is real and reachable.
 *
 * Rails differ in how much they can actually confirm — PayPal and the
 * assisted rails have no verification endpoint at all. Each driver
 * returns an honest `detail` explaining what its answer means, and
 * callers should surface that string rather than reducing it to a
 * green check.
 */
export async function verifyPayoutMethod(
  method: PayoutMethod,
): Promise<{ verified: boolean; detail: string }> {
  switch (method.rail) {
    case "stripe_connect":
      return stripeVerify(method);
    case "plaid_ach":
      return plaidVerify(method);
    case "crypto_wallet":
      return cryptoVerify(method);
    case "zelle":
    case "manual_check":
      return manualVerify(method);
  }
}

/**
 * Health across every rail. Backs /api/payments/health and the
 * /admin/payments dashboard.
 *
 * Runs probes in parallel — a slow or hanging provider shouldn't
 * serialize the whole page.
 */
export async function paymentsHealth(): Promise<RailHealth[]> {
  const [stripe, plaid, crypto, zelle, check] = await Promise.all([
    stripeHealth(),
    plaidHealth(),
    cryptoHealth(),
    manualHealth("zelle"),
    manualHealth("manual_check"),
  ]);

  return [stripe, plaid, crypto, zelle, check];
}

/**
 * Whether a rail can currently carry an unattended payout. The
 * settlement engine checks this before building an automated batch;
 * anything false routes to the admin queue instead.
 */
export function railIsAutomated(rail: PayoutRail): boolean {
  return RAIL_DISPATCH_MODE[rail] === "api";
}

/**
 * Pick the method a settlement should use for a contributor.
 * Prefers the explicit default, falls back to the only verified
 * method, and returns null when there's nothing safe to use.
 *
 * Returning null is not an error — it means "this contributor hasn't
 * set up payouts yet," which the settlement engine surfaces as a
 * blocked split rather than a failure.
 */
export function selectPayoutMethod(
  methods: PayoutMethod[],
): PayoutMethod | null {
  const usable = methods.filter((m) => m.verifiedAt !== null);
  if (usable.length === 0) return null;

  const explicit = usable.find((m) => m.isDefault);
  if (explicit) return explicit;

  return usable.length === 1 ? usable[0] : null;
}
