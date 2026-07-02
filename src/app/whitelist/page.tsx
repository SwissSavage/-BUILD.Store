/**
 * Pre-launch whitelist (Phase 2.3 sandbox).
 *
 * Public-facing. Workers' cooperative posture: ACCESS IS NOT FOR SALE.
 * The page hosts three sections:
 *
 *   1. Hero — leads with "Not for sale" + the cooperative principle.
 *   2. How access is earned — three paths (invitation / application /
 *      contribution), no payment, no shortcut.
 *   3. Optional donation — voluntary support, no perks. 100% of every
 *      donation routes 50/50 to Treasury + Liquidity Pool via
 *      `previewDonationSplit()`. No ops slice for now — the founder +
 *      core team eat ops out of contract revenue while we build the
 *      war chest. Donors see the breakdown up-front.
 *   4. Custom build consultation — external client booking a scoping
 *      call. Becomes a normal contract intake, not access.
 *
 * REPLACE WITH: real Stripe Checkout sessions for cash donations, real
 * on-chain payment verification for crypto (listen for USDC Transfer
 * events to the cooperative treasury wallet). Webhook flips
 * status=initiated → paid; donation split routes the funds.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  MOCK_WHITELIST_TIERS,
  MOCK_WHITELIST_PURCHASES,
  MOCK_CONSULTATION_REQUESTS,
} from "@/lib/mock-data/whitelist";
import {
  INDUSTRY_LABELS,
  WHITELIST_RAIL_LABELS,
  type ConsultationRequest,
  type Industry,
  type WhitelistPurchase,
  type WhitelistRail,
} from "@/lib/types";
import { previewDonationSplit } from "@/lib/whitelist-splits";
import { grossUpForCard } from "@/lib/payments-fees";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { VentureLaborConstellation } from "@/components/VentureLaborConstellation";

const SCOPE_ORDER: Industry[] = ["stem", "creative-media", "professional-services"];

/**
 * Donation intake. Records a WhitelistPurchase row with `referrerId`
 * intentionally null — donations don't pay anyone individually. The
 * status workflow stays the same so admin can verify cash/crypto
 * landing, but the split engine routes 100% to the structural pools.
 */
async function initiateDonation(formData: FormData) {
  "use server";
  const tierId = String(formData.get("tierId") ?? "");
  const rail = String(formData.get("rail") ?? "cash") as WhitelistRail;
  const buyerName = String(formData.get("buyerName") ?? "").trim();
  const buyerEmail = String(formData.get("buyerEmail") ?? "").trim();

  const tier = MOCK_WHITELIST_TIERS.find((t) => t.id === tierId);
  if (!tier || !tier.isDonation) throw new Error("Invalid donation tier");
  if (!buyerName || !buyerEmail) {
    throw new Error("Name and email required.");
  }

  const current = await getCurrentUser();

  // Cash donations gross up so the 60/20/20 split routes the full
  // donor-intended amount; crypto skips Stripe entirely so no markup.
  // The split engine still runs against `amountUsd`, never the grossed
  // total — donors don't get less of their gift to the pools because
  // they paid by card.
  const subtotal = Number(tier.priceUsd);
  const processingFee =
    rail === "cash" ? grossUpForCard(subtotal).processingFee : 0;

  const purchase: WhitelistPurchase = {
    id: `wlp_${Date.now()}`,
    tierId,
    buyerId: current?.id ?? null,
    buyerEmail,
    buyerName,
    rail,
    amountUsd: tier.priceUsd,
    processingFee: processingFee.toFixed(2),
    stripePaymentIntentId:
      rail === "cash" ? `pi_mock_${Date.now()}` : null,
    cryptoTxHash: null, // set by wallet confirmation in production
    referrerId: null, // donations route 100% to structural pools, no payout
    status: "initiated",
    createdAt: new Date().toISOString(),
    paidAt: null,
    splitDistributedAt: null,
  };
  MOCK_WHITELIST_PURCHASES.push(purchase);
  revalidatePath("/whitelist");
  revalidatePath("/admin/whitelist");
  revalidatePath("/admin");
  redirect(`/whitelist/confirm?id=${purchase.id}`);
}

