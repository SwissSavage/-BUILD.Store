/**
 * /governance — cooperative governance framework index.
 *
 * The system, simplified for readers who want to understand how FM
 * actually operates without wading through the full policy set.
 * Complements /policies (formal artifacts) and /trust (procurement-
 * facing security). Cross-references to the full specifications when
 * the summary here isn't enough.
 *
 * Structure mirrors the Venture Labor OS constellation nodes so
 * hovering the map and clicking through here land on the same
 * mental model.
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { VentureLaborConstellation } from "@/components/VentureLaborConstellation";

export default function GovernancePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Governance</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        The Venture Labor OS
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Owners ship better work than renters. The upside belongs to the
        people who shipped it. Provenance, Discernment, Equity.
      </p>

      <div className="mt-8">
        <VentureLaborConstellation />
      </div>

      {/* Section 1 · Tier Ladder */}
      <Section
        eyebrow="Tier ladder"
        id="tier"
        title="Viewer → Prospect → Partner → Member"
        body={
          <>
            <p>
              Four tiers. Contribution and vouching. No tier for sale.
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-sm text-ink-muted list-disc">
              <li>
                <strong className="text-ink">Viewer</strong> —
                unauthenticated public. Sees marketing surfaces, open
                RFPs, published showcase, policies, trust page.
              </li>
              <li>
                <strong className="text-ink">Prospect</strong> — signed
                up. Can manage own profile, opt in/out of Tier-2 data
                participation, apply toward Partner status.
              </li>
              <li>
                <strong className="text-ink">Partner</strong> — vetted
                counterparty. Limited-scope EPK. Discovery-hidden by
                default; recognition unlocks a discovery window.
              </li>
              <li>
                <strong className="text-ink">Member</strong> — full
                cooperator. Sees the internal directory, calendar,
                activity feed. Full MVP score visibility. Co-brand
                rights. Canonization at year end.
              </li>
            </ul>
          </>
        }
        links={[
          { label: "Cooperative Covenant", href: "/policies/covenant" },
          { label: "Privacy Policy", href: "/policies/privacy" },
        ]}
      />

      {/* Section 2 · Covenant */}
      <Section
        eyebrow="Covenant"
        id="covenant"
        title="The commitments every Member makes"
        body={
          <>
            <p>
              Deliver. Communicate. Route through the platform. Give
              honest peer review. Respect confidentiality.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Each carries a consequence — compliance penalty, or
              expulsion per bylaws.
            </p>
          </>
        }
        links={[
          { label: "Full covenant", href: "/policies/covenant" },
        ]}
      />

      {/* Section 3 · MVP Score */}
      <Section
        eyebrow="Standing"
        id="mvp"
        title="MVP Score — 0-99 OVR, updated daily"
        body={
          <>
            <p>
              Seven sub-ratings: quality, outcomes, reliability, hustle,
              collaboration, attendance, referrals + BD. Twelve-month
              rolling, weighted recent.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Bands: 90+ Champion&apos;s Court eligible. 75-89 Promotion
              eligible. 65-74 Good standing. Below 65 Probation. New
              Members: provisional until promotion.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Decline surfaces inside a quarter. Recovery works the same.
            </p>
          </>
        }
        links={[
          { label: "See MVP mechanics in the covenant", href: "/policies/covenant#mvp" },
        ]}
      />

      {/* Section 4 · Compliance */}
      <Section
        eyebrow="Enforcement"
        id="compliance"
        title="Compliance ladder — real consequences, recorded"
        body={
          <>
            <p>
              Each violation:{" "}
              <strong className="text-ink">−9 OVR for 90 days</strong>,
              stacking. Three inside 90 days: probation.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Admin-recorded with reason on the audit log. Rescission
              available, also audit-logged. Arbitration available on
              disputed penalties.
            </p>
          </>
        }
        links={[
          { label: "Trust &amp; security", href: "/trust" },
          { label: "Audit log (admin)", href: "/admin/audit-log" },
        ]}
      />

      {/* Section 5 · Recognition Rails */}
      <Section
        eyebrow="Recognition"
        id="recognition"
        title="Three surfaces, all metric-driven"
        body={
          <>
            <ul className="space-y-2 pl-5 text-sm text-ink-muted list-disc">
              <li>
                <strong className="text-ink">
                  Future Modernist of the Month
                </strong>{" "}
                — metric shortlist + admin editorial pick (Phase 1) or
                Member vote (Phase 2, gated on membership count). Open
                to Members and Partners. Unlocks a public-discovery
                window for Partners.
              </li>
              <li>
                <strong className="text-ink">Constellation of the Year</strong>{" "}
                — annual cohort of Members who held Champion&apos;s
                Court standing during the year.
              </li>
              <li>
                <strong className="text-ink">Champion&apos;s Court</strong>{" "}
                — top 10% of Members at OVR ≥ 90. Refreshes daily.
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink-muted">
              Members co-brand with FM. Recognized Partners get a
              featured window at reduced weight. Full weight is for
              Members.
            </p>
          </>
        }
        links={[
          { label: "Recognition mechanics in covenant", href: "/policies/covenant#recognition" },
        ]}
      />

      {/* Section 6 · Compensation */}
      <Section
        eyebrow="Money — talent side"
        id="compensation"
        title="Base pay guaranteed. Performance ceiling gated."
        body={
          <>
            <p>
              Every quote: base and ceiling. Base pays. Ceiling releases
              on a quality gate.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Gate: client rating ≥ 4/5. Fallback: PM rating (60%) +
              peer composite (40%) ≥ 4. Reclaimed ceilings feed the
              Engagement Recovery Pool.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              The client never sees the gate. Talent conditioning, not a
              price lever.
            </p>
          </>
        }
        links={[
          { label: "How compensation works (member docs)", href: "/policies/covenant" },
        ]}
      />

      {/* Section 7 · Revenue Model */}
      <Section
        eyebrow="Money — cooperative side"
        id="revenue"
        title="85 / 12 / 3 split, disclosed"
        body={
          <>
            <p>Every cooperative-collected dollar:</p>
            <ul className="mt-2 space-y-1 pl-5 text-sm text-ink-muted list-disc">
              <li>
                <strong className="text-ink">85%</strong> to the
                contributor pool (talent + admin pool per contract).
              </li>
              <li>
                <strong className="text-ink">12%</strong> to reserve —
                subdivides for treasury, LP for the token rail, and
                cooperative benefits (health fund, sabbatical, etc.).
              </li>
              <li>
                <strong className="text-ink">3%</strong> to admin
                operations.
              </li>
            </ul>
            <p className="mt-3 text-sm text-ink-muted">
              Disclosed on every contract. Members see the split on
              wallet history in compStage detail. No silent skim.
            </p>
          </>
        }
        links={[
          { label: "Talent Data Agreement", href: "/data-use-policy" },
        ]}
      />

      {/* Section 8 · Canonization */}
      <Section
        eyebrow="Year-end ritual"
        id="canonization"
        title="Annual canonization — ERC-721 + ERC-6551"
        body={
          <>
            <p>
              End of every calendar year, each active Member (plus every
              Partner who held a recognition that year) mints a
              canonization card. ERC-721 NFT with an ERC-6551 token-
              bound account — a wallet for that Member&apos;s year.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Tier locks to the year-end rarity band (gray probation,
              green good standing, blue promotion eligible, magenta
              Future Modernist, gold-holographic Champion). The card
              holds $BUILD allocated that year, wrapped recognition
              NFTs, cooperative artifacts collected, and voting weight
              from the cohort.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Phygital versions become a marketplace product class —
              Members buy their own at near-cost; outsiders buy as
              collectibles at market rate.
            </p>
            <p className="mt-3 text-sm italic text-ink-muted">
              Canon starts at zero. First real canonization at the end
              of the first full calendar year. No retroactive standing.
            </p>
          </>
        }
        links={[
          { label: "Canonization detail (admin)", href: "/admin/mvp/canonization" },
        ]}
      />

      {/* How the framework changes */}
      <Section
        eyebrow="Change process"
        id="change"
        title="How the framework changes"
        body={
          <>
            <p>
              Covenant, MVP mechanic, recognition rails, compensation,
              revenue split — all change on Member vote. Posted 30 days
              before.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Governance weight: the token-weighted balance in each
              Member&apos;s annual canonization TBA. Every change
              audit-logged with proposal, vote results, effective date.
            </p>
          </>
        }
        links={[
          { label: "Compliance dashboard (admin)", href: "/admin/compliance" },
        ]}
      />

      {/* Full policy library */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Policy library
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Formal documents:{" "}
          <Link
            href="/policies"
            className="text-brand-magenta hover:underline"
          >
            /policies
          </Link>
          . Security:{" "}
          <Link href="/trust" className="text-brand-magenta hover:underline">
            /trust
          </Link>
          .
        </p>
      </section>

      <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-xs text-ink-muted">
        <p>
          Version 0.1 · Last reviewed 2026-07-01 · Sandbox draft. Shape
          locked. Wording lands with counsel review + Member counter-
          signature at production.
        </p>
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  id,
  title,
  body,
  links,
}: {
  eyebrow: string;
  id: string;
  title: string;
  body: React.ReactNode;
  links?: { label: string; href: string }[];
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-8">
      <Card>
        <CardEyebrow>{eyebrow}</CardEyebrow>
        <CardTitle className="mt-2 text-2xl">{title}</CardTitle>
        <div className="mt-3 text-sm text-ink">
          {body}
        </div>
        {links && links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
