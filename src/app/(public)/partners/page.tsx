/**
 * Public partners directory.
 *
 * Three sections matching the canon partnership tiers:
 *   1. Service partners — signed-LOI co-delivery orgs.
 *   2. Ecosystem partners — infrastructure relationships.
 *   3. Product affiliates — referral-link relationships.
 *
 * All three render from `mock-data/partners.ts`. When CMS lands, the
 * three sections become three Payload collections; this page swaps to
 * the equivalent fetches without changing layout.
 */
import Link from "next/link";
import {
  ECOSYSTEM_PARTNERS,
  PRODUCT_AFFILIATES,
  SERVICE_PARTNERS,
} from "@/lib/mock-data/partners";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

/** Static-rendered. Partner rosters read from build-time mock stores. */
export const dynamic = "force-static";

export const metadata = {
  title: "Partners · $BUILD.Store",
  description:
    "External service, ecosystem, and product partnerships of the Future Modern cooperative.",
};

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <header>
        <div className="text-xs uppercase tracking-wider text-brand-magenta">
          $BUILD.Store
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
          The partner ecosystem
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Future Modern is the cooperative behind $BUILD.Store. The orgs
          below are external partners we co-deliver with, plug into, or
          earn alongside. Clients don&apos;t appear here. Members
          don&apos;t appear here. Just the network.
        </p>
      </header>

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold">
              Service partners
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Signed letters of intent for service co-delivery. When an
              engagement scope exceeds what FM staffs alone, we bring
              these partners onto the engagement under cooperative terms.
            </p>
          </div>
          <span className="text-xs text-ink-faint">
            {SERVICE_PARTNERS.length} signed
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_PARTNERS.map((p) => (
            <Card key={p.id}>
              <div className="flex items-baseline justify-between gap-2">
                <CardTitle className="text-lg">{p.name}</CardTitle>
                {p.shippedTogether && (
                  <span className="text-[10px] uppercase tracking-wider text-[#007048]">
                    Shipped together
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                {p.capabilities.map((cap) => (
                  <li key={cap}>{cap}</li>
                ))}
              </ul>
              {p.affiliateUrl && (
                <a
                  href={p.affiliateUrl}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="mt-4 inline-block text-xs hover:underline"
                  style={{ color: "#D828A0" }}
                >
                  Visit ↗
                </a>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold">
              Ecosystem partners
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Infrastructure and platform relationships. These aren&apos;t
              service providers. They&apos;re the rails the cooperative
              runs on, the cultural platforms our work travels through,
              and the funding networks that move capital toward member
              outcomes.
            </p>
          </div>
          <span className="text-xs text-ink-faint">
            {ECOSYSTEM_PARTNERS.length} integrations
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {ECOSYSTEM_PARTNERS.map((p) => (
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
            {PRODUCT_AFFILIATES.length} affiliates
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {PRODUCT_AFFILIATES.map((p) => (
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
        <CardEyebrow>Want to partner?</CardEyebrow>
        <CardTitle className="mt-1 text-2xl">
          We&apos;re selective on purpose.
        </CardTitle>
        <p className="mt-3 max-w-prose text-sm text-ink-muted">
          Future Modern co-delivers with orgs whose values and standards
          map to ours. If that sounds like you, get in touch through the
          channels below and we&apos;ll route you to the right person.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/about"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            About the cooperative
          </Link>
          <Link
            href="/signup"
            className="rounded-full px-4 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            $BUILD a team
          </Link>
        </div>
      </Card>
    </div>
  );
}
