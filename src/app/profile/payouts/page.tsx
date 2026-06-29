/**
 * Payout methods (Phase 1.5, revised 2026-04-22 per the payments pivot).
 *
 * Stripe Connect is OPT-IN, not the default. The cooperative's default
 * rail is Mercury — admins mark invoices received and then dispatch
 * contributor payouts by ACH from Mercury directly. That keeps Stripe's
 * per-transfer fee off every payout.
 *
 * Connect exists for cases where automated per-contract dispatch pulls
 * its weight:
 *   - CC-opt-in invoices (client paid on card, Connect routes the
 *     transfer without a manual step).
 *   - Phase 2.1 marketplace payouts (many small transactions, Mercury's
 *     manual flow doesn't scale).
 *
 * Three contributor states remain:
 *
 *   1. Not connected → default. Copy reassures the contributor that
 *      they can still be paid via Mercury ACH and that connecting is
 *      only needed for the cases above.
 *
 *   2. Connected but not finished → they started Stripe onboarding and
 *      bailed. Resume CTA brings them back.
 *
 *   3. Fully enabled → green check, lifetime paid via Stripe, recent
 *      Stripe-routed payout rows.
 *
 * Mercury-routed payouts appear on /profile/attribution alongside
 * Connect-routed rows — same MOCK_SPLITS table, just different
 * `stripeTransferId` vs a Mercury reference in `notes`.
 *
 * The "onboarding URL" in sandbox is just /profile/payouts/onboard — a
 * stand-in for the Stripe-hosted Express onboarding screens. Production
 * swaps in the real `accountLinks.create` URL.
 *
 * REPLACE WITH: real Stripe Connect Express integration:
 *   - Server action calls stripe.accounts.create({ type: "express" })
 *   - Then stripe.accountLinks.create({ refresh_url, return_url })
 *   - Webhook on `account.updated` reconciles `stripePayoutsEnabled`
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import {
  PAYOUT_STATUS_LABELS,
  type PayoutStatus,
} from "@/lib/types";
import {
  createConnectAccount,
  disconnectPayouts,
} from "@/lib/payouts-stub";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const PAYOUT_COLOR: Record<PayoutStatus, string> = {
  pending: "#5070F0",
  queued: "#5070F0",
  sent: "#007048",
  failed: "#E53E3E",
};

const POOL_LABEL: Record<string, string> = {
  contributor: "Delivery",
  admin: "Admin commission",
  reserve: "Reserve",
};

async function startConnect() {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const { onboardingUrl } = await createConnectAccount(user.id);
  // Stripe-hosted in production. Sandbox keeps the user in-app.
  redirect(onboardingUrl);
}

async function disconnect() {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  await disconnectPayouts(user.id);
  revalidatePath("/profile/payouts");
  revalidatePath("/profile");
}

export default async function PayoutsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const myPayouts = MOCK_SPLITS.filter((s) => s.recipientId === user.id).sort(
    (a, b) => {
      const aTime = a.payoutSentAt ?? a.decidedAt ?? "";
      const bTime = b.payoutSentAt ?? b.decidedAt ?? "";
      return bTime.localeCompare(aTime);
    },
  );
  const lifetimePaid = myPayouts
    .filter((s) => s.payoutStatus === "sent")
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const queuedCount = myPayouts.filter(
    (s) => s.payoutStatus === "queued" || s.payoutStatus === "pending",
  ).length;
  const failedCount = myPayouts.filter((s) => s.payoutStatus === "failed")
    .length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profile"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Profile
      </Link>

      <header className="mt-3">
        <CardEyebrow>Payout methods</CardEyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold">Payouts</h1>
        <p className="mt-2 text-ink-muted">
          You&apos;ll be paid out of the cooperative&apos;s Mercury account by
          default — that&apos;s the rail that doesn&apos;t cost the
          cooperative a per-transfer fee. Connecting Stripe is{" "}
          <strong>optional</strong>: it only matters if you want
          automated card-paid payouts to dispatch without a manual ACH step,
          or once Phase 2.1 marketplace payouts go live.
        </p>
      </header>

      {!user.stripeAccountId && <NotConnected />}
      {user.stripeAccountId && !user.stripePayoutsEnabled && (
        <OnboardingIncomplete accountId={user.stripeAccountId} />
      )}
      {user.stripeAccountId && user.stripePayoutsEnabled && (
        <Connected
          accountId={user.stripeAccountId}
          lifetimePaid={lifetimePaid}
          queuedCount={queuedCount}
          failedCount={failedCount}
        />
      )}

      <Card className="mt-6">
        <CardEyebrow>Recent payouts</CardEyebrow>
        <CardTitle className="mt-2">
          Across every contract you&apos;ve been paid on
        </CardTitle>
        {myPayouts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No payouts yet. Once a contract you contributed to settles,
            rows show up here with the same status the engine reports
            internally.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="py-2 text-left">Contract</th>
                <th className="py-2 text-left">Pool</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {myPayouts.map((s) => {
                const project = MOCK_PROJECTS.find(
                  (p) => p.id === s.contractId,
                );
                return (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--surface-border)]"
                  >
                    <td className="py-3">
                      <div className="font-medium">
                        {project?.title ?? s.contractId}
                      </div>
                      {s.stripeTransferId && (
                        <p className="mt-0.5 font-mono text-xs text-ink-faint">
                          {s.stripeTransferId}
                        </p>
                      )}
                      {s.notes && s.payoutStatus === "failed" && (
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "#E53E3E" }}
                        >
                          {s.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 text-xs text-ink-muted">
                      {POOL_LABEL[s.pool] ?? s.pool}
                    </td>
                    <td className="py-3 text-right font-medium">
                      ${Number(s.amount).toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${PAYOUT_COLOR[s.payoutStatus]}26`,
                          color: PAYOUT_COLOR[s.payoutStatus],
                        }}
                      >
                        {PAYOUT_STATUS_LABELS[s.payoutStatus]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-6">
        <CardEyebrow>How this is wired</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          For Mercury-routed payouts, your account/routing details live with
          the cooperative&apos;s ops admin (encrypted at rest, IP-allowlisted,
          2FA on writes) — same posture as a 1099 contractor at any agency.
          For Stripe-routed payouts, the only Stripe identifier on our
          database is your{" "}
          <code className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 text-xs">
            acct_*
          </code>{" "}
          token, which is useless without Stripe&apos;s own auth. We never
          touch a card PAN or full bank string. PCI scope stays SAQ-A.
        </p>
      </Card>

      {user.stripeAccountId && (
        <form action={disconnect} className="mt-6">
          <button
            type="submit"
            className="text-xs text-ink-faint hover:text-[var(--brand-magenta,#D828A0)]"
          >
            Disconnect Stripe Connect account
          </button>
        </form>
      )}
    </div>
  );
}

function NotConnected() {
  return (
    <div
      className="mt-8 rounded-2xl border border-[var(--surface-border)] border-l-4 bg-[var(--surface-elevated)] p-6"
      style={{ borderLeftColor: "#5070F0" }}
    >
      <CardEyebrow>Mercury ACH (default)</CardEyebrow>
      <CardTitle className="mt-2">
        You&apos;re paid through the cooperative — no setup required
      </CardTitle>
      <p className="mt-3 text-sm text-ink-muted">
        When a contract you&apos;re attributed to settles, the cooperative
        sends your share by ACH from our Mercury account. Confirm your
        banking details with admin once and it&apos;s on file for every
        future payout.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4">
        <CardEyebrow>Optional: connect Stripe</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Only needed if you want automated card-paid payouts to dispatch
          without admin intervention, or once the Phase 2.1 marketplace
          surfaces small per-transaction payouts. Stripe-hosted onboarding
          handles your KYC, 1099, and bank link — the cooperative never
          sees the underlying details.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex gap-2">
            <span className="text-brand-magenta">•</span>
            <span>
              <strong>Express, not Standard.</strong> The contributor experience
              stays under our brand — Stripe only hosts the KYC + tax surfaces.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-magenta">•</span>
            <span>
              <strong>Per-contract failure isolation.</strong> If one transfer
              fails (KYC lapse, account issue), it doesn&apos;t block payouts
              on other contracts.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-magenta">•</span>
            <span>
              <strong>Tax forms handled.</strong> Stripe issues your 1099-NEC
              at year-end based on lifetime payouts.
            </span>
          </li>
        </ul>
        <form action={startConnect} className="mt-5">
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-6 py-2.5 text-sm font-medium hover:bg-[var(--surface-elevated)]"
          >
            Opt into Stripe Connect →
          </button>
        </form>
      </div>
    </div>
  );
}

function OnboardingIncomplete({ accountId }: { accountId: string }) {
  return (
    <div
      className="mt-8 rounded-2xl border border-[var(--surface-border)] border-l-4 bg-[var(--surface-elevated)] p-6"
      style={{ borderLeftColor: "#5070F0" }}
    >
      <CardEyebrow>Onboarding incomplete</CardEyebrow>
      <CardTitle className="mt-2">Pick up where you left off</CardTitle>
      <p className="mt-3 text-sm text-ink-muted">
        Your Stripe Express account exists (
        <code className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-mono text-xs">
          {accountId}
        </code>
        ) but Stripe hasn&apos;t confirmed KYC + payouts are ready. Resume the
        hosted onboarding flow to finish — typically a couple of minutes if
        you have an ID and bank login handy.
      </p>
      <Link
        href={`/profile/payouts/onboard?acct=${accountId}`}
        className="mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-medium text-white"
        style={{ backgroundColor: "#5070F0" }}
      >
        Resume Stripe onboarding →
      </Link>
    </div>
  );
}

function Connected({
  accountId,
  lifetimePaid,
  queuedCount,
  failedCount,
}: {
  accountId: string;
  lifetimePaid: number;
  queuedCount: number;
  failedCount: number;
}) {
  return (
    <div
      className="mt-8 rounded-2xl border border-[var(--surface-border)] border-l-4 bg-[var(--surface-elevated)] p-6"
      style={{ borderLeftColor: "#007048" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardEyebrow>Payouts enabled</CardEyebrow>
          <CardTitle className="mt-2">You&apos;re all set</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Stripe Express account{" "}
            <code className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-mono text-xs">
              {accountId}
            </code>{" "}
            is fully onboarded. Future payouts dispatch automatically when
            contracts settle.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Stat
          label="Lifetime paid"
          value={`$${lifetimePaid.toLocaleString()}`}
          color="#007048"
        />
        <Stat label="Queued" value={String(queuedCount)} color="#5070F0" />
        <Stat
          label="Failed"
          value={String(failedCount)}
          color={failedCount > 0 ? "#E53E3E" : "#999999"}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-4">
      <div className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div
        className="mt-1 font-display text-xl font-semibold"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