async function submitConsultation(formData: FormData) {
  "use server";
  const tier = MOCK_WHITELIST_TIERS.find((t) => t.isConsultation);
  if (!tier) throw new Error("Consultation tier unavailable");
  const scopeBuckets = SCOPE_ORDER.filter(
    (s) => formData.get(`scope_${s}`) === "on",
  );
  const request: ConsultationRequest = {
    id: `cr_${Date.now()}`,
    tierId: tier.id,
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    company: String(formData.get("company") ?? "").trim() || null,
    scopeBuckets,
    briefing: String(formData.get("briefing") ?? ""),
    budgetHint: String(formData.get("budgetHint") ?? "").trim() || null,
    status: "new",
    assignedTo: null,
    adminNote: null,
    createdAt: new Date().toISOString(),
  };
  MOCK_CONSULTATION_REQUESTS.push(request);
  revalidatePath("/whitelist");
  revalidatePath("/admin/whitelist");
  revalidatePath("/admin");
  redirect(`/whitelist/thanks?kind=consultation`);
}

export default function WhitelistPage() {
  const donationTiers = MOCK_WHITELIST_TIERS.filter(
    (t) => t.isDonation && t.active,
  );
  const consultation = MOCK_WHITELIST_TIERS.find((t) => t.isConsultation);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      {/* ───── Hero — "Not for sale" ───── */}
      <header>
        <div className="inline-block rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-brand-magenta">
          Not for sale
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
          Access to the cooperative is earned, never bought.
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-ink-muted">
          Future Modern is a workers&apos; cooperative. Standing inside it —
          Member, Partner, governance, the lot — exists for the people who
          contribute to the work. There is no tier you can pay to skip into.
          That&apos;s not a marketing line. It&apos;s the rule.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-ink-muted">
          We get asked, often, if there&apos;s a way to write a check and
          jump the line. There isn&apos;t. The exclusivity is part of the
          value — for cooperators and for the clients who hire them.
        </p>
      </header>

      {/* ───── Venture Labor OS constellation ───── */}
      <section className="mt-16">
        <CardEyebrow>The Venture Labor OS</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          Eight interlocking systems.
        </h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Standing, recognition, compensation, canonization, tier
          ladder, compliance, revenue split, covenant. Provenance,
          Discernment, Equity — as code.
        </p>
        <div className="mt-6">
          <VentureLaborConstellation />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/governance"
            className="rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-4 py-2 text-brand-magenta hover:bg-brand-magenta/20"
          >
            Read the governance framework →
          </Link>
          <Link
            href="/policies/covenant"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            Cooperative Covenant →
          </Link>
        </div>
      </section>

      {/* ───── How access is earned ───── */}
      <section className="mt-12">
        <CardEyebrow>How access is earned</CardEyebrow>
        <h2 className="mt-2 font-display text-3xl font-semibold">
          Three paths in. None of them include a checkout.
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Card>
            <div
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Path 1 · Invitation
            </div>
            <CardTitle className="mt-3 text-2xl">Invited by a cooperator</CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Someone already inside vouches for you. They take some
              reputational skin in the game when they do — that&apos;s
              the point. Quiet, reference-driven, no application form.
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              You&apos;ll know if this applies. If you&apos;re wondering
              whether you got invited, you didn&apos;t.
            </p>
          </Card>
          <Card>
            <div
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Path 2 · Application
            </div>
            <CardTitle className="mt-3 text-2xl">Apply with your work</CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Show us what you&apos;ve actually built or shipped. We
              don&apos;t care about the platform on it (we left those
              for a reason). We care about the work, the discipline,
              and the clients we&apos;d be putting you in front of.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-block rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta"
            >
              Start an application →
            </Link>
          </Card>
          <Card>
            <div
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
              style={{ backgroundColor: "#007048" }}
            >
              Path 3 · Contribution
            </div>
            <CardTitle className="mt-3 text-2xl">Contribute to a project</CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Pick up a piece of work on an open co-op initiative.
              Real work, paid to the same 85/12/3 split everyone else
              uses. Standing accrues from the ledger.
            </p>
            <p className="mt-2 text-xs text-ink-faint">
              No account needed to offer help — pick a project and
              there&apos;s a public form on the project page. Admin
              follows up by email.
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-block rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta"
            >
              See open projects →
            </Link>
          </Card>
        </div>
        <p className="mt-6 max-w-3xl text-xs text-ink-faint">
          The vibe we&apos;re building toward, if it helps to name it: Raya
          for the work, or Reddit without the algorithm-bait. Earned
          rooms. Signal over noise. Workers, not capitalists.
        </p>
      </section>

      {/* ───── Optional donation ───── */}
      {donationTiers.length > 0 && (
        <section className="mt-16">
          <CardEyebrow>Optional · does not grant access</CardEyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Want to back the work? You can donate.
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-ink-muted">
            Some folks have asked how to support the cooperative without
            becoming part of it — running a co-op costs money, and that
            generosity is meaningful. So there&apos;s a path. Read the
            fine print first:
          </p>
          <ul className="mt-3 max-w-3xl space-y-1 text-sm text-ink-muted">
            <li className="flex gap-2">
              <span className="text-brand-magenta">·</span>
              <span>
                A donation does <strong className="text-ink">not</strong>{" "}
                grant access, perks, standing, governance, or any future
                preferential treatment.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-magenta">·</span>
              <span>
                100% routes 50/50 to the Treasury + the Liquidity Pool.
                No individual payout. No ops cut. Every dollar compounds
                into long-horizon capital — the cooperative covers
                today&apos;s ops out of contract revenue.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-magenta">·</span>
              <span>
                Refundable inside 14 days, no questions asked.
              </span>
            </li>
          </ul>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {donationTiers.map((tier) => {
              const split = previewDonationSplit(Number(tier.priceUsd));
              const cashGross = grossUpForCard(Number(tier.priceUsd));
              return (
                <Card key={tier.id}>
                  <div
                    className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
                    style={{ backgroundColor: tier.accent }}
                  >
                    {tier.name}
                  </div>
                  <div className="mt-3 font-display text-3xl font-semibold">
                    ${Number(tier.priceUsd).toLocaleString()}
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{tier.blurb}</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
                    {tier.perks.map((perk) => (
                      <li key={perk} className="flex gap-2">
                        <span style={{ color: tier.accent }}>·</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs text-ink-muted">
                    <div className="font-medium text-ink">Where your donation goes</div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span>Treasury (50%)</span>
                      <span className="text-right">
                        ${split.treasury.toLocaleString()}
                      </span>
                      <span>Liquidity Pool (50%)</span>
                      <span className="text-right">
                        ${split.liquidityPool.toLocaleString()}
                      </span>
                      <span className="font-medium text-ink">Individual payout</span>
                      <span className="text-right font-medium text-ink">
                        $0
                      </span>
                      <span className="font-medium text-ink">Ops cut</span>
                      <span className="text-right font-medium text-ink">
                        $0
                      </span>
                    </div>
                  </div>

                  <form action={initiateDonation} className="mt-4 space-y-3">
                    <input type="hidden" name="tierId" value={tier.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs">
                        {WHITELIST_RAIL_LABELS.cash}
                        <input
                          type="radio"
                          name="rail"
                          value="cash"
                          defaultChecked
                          className="accent-brand-magenta"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs">
                        {WHITELIST_RAIL_LABELS.crypto}
                        <input
                          type="radio"
                          name="rail"
                          value="crypto"
                          className="accent-brand-magenta"
                        />
                      </label>
                    </div>
                    <input
                      name="buyerName"
                      required
                      placeholder="Your name"
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    />
                    <input
                      name="buyerEmail"
                      type="email"
                      required
                      placeholder="Email"
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-full py-2 text-xs font-medium text-white"
                      style={{ backgroundColor: tier.accent }}
                    >
                      Donate ${Number(tier.priceUsd).toLocaleString()} →
                    </button>
                    <p className="text-[10px] text-ink-faint">
                      No access granted. No perks. No payout. Just gratitude.
                      Card adds ${cashGross.processingFee.toFixed(2)} for
                      Stripe (covers the 2.9% + $0.30 fee so the
                      cooperative still nets the full $
                      {Number(tier.priceUsd).toLocaleString()}). Crypto
                      avoids the markup.
                    </p>
                  </form>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ───── Consultation ───── */}
      {consultation && (
        <section className="mt-16">
          <Card>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
                  style={{ backgroundColor: consultation.accent }}
                >
                  External client · custom build
                </div>
                <CardTitle className="mt-3 text-3xl">
                  Need a custom build? Book a scoping call.
                </CardTitle>
                <p className="mt-3 text-sm text-ink-muted">
                  {consultation.blurb}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
                  {consultation.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <span style={{ color: consultation.accent }}>·</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-ink-faint">
                  Scoping calls are free. You only pay after we agree on
                  scope and you approve the quote sheet — same intake any
                  contract uses.
                </p>
              </div>
              <form action={submitConsultation} className="space-y-3">
                <CardEyebrow>Book a scoping call</CardEyebrow>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="contactName"
                    required
                    placeholder="Name"
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                  />
                  <input
                    name="contactEmail"
                    type="email"
                    required
                    placeholder="Email"
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                  />
                </div>
                <input
                  name="company"
                  placeholder="Company (optional)"
                  className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
                <fieldset>
                  <legend className="text-[10px] uppercase tracking-wider text-ink-muted">
                    Scope buckets
                  </legend>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {SCOPE_ORDER.map((s) => (
                      <label
                        key={s}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-[11px]"
                      >
                        {INDUSTRY_LABELS[s]}
                        <input
                          type="checkbox"
                          name={`scope_${s}`}
                          className="accent-brand-magenta"
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <textarea
                  name="briefing"
                  required
                  rows={4}
                  placeholder="What are you trying to build? What does done look like?"
                  className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
                <input
                  name="budgetHint"
                  placeholder="Budget range (optional — helps triage)"
                  className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full rounded-full py-2 text-xs font-medium text-white"
                  style={{ backgroundColor: consultation.accent }}
                >
                  Request scoping call →
                </button>
              </form>
            </div>
          </Card>
        </section>
      )}

      {/* ───── FAQ ───── */}
      <Card className="mt-12">
        <CardEyebrow>Questions the desk gets</CardEyebrow>
        <div className="mt-3 space-y-3 text-sm text-ink-muted">
          <p>
            <strong className="text-ink">
              Can I pay to be a Member or Partner?
            </strong>{" "}
            No. Standing comes from invitation, application, or
            contribution. Donations buy you a thank-you, not a tier.
          </p>
          <p>
            <strong className="text-ink">
              Where exactly does my money go?
            </strong>{" "}
            50% to the Treasury (long-horizon runway) and 50% to the
            Liquidity Pool (the LP deposit is what structurally
            manufactures $BUILD token value instead of leaving it to
            market dynamics — non-negotiable). Zero to ops, zero to any
            individual. While we&apos;re still pre-salary, the founder
            and core team eat ops out of contract revenue. Donations
            are war-chest only — they should still be growing the
            cooperative&apos;s capital base years from now.
          </p>
          <p>
            <strong className="text-ink">
              Does the rail change what the cooperative receives?
            </strong>{" "}
            No. Either way, the full donor-intended amount routes to the
            60/20/20 pools. The difference is on the donor side: card
            charges add a small markup (Stripe&apos;s 2.9% + $0.30) so
            the cooperative isn&apos;t left short. Crypto skips Stripe
            entirely, so the donor pays exactly the donation amount with
            no markup.
          </p>
          <p>
            <strong className="text-ink">Can I refund?</strong> Yes —
            14-day refund window, no reason required. Funds stay
            unallocated during the window so nothing&apos;s already been
            spent against your donation.
          </p>
          <p>
            <strong className="text-ink">
              Why not just sell access? It would be easier.
            </strong>{" "}
            Easier for whom. The whole point of the cooperative is that
            the people doing the work own the value they create. Selling
            access would erode that on day one.
          </p>
        </div>
      </Card>
    </div>
  );
}
