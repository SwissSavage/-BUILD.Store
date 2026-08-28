/**
 * Task #63 — Per-rail credential specs.
 *
 * Single source of truth for what each rail asks the contributor for.
 * The "add payout method" form renders straight off these, and the
 * server action validates against the same spec, so the two can't
 * drift.
 *
 * The `notice` copy is doing real work: it is where we tell the
 * contributor the truth about a rail's limits BEFORE they pick it.
 * Zelle's notice in particular exists so nobody expects instant
 * automated payout from a rail that has no disbursement API.
 *
 * PayPal and Venmo are absent by policy — see types.ts for the
 * reasoning. Do not add them back without a decision from Jamar.
 */
import type { PayoutRail, RailCredentialSpec } from "./types";

export const RAIL_SPECS: Record<PayoutRail, RailCredentialSpec> = {
  stripe_connect: {
    rail: "stripe_connect",
    notice:
      "Recommended. Stripe handles identity verification and deposits straight to your bank. You'll finish setup on Stripe's site; the cooperative never sees your bank details.",
    fields: [],
  },

  zelle: {
    rail: "zelle",
    notice:
      "Zelle has no API that lets a platform send funds programmatically. Choosing this means an admin sends your payout by hand from the cooperative's bank, then marks it dispatched here. Expect a business day or two of lag versus the automated rails.",
    fields: [
      {
        key: "zelleContact",
        label: "Zelle email or phone",
        type: "text",
        placeholder: "you@example.com or 555-555-5555",
        required: true,
        help: "Whichever your bank has enrolled with Zelle.",
      },
      {
        key: "bankName",
        label: "Bank name",
        type: "text",
        placeholder: "Chase",
        required: false,
        help: "Optional. Helps the admin confirm the transfer landed on the right side.",
      },
    ],
  },

  plaid_ach: {
    rail: "plaid_ach",
    notice:
      "Connect your bank through Plaid. The cooperative stores only Plaid's token, never your account or routing number. Deposits arrive by ACH, typically 1-3 business days.",
    fields: [],
  },

  crypto_wallet: {
    rail: "crypto_wallet",
    notice:
      "Paid in USDC on Base. On-chain transfers are final: there is no chargeback, no reversal, and no recovery if the address is wrong. Double-check the address before saving.",
    fields: [
      {
        key: "walletAddress",
        label: "Wallet address",
        type: "wallet_address",
        placeholder: "0x…",
        required: true,
        help: "Must be a wallet you control the keys to. Exchange deposit addresses often reject contract transfers.",
      },
    ],
  },

  manual_check: {
    rail: "manual_check",
    notice:
      "Slowest option. An admin cuts a physical check and mails it. Use only if none of the electronic rails work for you.",
    fields: [
      {
        key: "payableTo",
        label: "Make check payable to",
        type: "text",
        placeholder: "Full legal name",
        required: true,
      },
      {
        key: "mailingAddress",
        label: "Mailing address",
        type: "text",
        placeholder: "Street, city, state, ZIP",
        required: true,
      },
    ],
  },
};

/**
 * Validate submitted field values against a rail's spec. Returns a
 * list of human-readable problems; empty means valid.
 *
 * Deliberately not using a schema library — the specs are small,
 * the rules are rail-specific, and keeping this dependency-free
 * matches the rest of the codebase.
 */
export function validateRailFields(
  rail: PayoutRail,
  values: Record<string, string>,
): string[] {
  const spec = RAIL_SPECS[rail];
  const problems: string[] = [];

  for (const field of spec.fields) {
    const raw = (values[field.key] ?? "").trim();
    if (field.required && raw.length === 0) {
      problems.push(`${field.label} is required.`);
      continue;
    }
    if (raw.length === 0) continue;

    if (field.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
      problems.push(`${field.label} doesn't look like an email address.`);
    }
    if (field.type === "wallet_address" && !/^0x[a-fA-F0-9]{40}$/.test(raw)) {
      problems.push(
        `${field.label} must be a 42-character address starting with 0x.`,
      );
    }
  }

  return problems;
}

/**
 * Pick the `externalRef` value for a rail from its submitted fields.
 * The router uses externalRef as the destination identifier, so each
 * rail needs to name which field carries it.
 */
export function externalRefForRail(
  rail: PayoutRail,
  values: Record<string, string>,
): string {
  switch (rail) {
    case "zelle":
      return (values.zelleContact ?? "").trim();
    case "crypto_wallet":
      return (values.walletAddress ?? "").trim();
    case "manual_check":
      return (values.payableTo ?? "").trim();
    // stripe_connect + plaid_ach get their ref from the provider's
    // own onboarding callback, not from a form field.
    case "stripe_connect":
    case "plaid_ach":
      return "";
  }
}
