/**
 * Donation completion actions.
 *
 * Whitelist donations flow: buyer initiates on /whitelist → row lands
 * in MOCK_WHITELIST_PURCHASES with status "initiated" → payment
 * confirms → admin marks the donation completed here, which writes
 * the 50/50 Treasury/LP split rows via the shared settlement engine.
 *
 * Sandbox mutates the mock stores; production replaces with Stripe
 * payment_intent.succeeded webhook that fires the same completion
 * action automatically.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_WHITELIST_PURCHASES } from "@/lib/mock-data/whitelist";
import { writeDonationSplit } from "@/lib/settlement-splits";

/**
 * Mark a donation completed + write the Treasury/LP split. Idempotent
 * — refuses to re-run against a donation that already has
 * splitDistributedAt set.
 */
export async function distributeDonationSplit(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const purchaseId = String(formData.get("purchaseId") ?? "").trim();
  if (!purchaseId) throw new Error("Donation id is required.");

  const purchase = MOCK_WHITELIST_PURCHASES.find((p) => p.id === purchaseId);
  if (!purchase) throw new Error("Donation not found.");
  if (purchase.splitDistributedAt) {
    throw new Error("Donation split already distributed.");
  }

  const gross = Number(purchase.amountUsd);
  if (gross <= 0) {
    throw new Error("Donation amount is zero or negative — cannot settle.");
  }

  writeDonationSplit({
    gross,
    sourceId: purchase.id,
    actorUserId: admin.id,
    noteContext: `Donation ${purchase.id} from ${purchase.buyerName}`,
  });

  const now = new Date().toISOString();
  purchase.status = "split_distributed";
  purchase.paidAt = purchase.paidAt ?? now;
  purchase.splitDistributedAt = now;

  revalidatePath("/admin/whitelist");
  revalidatePath("/admin/pools");
}
