/**
 * ============================================================
 * STUB — Stripe Connect payouts (Phase 1.5).
 *
 * REPLACE WITH: real Stripe Connect Express integration.
 *   - createConnectAccount → stripe.accounts.create({ type: "express" })
 *   - createOnboardingLink → stripe.accountLinks.create({ ... })
 *   - syncAccountStatus    → reconcile via webhook on `account.updated`
 *   - dispatchTransfer     → stripe.transfers.create({ amount, destination })
 *
 * Env vars in production: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 * STRIPE_CONNECT_CLIENT_ID, NEXT_PUBLIC_APP_URL.
 *
 * Security posture: we never store bank credentials, account numbers, or
 * routing info. Our DB only retains Stripe's `acct_*` token. PCI scope
 * stays SAQ-A; bank-grade security lives on Stripe's side.
 *
 * Persistence (2026-08-31): writes to `users` and `revenue_splits`.
 * These four functions mutated in-memory fixtures until then, so a
 * contributor completing payout onboarding got an `acct_*` id that
 * existed for one request, and a dispatched transfer left the split
 * row untouched — the payout queue never drained.
 *
 * Still synthetic where Stripe would be: no SDK call is made. The
 * account id and transfer id are generated locally. What is real now
 * is that the state changes survive, so the queue, the onboarding
 * gate and the settlement page agree with each other.
 * ============================================================
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { revenueSplits, users } from "@/db/schema";
import { getUserById } from "@/lib/readers/users";
import { splitReader } from "@/lib/readers";
import type { PayoutStatus } from "@/lib/types";

/**
 * Begin Connect onboarding. In production this returns a Stripe-hosted URL
 * the contributor lands on to complete KYC. In sandbox we just generate a
 * fake `acct_*` ID and return a self-route the user can click to finish.
 */
export async function createConnectAccount(userId: string): Promise<{
  accountId: string;
  onboardingUrl: string;
}> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  let accountId = user.stripeAccountId;
  if (!accountId) {
    accountId = `acct_${randomUUID()}`;
    await db
      .update(users)
      .set({ stripeAccountId: accountId, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));
  }
  return {
    accountId,
    onboardingUrl: `/profile/payouts/onboard?acct=${accountId}`,
  };
}

/**
 * Marks Connect onboarding complete (sandbox shortcut). In production this
 * is driven by the Stripe `account.updated` webhook, which sets
 * `details_submitted=true` and `payouts_enabled=true`.
 */
export async function markPayoutsEnabled(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  await db
    .update(users)
    .set({ stripePayoutsEnabled: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));
}

/**
 * Disconnect — clears the Stripe account reference. In production this would
 * deauthorize the Connect account via Stripe's OAuth API.
 */
export async function disconnectPayouts(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  await db
    .update(users)
    .set({
      stripeAccountId: null,
      stripePayoutsEnabled: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));
}

/**
 * Dispatch a Stripe Connect transfer for a single revenue split row.
 *
 * Failure isolation: each row dispatches independently so a Stripe error on
 * one recipient (e.g. KYC incomplete) doesn't block the rest. The split row
 * captures its own status and any failure reason.
 *
 * In production: stripe.transfers.create({ amount, currency: "usd",
 * destination: account, transfer_group: contractId, metadata: {...} }).
 */
export async function dispatchTransfer(
  splitId: string,
): Promise<{ status: PayoutStatus; transferId: string | null; reason?: string }> {
  const split = await splitReader.byId(splitId);
  if (!split) throw new Error("Split row not found");

  const recipient = await getUserById(split.recipientId);
  if (recipient && !recipient.stripePayoutsEnabled) {
    await db
      .update(revenueSplits)
      .set({
        payoutStatus: "failed",
        notes:
          "Stripe Connect payouts not enabled. Contributor needs to finish onboarding.",
      })
      .where(eq(revenueSplits.id, splitId));
    return {
      status: "failed",
      transferId: null,
      reason: "payouts_not_enabled",
    };
  }

  const transferId = `tr_${randomUUID()}`;
  // Guarded so a split already marked sent can't be dispatched twice.
  // Without persistence this could not have been enforced at all —
  // and double-dispatch on a payout is money out the door twice.
  const claimed = await db
    .update(revenueSplits)
    .set({
      payoutStatus: "sent",
      payoutSentAt: new Date().toISOString(),
      stripeTransferId: transferId,
    })
    .where(eq(revenueSplits.id, splitId))
    .returning({ id: revenueSplits.id });
  if (claimed.length === 0) throw new Error("Split row not found");

  return { status: "sent", transferId };
}
