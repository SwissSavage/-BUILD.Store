/**
 * Public partners directory — product-side surface.
 *
 * Two sections:
 *   1. SaaS Partners — software products the cooperative endorses +
 *      earns referral revenue from (formerly "Ecosystem partners" in
 *      the schema; kept the underlying table name for now).
 *   2. Product Affiliates — non-software referral relationships.
 *
 * Service Partners (signed-LOI co-delivery orgs) are internal
 * reference and no longer render here — they belong to admin ops,
 * not the public product-partners surface.
 *
 * IMPORTANT — naming boundary (locked 2026-07-30): this page is for
 * PRODUCTS, not PEOPLE. Talent Partners (the cooperative membership
 * tier) never appear here because they're not products. Talent
 * belongs on /team. Product-based businesses belong here. The
 * "Partner" collision is preempted by the product-first framing.
 */
import Link from "next/link";
import {
  ecosystemPartnerReader,
  productAffiliateReader,
  safely,
} from "@/lib/readers";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

/** Static-rendered. Partner rosters read from build-time mock stores. */

export const metadata = {
  title: "Partners · $BUILD.Store",
  description:
    "SaaS partners and product affiliates the Future Modern cooperative endorses. Product-side surface — talent members live on /team.",
};

export default async function PartnersPage() {
  const [ecosystem, affiliates] = await Promise.all([
    safely(() => ecosystemPartnerReader.all(), []),
    safely(() => productAffiliateReader.all(), []),
  ]);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <header>
        <div className="text-xs uppercase tracking-wider text-brand-magenta">
          $BUILD.Store
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
          Products in the ecosystem
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Future Modern is the cooperative behind $BUILD.Store. This
          page is for <strong>products</strong> — SaaS tools we&apos;ve
          endorsed and physical / referral products cooperative members
          use. Talent members live on{" "}
          <Link
            href="/team"
            className="text-brand-magenta hover:underline"
          >
            /team
          </Link>
          ; clients never appear here. Just the product network.
        </p>
      </header>

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold">
              SaaS Partners
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Software products the cooperative endorses and earns
              referral revenue from. Each carries a documented
              referral relationship — when a member or client engages
              through our link, attribution flows back to the coop.
            </p>
          </div>
          <span className="text-xs text-ink-faint">
            {ecosystem.length} products
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {ecosystem.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4"
            >
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-ink-muted">{p.role}</p>
              {p.affiliateUrl && (
                <a
                  href={p.affiliateUrl}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="mt-2 inline-block text-[11px] hover:underline"
                  style={{ color: "#5070F0" }}
                >
                  Visit ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold">
              Product affiliates
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Referral relationships. When a tool genuinely helps a
              cooperative member move faster, we recommend it and
              transparently take a kickback. Disclosed by design.
            </p>
          </div>
          <span className="text-xs text-ink-faint">
            {affiliates.length} affiliates
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {affiliates.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4"
            >
              <h3 className="text-sm font-semibold">{p.name}</h3>
              {p.affiliateUrl && (
                <a
                  href={p.affiliateUrl}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="mt-2 inline-block text-[11px] hover:underline"
                  style={{ color: "#007048" }}
                >
                  Visit ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <Card className="mt-16 border-[#D828A0]/40">
        <CardEyebrow>Have a product?</CardEyebrow>
        <CardTitle className="mt-1 text-2xl">
          We list products, not people.
        </CardTitle>
        <p className="mt-3 max-w-prose text-sm text-ink-muted">
          This page is for products the cooperative endorses under a
          documented referral relationship. If you have a SaaS tool,
          physical product, or infrastructure play that lines up with
          the cooperative&apos;s posture, get in touch and we&apos;ll
          route you to the right admin for a review. If you&apos;re
          looking to join as a Builder,{" "}
          <Link
            href="/signup"
            className="text-brand-magenta hover:underline"
          >
            apply here
          </Link>{" "}
          — talent belongs on the team roster, not the product list.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/about"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            About the cooperative
          </Link>
          <Link
            href="/team"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Talent roster
          </Link>
        </div>
      </Card>
    </div>
  );
}
