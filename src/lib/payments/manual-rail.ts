/**
 * Task #63 — Assisted rails: Zelle and check.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THERE IS NO ZELLE API CLIENT IN THIS FILE
 *
 * Zelle (operated by Early Warning Services, owned by a consortium of
 * US banks) does not publish a disbursement API for third-party
 * platforms. Money moves bank-to-bank between enrolled customers of
 * member institutions. There is no public endpoint a platform like
 * Future Modern can call to push funds to a contributor's Zelle
 * contact, and no sandbox to develop against.
 *
 * What exists instead:
 *   - Bank-specific treasury APIs at large institutions, available
 *     under commercial agreements, generally at enterprise volume.
 *     Mercury (FM's bank) does not currently expose one.
 *   - Third-party "Zelle integrations" that are, in practice, screen
 *     automation against a bank's web UI. Those violate bank terms of
 *     service and put the cooperative's banking relationship at risk.
 *     Not an option.
 *
 * So Zelle is modeled honestly as an ASSISTED rail: the hub records
 * the payout intent with everything an admin needs, the admin sends
 * it by hand from Mercury, and marks it dispatched with a reference.
 * The contributor sees accurate status the whole way through, and the
 * audit log has a complete record. Nothing pretends to be automated
 * that isn't.
 *
 * If Mercury ships a payments API later, Zelle can be promoted from
 * assisted to api by implementing dispatch here and flipping
 * RAIL_DISPATCH_MODE in types.ts. Nothing else has to change.
 * ─────────────────────────────────────────────────────────────
 *
 * Checks work the same way: intent recorded, human cuts and mails it,
 * reference captured on confirm.
 */
import type {
  DispatchPayoutInput,
  DispatchPayoutResult,
  PayoutMethod,
  PayoutRail,
  RailHealth,
} from "./types";
import { PayoutError } from "./types";

/**
 * Assisted rails are always "ok" — they depend on a human and a bank
 * login, not on an API key. Reporting them as not_configured would be
 * misleading; there is nothing to configure.
 */
export async function manualHealth(rail: PayoutRail): Promise<RailHealth> {
  const detail =
    rail === "zelle"
      ? "Assisted rail. No API exists for Zelle disbursement; an admin sends from Mercury and confirms here."
      : "Assisted rail. Admin cuts and mails a physical check, then confirms here.";

  return {
    rail,
    status: "ok",
    mode: "assisted",
    detail,
    envSummary: {},
  };
}

/**
 * Nothing to verify against — we can't ping Zelle to ask whether an
 * email is enrolled. Shape validation happened at registration time.
 * An admin confirms reachability the first time a payout lands.
 */
export async function manualVerify(
  method: PayoutMethod,
): Promise<{ verified: boolean; detail: string }> {
  if (method.externalRef.trim().length === 0) {
    return { verified: false, detail: "No destination recorded." };
  }
  return {
    verified: false,
    detail:
      "Assisted rails are confirmed by the first successful send, not by an API check.",
  };
}

/**
 * "Dispatch" for an assisted rail means: record the intent, hand it
 * to the admin queue, and report `awaiting_manual` so the settlement
 * engine does NOT mark the split as sent. The split flips to sent
 * only when an admin calls confirmManualPayout with a reference.
 */
export async function manualDispatch(
  input: DispatchPayoutInput,
): Promise<DispatchPayoutResult> {
  const { method, amountUsd } = input;

  if (amountUsd <= 0) {
    throw new PayoutError(method.rail, "Payout amount must be positive.", false);
  }
  if (method.externalRef.trim().length === 0) {
    throw new PayoutError(
      method.rail,
      "Payout method has no destination on file.",
      false,
    );
  }

  const instruction =
    method.rail === "zelle"
      ? `Send $${amountUsd.toFixed(2)} via Zelle to ${method.externalRef}${
          method.metadata?.bankName ? ` (${method.metadata.bankName})` : ""
        } from the Mercury account.`
      : `Cut a check for $${amountUsd.toFixed(2)} payable to ${method.externalRef}, mail to ${
          method.metadata?.mailingAddress ?? "address on file"
        }.`;

  return {
    rail: method.rail,
    mode: "assisted",
    status: "awaiting_manual",
    externalTxId: null,
    feeUsd: null,
    detail: `${instruction} Memo: ${input.memo}`,
    dispatchedAt: new Date().toISOString(),
  };
}
