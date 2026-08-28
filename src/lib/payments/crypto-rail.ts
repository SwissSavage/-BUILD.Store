/**
 * Task #63 — Crypto wallet payout rail (USDC on Base).
 *
 * Pairs with the existing wallet connector on /wallet, which already
 * captures `connectedWalletAddress` on the user row. This rail turns
 * that address into a payout destination.
 *
 * WHY USDC ON BASE
 *   - Dollar-denominated, so a split computed in USD pays out the
 *     same number the contributor saw. No price-volatility gap
 *     between settlement and receipt.
 *   - Base gas is cents, not dollars. On Ethereum mainnet a $40
 *     contributor payout could lose meaningful value to gas.
 *   - Coinbase-operated L2 with straightforward on/off ramps for US
 *     contributors, which matters for people who want to cash out.
 *
 * ─────────────────────────────────────────────────────────────
 * IRREVERSIBILITY — this rail is different from every other one.
 *
 * An on-chain transfer cannot be recalled. There is no chargeback,
 * no dispute window, no support line that can claw it back. If the
 * address is wrong, the money is gone.
 *
 * Consequences the implementation MUST honor:
 *   1. Address validation at registration (done in rail-specs).
 *   2. An explicit contributor acknowledgment before the method can
 *      be marked default — checked in the server action, not just
 *      the UI.
 *   3. A small test transfer before any large payout. The admin
 *      queue should surface "first payout to this address" as a
 *      distinct state.
 *   4. Idempotency enforced at the treasury layer, not just here.
 *      A double-send is unrecoverable.
 * ─────────────────────────────────────────────────────────────
 *
 * REPLACE WITH: real treasury dispatch. Two viable shapes:
 *
 *   A) Custodial (simpler): Coinbase Prime / Circle API holds the
 *      USDC and exposes a withdraw endpoint. FM never manages keys.
 *      Recommended for beta.
 *
 *   B) Self-custody multisig (matches build-vision.md's treasury
 *      posture): Safe{Wallet} on Base, payouts batched into a
 *      transaction that signers approve. Slower, no counterparty
 *      risk, aligns with the cooperative-treasury story.
 *
 *   Either way the settlement engine calls the same dispatch() here;
 *   only this file changes.
 *
 * Env: TREASURY_PROVIDER (circle | safe), TREASURY_API_KEY,
 *      TREASURY_WALLET_ADDRESS, USDC_CONTRACT_ADDRESS, BASE_RPC_URL.
 */
import type {
  DispatchPayoutInput,
  DispatchPayoutResult,
  PayoutMethod,
  RailHealth,
} from "./types";
import { PayoutError } from "./types";

/** USDC on Base mainnet. */
export const USDC_BASE_CONTRACT =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Below this, gas + operational overhead isn't worth an on-chain send. */
export const MIN_CRYPTO_PAYOUT_USD = 5;

function envSummary(): Record<string, boolean> {
  return {
    TREASURY_PROVIDER: Boolean(process.env.TREASURY_PROVIDER),
    TREASURY_API_KEY: Boolean(process.env.TREASURY_API_KEY),
    TREASURY_WALLET_ADDRESS: Boolean(process.env.TREASURY_WALLET_ADDRESS),
    BASE_RPC_URL: Boolean(process.env.BASE_RPC_URL),
  };
}

function isConfigured(): boolean {
  return Boolean(
    process.env.TREASURY_PROVIDER && process.env.TREASURY_API_KEY,
  );
}

export async function cryptoHealth(): Promise<RailHealth> {
  const env = envSummary();

  if (!isConfigured()) {
    return {
      rail: "crypto_wallet",
      status: "not_configured",
      mode: "api",
      detail:
        "No treasury provider configured. Set TREASURY_PROVIDER (circle | safe) + TREASURY_API_KEY.",
      envSummary: env,
    };
  }
  return {
    rail: "crypto_wallet",
    status: "degraded",
    mode: "api",
    detail: `Provider ${process.env.TREASURY_PROVIDER} configured but dispatch client not wired — payouts are stubbed.`,
    envSummary: env,
  };
}

/**
 * Address shape is checked at registration. "Verification" here means
 * confirming the address is a plausible externally-owned account and
 * not, say, the USDC contract itself or a known burn address.
 *
 * REPLACE WITH: an RPC `eth_getCode` call — a non-empty result means
 * the destination is a contract, which may not be able to receive
 * ERC-20 transfers safely. Warn on contract destinations.
 */
export async function cryptoVerify(
  method: PayoutMethod,
): Promise<{ verified: boolean; detail: string }> {
  const addr = method.externalRef.toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return { verified: false, detail: "Not a valid EVM address." };
  }
  if (addr === "0x0000000000000000000000000000000000000000") {
    return { verified: false, detail: "Burn address — funds would be lost." };
  }
  if (addr === USDC_BASE_CONTRACT.toLowerCase()) {
    return {
      verified: false,
      detail: "That's the USDC contract address, not a wallet.",
    };
  }
  if (!isConfigured()) {
    return { verified: false, detail: "Treasury not configured." };
  }
  return {
    verified: false,
    detail:
      "Address shape is valid. Confirm with a small test payout before sending a full split.",
  };
}

export async function cryptoDispatch(
  input: DispatchPayoutInput,
): Promise<DispatchPayoutResult> {
  const { method, amountUsd } = input;

  if (!isConfigured()) {
    throw new PayoutError(
      "crypto_wallet",
      "Treasury provider not configured — refusing to dispatch.",
      false,
    );
  }
  if (amountUsd < MIN_CRYPTO_PAYOUT_USD) {
    throw new PayoutError(
      "crypto_wallet",
      `Below the $${MIN_CRYPTO_PAYOUT_USD} on-chain minimum. Roll this split into the next payout or use another rail.`,
      false,
    );
  }
  if (!method.verifiedAt) {
    throw new PayoutError(
      "crypto_wallet",
      "Wallet not verified. On-chain sends are irreversible — verify before dispatching.",
      false,
    );
  }

  // REPLACE WITH: treasury withdraw call. See file header for the two
  // supported shapes. Must be idempotent on input.idempotencyKey —
  // a duplicate on-chain send cannot be undone.
  throw new PayoutError(
    "crypto_wallet",
    "Treasury dispatch client not wired. Implement Circle or Safe dispatch before enabling this rail.",
    false,
  );
}
