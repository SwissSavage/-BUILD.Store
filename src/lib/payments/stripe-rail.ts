/**
 * Task #63 — Stripe Connect payout rail.
 *
 * Wraps the existing Connect Express work (payouts-stub.ts) behind
 * the hub's rail interface so settlement can dispatch through the
 * same API as every other rail.
 *
 * REPLACE WITH: real `stripe` SDK calls. The shape below is exactly
 * what the live implementation needs, so swapping is mechanical:
 *
 *   import Stripe from "stripe";
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *
 *   dispatch → stripe.transfers.create({
 *                amount: Math.round(amountUsd * 100),
 *                currency: "usd",
 *                destination: method.externalRef,   // acct_*
 *                transfer_group: input.splitId,
 *                description: input.memo,
 *              }, { idempotencyKey: input.idempotencyKey })
 *
 *   verify   → stripe.accounts.retrieve(acctId) and check
 *              `payouts_enabled === true && details_submitted === true`
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_CONNECT_CLIENT_ID, STRIPE_WEBHOOK_SECRET.
 *
 * PCI posture: we hold only the `acct_*` token. No card data, no bank
 * numbers, no PAN ever touches FM infrastructure. SAQ-A scope.
 */
import type {
  DispatchPayoutInput,
  DispatchPayoutResult,
  PayoutMethod,
  RailHealth,
} from "./types";
import { PayoutError } from "./types";

function envSummary(): Record<string, boolean> {
  return {
    STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
    STRIPE_CONNECT_CLIENT_ID: Boolean(process.env.STRIPE_CONNECT_CLIENT_ID),
    STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };
}

function isConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function stripeHealth(): Promise<RailHealth> {
  const env = envSummary();
  if (!isConfigured()) {
    return {
      rail: "stripe_connect",
      status: "not_configured",
      mode: "api",
      detail:
        "STRIPE_SECRET_KEY not set. Rail is registered but cannot dispatch.",
      envSummary: env,
    };
  }
  // REPLACE WITH: stripe.balance.retrieve() as a live probe.
  return {
    rail: "stripe_connect",
    status: "degraded",
    mode: "api",
    detail:
      "Key present but SDK not wired — dispatch returns a stub result. Swap in the `stripe` SDK to go live.",
    envSummary: env,
  };
}

/**
 * Confirm a connected account can actually receive funds. Called
 * before a method is marked verified, and again by the settlement
 * engine as a pre-flight so we don't queue a payout to a stalled
 * onboarding.
 */
export async function stripeVerify(
  method: PayoutMethod,
): Promise<{ verified: boolean; detail: string }> {
  if (!method.externalRef.startsWith("acct_")) {
    return {
      verified: false,
      detail: "Missing Stripe account id — onboarding not finished.",
    };
  }
  if (!isConfigured()) {
    return {
      verified: false,
      detail: "Stripe not configured on this environment.",
    };
  }
  // REPLACE WITH: accounts.retrieve + payouts_enabled check.
  return {
    verified: false,
    detail: "Stripe SDK not wired yet — cannot confirm payouts_enabled.",
  };
}

export async function stripeDispatch(
  input: DispatchPayoutInput,
): Promise<DispatchPayoutResult> {
  if (!isConfigured()) {
    throw new PayoutError(
      "stripe_connect",
      "STRIPE_SECRET_KEY missing — refusing to dispatch.",
      false,
    );
  }
  if (!input.method.externalRef.startsWith("acct_")) {
    throw new PayoutError(
      "stripe_connect",
      "Payout method has no connected account id.",
      false,
    );
  }

  // REPLACE WITH: stripe.transfers.create(...) — see file header.
  throw new PayoutError(
    "stripe_connect",
    "Stripe SDK not wired. Install `stripe` and implement transfers.create before enabling this rail in production.",
    false,
  );
}
