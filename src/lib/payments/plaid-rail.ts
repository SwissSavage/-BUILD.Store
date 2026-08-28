/**
 * Task #63 — Plaid bank rail.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT PLAID IS AND ISN'T
 *
 * Plaid is NOT a payment network. It does two separate things that
 * matter here, and conflating them is the usual integration mistake:
 *
 *   1. ACCOUNT VERIFICATION (Auth product) — the contributor logs
 *      into their bank through Plaid Link, and we receive a token
 *      plus verified account/routing details. This is the part FM
 *      almost certainly wants: it kills the "I typo'd my routing
 *      number" failure mode without FM ever handling raw bank creds.
 *
 *   2. ACH ORIGINATION (Transfer product) — Plaid actually moves the
 *      money. This requires separate underwriting and approval from
 *      Plaid, has its own risk holds, and is priced per transfer.
 *      It is NOT enabled by default when you sign up for Plaid.
 *
 * The realistic FM configuration, at least through beta:
 *   → Use Plaid for verification only.
 *   → Originate the actual ACH from Mercury, using the verified
 *     account/routing pair Plaid handed back.
 *
 * That keeps underwriting out of the critical path and matches how
 * the cooperative already pays people. `PLAID_TRANSFER_ENABLED`
 * gates the second mode so the code is ready if FM ever gets
 * Transfer approved, without pretending it's live now.
 *
 * STORAGE POSTURE: we persist Plaid's `access_token` (server-side,
 * encrypted at rest by Postgres) and `account_id`. We do NOT persist
 * raw account or routing numbers in the payout_methods row — those
 * are fetched on demand at settlement time and never written down.
 * That keeps NACHA and PCI-adjacent exposure minimal.
 * ─────────────────────────────────────────────────────────────
 *
 * REPLACE WITH: real Plaid SDK calls.
 *
 *   Link token (client init):
 *     POST /link/token/create
 *       { user: { client_user_id }, products: ["auth"],
 *         country_codes: ["US"], language: "en" }
 *
 *   Exchange (after Link success):
 *     POST /item/public_token/exchange { public_token }
 *     → { access_token, item_id }
 *
 *   Verified numbers (at settlement, not at registration):
 *     POST /auth/get { access_token }
 *     → numbers.ach[] with account + routing per account_id
 *
 *   Transfer (only if PLAID_TRANSFER_ENABLED):
 *     POST /transfer/authorization/create then /transfer/create
 *
 * Env: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
 *      (sandbox | development | production), PLAID_TRANSFER_ENABLED.
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
    PLAID_CLIENT_ID: Boolean(process.env.PLAID_CLIENT_ID),
    PLAID_SECRET: Boolean(process.env.PLAID_SECRET),
    PLAID_ENV: Boolean(process.env.PLAID_ENV),
    PLAID_TRANSFER_ENABLED: process.env.PLAID_TRANSFER_ENABLED === "true",
  };
}

function isConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function transferEnabled(): boolean {
  return process.env.PLAID_TRANSFER_ENABLED === "true";
}

export async function plaidHealth(): Promise<RailHealth> {
  const env = envSummary();

  if (!isConfigured()) {
    return {
      rail: "plaid_ach",
      status: "not_configured",
      mode: "api",
      detail:
        "PLAID_CLIENT_ID / PLAID_SECRET not set. Bank verification unavailable.",
      envSummary: env,
    };
  }

  if (!transferEnabled()) {
    return {
      rail: "plaid_ach",
      status: "degraded",
      mode: "api",
      detail:
        "Verification-only mode. Plaid confirms the account; ACH is originated from Mercury by an admin. Set PLAID_TRANSFER_ENABLED=true only after Plaid approves Transfer underwriting.",
      envSummary: env,
    };
  }

  return {
    rail: "plaid_ach",
    status: "degraded",
    mode: "api",
    detail:
      "Transfer mode flagged on but SDK not wired — dispatch is stubbed.",
    envSummary: env,
  };
}

/**
 * A Plaid method is verified once we hold an access_token and the
 * Auth product returns ACH numbers for the chosen account_id.
 *
 * REPLACE WITH: POST /auth/get and confirm numbers.ach contains an
 * entry whose account_id matches method.externalRef.
 */
export async function plaidVerify(
  method: PayoutMethod,
): Promise<{ verified: boolean; detail: string }> {
  if (!isConfigured()) {
    return { verified: false, detail: "Plaid not configured." };
  }
  if (!method.metadata?.plaidItemId) {
    return {
      verified: false,
      detail: "Bank link not completed — no Plaid item on file.",
    };
  }
  return {
    verified: false,
    detail: "Plaid SDK not wired — cannot run /auth/get to confirm.",
  };
}

export async function plaidDispatch(
  input: DispatchPayoutInput,
): Promise<DispatchPayoutResult> {
  if (!isConfigured()) {
    throw new PayoutError(
      "plaid_ach",
      "Plaid credentials missing — refusing to dispatch.",
      false,
    );
  }

  // Verification-only mode is the expected production configuration
  // through beta. Report it as an assisted-style outcome so the admin
  // queue picks it up and originates from Mercury, rather than
  // failing the settlement outright.
  if (!transferEnabled()) {
    return {
      rail: "plaid_ach",
      mode: "api",
      status: "awaiting_manual",
      externalTxId: null,
      feeUsd: null,
      detail: `Plaid verification-only mode: originate $${input.amountUsd.toFixed(2)} ACH from Mercury to the Plaid-verified account on file (item ${input.method.metadata?.plaidItemId ?? "unknown"}). Memo: ${input.memo}`,
      dispatchedAt: new Date().toISOString(),
    };
  }

  // REPLACE WITH: /transfer/authorization/create → /transfer/create.
  throw new PayoutError(
    "plaid_ach",
    "Plaid Transfer flagged on but SDK not wired. Implement the authorization + create pair before enabling.",
    false,
  );
}
