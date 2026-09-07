/**
 * Donation completion actions.
 *
 * Whitelist donations flow: buyer initiates on /whitelist → row lands
 * in whitelist_purchases with status "initiated" → payment confirms →
 * admin marks it paid → admin runs the split here, which writes the
 * 50/50 Treasury/LP rows through the shared settlement engine.
 *
 * Production replaces the manual step with a Stripe
 * payment_intent.succeeded webhook firing the same function.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-07)
 *
 * There were two "run the split" implementations and neither one
 * worked.
 *
 * This function looked the donation up in the seed array, so it threw
 * "Donation not found" for anything real. It also had no caller: the
 * Run split button on /admin/whitelist pointed at a local action in
 * the page file that flipped `status` to "split_distributed" and set
 * `splitDistributedAt` without ever calling writeDonationSplit.
 *
 * So the button reported success, the donation showed as settled, and
 * no Treasury or LP row was ever written. The pools are understated by
 * every donation that has been through that button, and the status
 * field says otherwise, which is why nobody would have caught it from
 * the admin surface.
 *
 * One implementation now, in the writer layer where the money math
 * already lives, and the page calls it.
 *
 * ORDER OF OPERATIONS
 *
 * Claim first, then write, same as the bonus release path. The claim
 * is a guarded UPDATE, so two admins pressing the button at the same
 * instant produce one set of split rows rather than two. If the split
 * write then fails the claim is released, because a donation stuck at
 * "split_distributed" with no rows behind it is the exact state this
 * function exists to prevent.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { whitelistPurchases } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { whitelistPurchaseReader } from "@/lib/readers";
import { writeDonationSplit } from "@/lib/settlement-splits";

/**
 * Mark a donation split-distributed and write the Treasury/LP rows.
 * Idempotent: refuses to re-run against a donation that already has
 * splitDistributedAt set.
 */
export async function distributeDonationSplit(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const purchaseId =
    String(formData.get("purchaseId") ?? "").trim() ||
    String(formData.get("id") ?? "").trim();
  if (!purchaseId) throw new Error("Donation id is required.");

  const purchase = await whitelistPurchaseReader.byId(purchaseId);
  if (!purchase) throw new Error("Donation not found.");
  if (purchase.status !== "paid") {
    throw new Error(
      `Donation is ${purchase.status}. Only a paid donation can be split.`,
    );
  }
  if (purchase.splitDistributedAt) {
    throw new Error("Donation split already distributed.");
  }

  const gross = Number(purchase.amountUsd);
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error("Donation amount is zero or negative. Cannot settle.");
  }

  const now = new Date().toISOString();
  const claimed = await db
    .update(whitelistPurchases)
    .set({
      status: "split_distributed",
      paidAt: purchase.paidAt ?? now,
      splitDistributedAt: now,
    })
    .where(
      and(
        eq(whitelistPurchases.id, purchaseId),
        eq(whitelistPurchases.status, "paid"),
        isNull(whitelistPurchases.splitDistributedAt),
      )!,
    )
    .returning({ id: whitelistPurchases.id });

  if (claimed.length === 0) {
    throw new Error(
      "This donation was just settled by someone else. Reload the page.",
    );
  }

  try {
    await writeDonationSplit({
      gross,
      sourceId: purchase.id,
      actorUserId: admin.id,
      noteContext: `Donation ${purchase.id} from ${purchase.buyerName}`,
    });
  } catch (err) {
    // Put it back so the button can be pressed again. Leaving it
    // claimed would mark the donation settled with nothing behind it,
    // which is the bug this function was written to fix.
    await db
      .update(whitelistPurchases)
      .set({ status: "paid", splitDistributedAt: null })
      .where(eq(whitelistPurchases.id, purchaseId));
    throw err;
  }

  revalidatePath("/admin/whitelist");
  revalidatePath("/admin/pools");
}
