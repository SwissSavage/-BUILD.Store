/**
 * Sandbox stand-in for Stripe-hosted Express onboarding (Phase 1.5).
 *
 * In production, the contributor never sees this page — the connect server
 * action redirects them to Stripe's hosted onboarding flow at
 * connect.stripe.com, where Stripe collects KYC + tax info + bank link, then
 * bounces them back to /profile/payouts with `details_submitted=true` after
 * the webhook fires.
 *
 * In the sandbox we render a faithful preview of what Stripe asks for so a
 * Future Modern reviewer can see the full flow without spinning up a real
 * Stripe account. The "Simulate completion" button calls the same
 * `markPayoutsEnabled` stub the production webhook would call, so all the
 * downstream state (payout dispatch, settle page eligibility, profile badge)
 * lights up exactly as it would after a real onboarding.
 *
 * REPLACE WITH: redirect to Stripe-hosted accountLinks URL. Delete this page
 * once the real flow is live; it's only here so the sandbox is end-to-end.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { markPayoutsEnabled } from "@/lib/payouts-stub";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

async function completeOnboarding() {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  await markPayoutsEnabled(user.id);
  revalidatePath("/profile");
  revalidatePath("/profile/payouts");
  redirect("/profile/payouts?onboarded=1");
}

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ acct?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.stripeAccountId) redirect("/profile/payouts");

  const { acct } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/profile/payouts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Payouts
      </Link>

      <Card className="mt-3" >
        <CardEyebrow>Sandbox preview</CardEyebrow>
        <CardTitle className="mt-2">
          Stripe-hosted onboarding (preview)
        </CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          In production this page is replaced by Stripe&apos;s own onboarding
          flow at <span className="font-mono">connect.stripe.com</span>. The
          contributor would complete KYC + tax info + bank linking there,
          then bounce back to /profile/payouts after Stripe&apos;s
          <code className="mx-1 rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-mono text-xs">
            account.updated
          </code>
          webhook fires.
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          We&apos;re mocking it here so the rest of the sandbox (payout
          dispatch, settle page, profile badge) can light up end-to-end.
        </p>
        {acct && (
          <p className="mt-3 font-mono text-xs text-ink-faint">
            Stripe account: {acct}
          </p>
        )}
      </Card>

      <Card className="mt-6">
        <CardEyebrow>What Stripe collects</CardEyebrow>
        <CardTitle className="mt-2">
          Identity verification (KYC)
        </CardTitle>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          <li>Legal name and date of birth</li>
          <li>Residential address (used for 1099 mailing if needed)</li>
          <li>SSN or EIN (last four shown on every screen, never to us)</li>
          <li>
            Government ID upload (driver&apos;s license, passport, or
            equivalent) — Stripe runs this through its identity provider
          </li>
        </ul>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Bank linking</CardEyebrow>
        <CardTitle className="mt-2">Where your payouts land</CardTitle>
        <ul className="mt-3 space-y-2 text-sm text-ink-muted">
          <li>
            Routing + account number (typed, or via Plaid Link if your bank
            supports it). Stripe stores this; we never see it.
          </li>
          <li>Default payout schedule: standard ACH (2 business days).</li>
          <li>
            Optional: instant payouts via debit card (Stripe&apos;s 1% fee
            applies — opt-in only).
          </li>
        </ul>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Tax</CardEyebrow>
        <CardTitle className="mt-2">1099-NEC at year-end</CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          Stripe issues your 1099-NEC automatically based on your lifetime
          payouts through the cooperative. You&apos;ll get a copy in your
          Stripe dashboard each January, plus paper if you&apos;ve opted in.
        </p>
      </Card>

      <div
        className="mt-8 rounded-2xl border border-[var(--surface-border)] border-l-4 bg-[var(--surface-elevated)] p-6"
        style={{ borderLeftColor: "#007048" }}
      >
        <CardTitle>Sandbox shortcut</CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          Click below to mark this account as fully onboarded —
          equivalent to Stripe&apos;s post-KYC webhook firing in production.
          Your{" "}
          <code className="rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-mono text-xs">
            stripePayoutsEnabled
          </code>{" "}
          flag flips to true, payouts unlock, and the next contract you settle
          will dispatch transfers to this account.
        </p>
        <form action={completeOnboarding} className="mt-5">
          <button
            type="submit"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Simulate completion ✓
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Sandbox only. The button above is a stand-in for Stripe&apos;s
        production
        <code className="mx-1 rounded bg-[var(--surface-inset)] px-1.5 py-0.5">
          account.updated
        </code>
        webhook handler. Delete this entire page once real Stripe Connect
        is wired in.
      </p>
    </div>
  );
}
