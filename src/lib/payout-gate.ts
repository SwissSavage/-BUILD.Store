/**
 * Payout gate — enforces the invariant that no distribution fires
 * without a linked invoice or receipt.
 *
 * Called from settlement flows (contract close, order settlement,
 * bonus release, donation completion) BEFORE the split engine
 * writes any rows. If the gate returns false, the settlement action
 * throws with a clear "attach a document first" error so the admin
 * knows what to do.
 *
 * SANDBOX→LIVE swap history:
 *   - Pre-Beta cutover: read from MOCK_INVOICES in-memory array.
 *   - Beta cutover (this file): read from Drizzle `invoices` table
 *     via db.select against the live Dokploy Postgres. All exported
 *     functions are now async and return Promises; callers must
 *     await them.
 */
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { invoices } from "@/db/schema";
import type { InvoiceDirection } from "@/lib/types";

/**
 * Check whether a settlement source (project id or order id) has a
 * received payout-authorizing document attached. `direction` narrows
 * the check to the specific flow — a contract settlement needs a
 * received `coop_to_client` invoice OR a `retroactive_receipt`; a
 * marketplace order needs a `marketplace_receipt`; and so on.
 */
export async function hasValidPayoutDocument(
  sourceId: string,
  direction:
    | "contract_settlement"
    | "order_settlement"
    | "bonus_release"
    | "donation",
): Promise<boolean> {
  if (direction === "contract_settlement" || direction === "bonus_release") {
    // Any received external invoice OR a retroactive receipt on the
    // project qualifies. External invoice is the primary path;
    // retroactive is the escape hatch.
    const rows = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          inArray(invoices.direction, [
            "coop_to_client",
            "retroactive_receipt",
          ]),
          eq(invoices.contractId, sourceId),
          eq(invoices.status, "received"),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  if (direction === "order_settlement") {
    // Marketplace orders need a marketplace_receipt attached (which
    // Tier 26 auto-generates on order fulfillment via
    // createMarketplaceReceiptInternal).
    const rows = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.direction, "marketplace_receipt"),
          eq(invoices.sourceRefId, sourceId),
          eq(invoices.status, "received"),
        ),
      )
      .limit(1);
    return rows.length > 0;
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
export async function payoutDocumentsFor(
  sourceId: string,
  directions: InvoiceDirection[],
) {
  return await db
    .select()
    .from(invoices)
    .where(
      and(
        or(
          eq(invoices.contractId, sourceId),
          eq(invoices.sourceRefId, sourceId),
        ),
        inArray(invoices.direction, directions),
      ),
    );
}

/**
 * All internal invoices approved against a project — the substrate
 * the external invoice aggregates. Feeds the generate-external-
 * invoice admin surface + the contributor-pool allocation at
 * settlement time.
 */
export async function approvedInternalInvoicesFor(projectId: string) {
  return await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.direction, "talent_to_coop"),
        eq(invoices.contractId, projectId),
        eq(invoices.status, "received"),
      ),
    );
}
