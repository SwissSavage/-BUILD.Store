/**
 * Donation confirmation (sandbox).
 *
 * Shows the donor what will happen on payment confirmation — payment
 * rail, amount, and a transparent breakdown of where the donation
 * lands. In production this renders the Stripe Checkout return page
 * (cash rail) or the wallet signature prompt + tx status (crypto rail).
 *
 * The sandbox intentionally does NOT flip status to `paid` here — that
 * requires the real webhook (Stripe) or on-chain event (crypto). Admin
 * can force-flip from /admin/whitelist for testing.
 *
 * No individual payout is ever dispatched on a donation — by policy.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MOCK_WHITELIST_PURCHASES,
  MOCK_WHITELIST_TIERS,
} from "@/lib/mock-data/whitelist";
import {
  WHITELIST_PURCHASE_STATUS_LABELS,
  WHITELIST_RAIL_LABELS,
} from "@/lib/types";
import { previewDonationSplit } from "@/lib/whitelist-splits";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function WhitelistConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();
  const purchase = MOCK_WHITELIST_PURCHASES.find((p) => p.id === id);
  if (!purchase) notFound();
  const tier = MOCK_WHITELIST_TIERS.find((t) => t.id === purchase.tierId);
  if (!tier) notFound();
  const split = previewDonationSplit(Number(purchase.amountUsd));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/whitelist" className="text-sm text-ink-muted hover:text-ink">
        ← Back to whitelist
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Confirm your donation
      </h1>
      <p className="mt-2 text-ink-muted">
        Status: {WHITELIST_PURCHASE_STATUS_LABELS[purchase.status]}
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Reminder: donations do not grant access, perks, or standing.
        100% routes to the cooperative&apos;s structural pools.
      </p>

      <Card className="mt-8">
        <CardEyebrow>{tier.name} · donation</CardEyebrow>
        <CardTitle className="mt-2">
          ${Number(purchase.amountUsd).toLocaleString()} ·{" "}
          {WHITELIST_RAIL_LABELS[purchase.rail]}
        </CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          Donor: {purchase.buyerName} · {purchase.buyerEmail}
        </p>

        {/* Charge breakdown — only meaningful on the Stripe rail. */}
        {Number(purchase.processingFee) > 0 && (
          <div className="mt-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
            <div className="font-medium text-ink">What you&apos;ll be charged</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-ink-muted">
              <span>Donation</span>
              <span className="text-right">
                ${Number(purchase.amountUsd).toLocaleString()}
              </span>
              <span>Card processing (2.9% + $0.30)</span>
              <span className="text-right">
                +${Number(purchase.processingFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="border-t border-[var(--surface-border)] pt-1 font-medium text-ink">
                Card charge
              </span>
              <span className="border-t border-[var(--surface-border)] pt-1 text-right font-medium text-ink">
                ${(Number(purchase.amountUsd) + Number(purchase.processingFee)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              The markup keeps the cooperative whole — the full
              ${Number(purchase.amountUsd).toLocaleString()} routes to the
              pools below after Stripe takes its cut.
            </p>
          </div>
        )}

        {purchase.rail === "cash" ? (
          <p className="mt-3 text-sm text-ink-muted">
            In production, you&apos;d be redirected to Stripe Checkout
            here. Sandbox stops at <code>status=initiated</code> — admin
            can force <code>paid</code> from the admin console.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            In production, your wallet would prompt for a USDC transfer
            to the cooperative treasury. The on-chain tx hash lands on
            this record once the event fires.
          </p>
        )}
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Where your donation goes</CardEyebrow>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span>Treasury (50%)</span>
          <span className="text-right">${split.treasury.toLocaleString()}</span>
          <span>Liquidity Pool (50%)</span>
          <span className="text-right">
            ${split.liquidityPool.toLocaleString()}
          </span>
          <span className="font-medium text-ink">Individual payout</span>
          <span className="text-right font-medium text-ink">$0</span>
          <span className="font-medium text-ink">Ops cut</span>
          <span className="text-right font-medium text-ink">$0</span>
        </div>
        <p className="mt-4 text-xs text-ink-faint">
          The Treasury underwrites long-horizon runway; the Liquidity
          Pool slice structurally manufactures $BUILD token value. While
          the cooperative is still pre-salary, hosting + tooling + legal
          come out of contract revenue, not your donation — every
          donated dollar goes into the war chest instead of subsidizing
          today&apos;s ops bill. None of it pays an individual
          contributor — that&apos;s the whole point of the &quot;not for
          sale&quot; framing.
        </p>
      </Card>

      <Link
        href="/whitelist"
        className="mt-8 inline-block rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta"
      >
        Back to whitelist
      </Link>
    </div>
  );
}
