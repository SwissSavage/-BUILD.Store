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
 * Sandbox behavior:
 *   - Mutates MOCK_USERS / MOCK_SPLITS in memory.
 *   - Returns synthetic Stripe-shaped IDs.
 * ============================================================
 */
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
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
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  if (!user.stripeAccountId) {
    user.stripeAccountId = `acct_1Q9${userId.replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`;
    user.updatedAt = new Date().toISOString();
  }
  return {
    accountId: user.stripeAccountId,
    onboardingUrl: `/profile/payouts/onboard?acct=${user.stripeAccountId}`,
  };
}

/**
 * Marks Connect onboarding complete (sandbox shortcut). In production this
 * is driven by the Stripe `account.updated` webhook, which sets
 * `details_submitted=true` and `payouts_enabled=true`.
 */
export async function markPayoutsEnabled(userId: string): Promise<void> {
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  user.stripePayoutsEnabled = true;
  user.updatedAt = new Date().toISOString();
}

/**
 * Disconnect — clears the Stripe account reference. In production this would
 * deauthorize the Connect account via Stripe's OAuth API.
 */
export async function disconnectPayouts(userId: string): Promise<void> {
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  user.stripeAccountId = null;
  user.stripePayoutsEnabled = false;
  user.updatedAt = new Date().toISOString();
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
  const split = MOCK_SPLITS.find((s) => s.id === splitId);
  if (!split) throw new Error("Split row not found");

  // In sandbox: instant success unless the recipient is a contributor
  // without payouts enabled.
  const recipient = MOCK_USERS.find((u) => u.id === split.recipientId);
  if (recipient && !recipient.stripePayoutsEnabled) {
    split.payoutStatus = "failed";
    split.notes =
      "Stripe Connect payouts not enabled. Contributor needs to finish onboarding.";
    return {
      status: "failed",
      transferId: null,
      reason: "payouts_not_enabled",
    };
  }

  split.payoutStatus = "sent";
  split.payoutSentAt = new Date().toISOString();
  split.stripeTransferId = `tr_sandbox_${Date.now().toString(36)}`;
  return { status: "sent", transferId: split.stripeTransferId };
}
