/**
 * Payout gate — enforces the invariant that no distribution fires
 * without a linked invoice or receipt.
 *
 * Called from settlement flows (contract close, order settlement,
 * bonus release, donation completion) BEFORE the split engine
 * writes any rows. If the gate returns false, the settlement action
 * throws with a clear "attach a document first" error so the admin
 * knows what to do.
 */
import { MOCK_INVOICES } from "@/lib/mock-data/invoices";
import type { InvoiceDirection } from "@/lib/types";

/**
 * Check whether a settlement source (project id or order id) has a
 * received payout-authorizing document attached. `direction` narrows
 * the check to the specific flow — a contract settlement needs a
 * received `coop_to_client` invoice OR a `retroactive_receipt`; a
 * marketplace order needs a `marketplace_receipt`; and so on.
 */
export function hasValidPayoutDocument(
  sourceId: string,
  direction:
    | "contract_settlement"
    | "order_settlement"
    | "bonus_release"
    | "donation",
): boolean {
  if (direction === "contract_settlement" || direction === "bonus_release") {
    // Any received external invoice OR a retroactive receipt on the
    // project qualifies. External invoice is the primary path;
    // retroactive is the escape hatch.
    return MOCK_INVOICES.some(
      (i) =>
        (i.direction === "coop_to_client" ||
          i.direction === "retroactive_receipt") &&
        i.contractId === sourceId &&
        i.status === "received",
    );
  }
  if (direction === "order_settlement") {
    // Marketplace orders need a marketplace_receipt attached (which
    // Tier 26 auto-generates on order fulfillment via
    // createMarketplaceReceiptInternal).
    return MOCK_INVOICES.some(
      (i) =>
        i.direction === "marketplace_receipt" &&
        i.sourceRefId === sourceId &&
        i.status === "received",
    );
  }
  // Donations don't require a separate invoice — the whitelist_purchase
  // row IS the documentation. Gate passes structurally.
  return true;
}

/**
 * Which specific documents authorize a settlement — used in error
 * messages and admin surfaces so the operator can see the source
 * of authority.
 */
export function payoutDocumentsFor(
  sourceId: string,
  directions: InvoiceDirection[],
) {
  return MOCK_INVOICES.filter(
    (i) =>
      (i.contractId === sourceId || i.sourceRefId === sourceId) &&
      directions.includes(i.direction),
  );
}

/**
 * All internal invoices approved against a project — the substrate
 * the external invoice aggregates. Feeds the generate-external-
 * invoice admin surface + the contributor-pool allocation at
 * settlement time.
 */
export function approvedInternalInvoicesFor(projectId: string) {
  return MOCK_INVOICES.filter(
    (i) =>
      i.direction === "talent_to_coop" &&
      i.contractId === projectId &&
      i.status === "received",
  );
}
