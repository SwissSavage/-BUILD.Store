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
        How the cooperative operates
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Eight interlocking systems. Written for anyone deciding whether
        to join the cooperative or work with it. Each section links to
        the full specification where the sandbox draft lives.
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
              Four tiers, real progression. Access is tied to
              contribution and vouching, not payment. There is no tier
              you can pay to skip into — that&apos;s the rule, not a
              marketing line.
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
              Deliver what you agreed to. Communicate at least weekly.
              Route client relationships through the platform. Give
              honest peer review. Respect confidentiality.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              These are not aspirations. Each carries a defined
              consequence — usually a compliance penalty (see below)
              or, in severe cases, expulsion via bylaw mechanism.
            </p>
          </>
        }
        links={[
          { label: "Read the full covenant", href: "/policies/covenant" },
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
              A composite score across seven sub-ratings: quality,
              outcomes, reliability, hustle, collaboration, attendance,
              referrals + business development. Twelve-month rolling
              window, weighted toward recent work.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Bands: 90+ Champion&apos;s Court eligible. 75-89
              Promotion eligible. 65-74 Good standing. Below 65
              Probation. New Members carry a provisional state (no OVR
              surfaced) until they cross the promotion threshold.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              The point of a real-time score is that decline is
              recognized as it happens — not after a year of slow
              damage. Recovery is the same: consistent contribution
              rebuilds the number.
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
              Each covenant violation triggers a compliance penalty:{" "}
              <strong className="text-ink">−9 OVR for 90 days</strong>,
              stacking. Three penalties inside 90 days moves a
              middle-band Member into probation.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Every penalty is admin-recorded with the reason preserved
              on the immutable audit log. Members can access the
              cooperative arbitration process if they believe a penalty
              is mistaken.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Rescission is available and itself audit-logged.
              Everything about the mechanic is legible to the Member it
              affects and to the admin team.
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
                — metric-driven shortlist plus admin editorial pick
                (Phase 1) or Member vote (Phase 2, gated on membership
                count). Open to Members and Partners. Recognition
                unlocks a public-discovery window for Partners.
              </li>
              <li>
                <strong className="text-ink">Constellation of the Year</strong>{" "}
                — annual cohort of Members who held Champion&apos;s
                Court standing during the year.
              </li>
              <li>
                <strong className="text-ink">Champion&apos;s Court</strong>{" "}
                — standing tier for the top 10% at OVR ≥ 90. Refreshes
                every daily compute.
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink-muted">
              Members can co-brand with FM. Recognized Partners get a
              featured window but not equivalent co-brand weight — the
              cooperative reserves that for full Members.
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
              Every talent quote carries two numbers: a base and a
              ceiling. The base is anchored to the low end of asking
              and pays regardless. The ceiling — the difference between
              base and upper — releases only when the engagement clears
              a quality gate.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Canonical gate: client rating ≥ 4 out of 5. Fallback when
              client didn&apos;t rate: PM engagement rating (60% weight) +
              peer review composite (40% weight) ≥ 4. Reclaimed ceilings
              feed the Engagement Recovery Pool for the cooperative.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              The client never sees the gate. This is a talent-side
              conditioning tool, not a client-facing price lever.
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
            <p>
              Of every cooperative-collected dollar:
            </p>
            <ul className="mt-2 space-y-1 pl-5 text-sm text-ink-muted list-disc">
              <li>
                <strong className="text-ink">85%</strong> to the
                contributor pool (talent + admin pool per contract).
              </li>
              <li>
                <strong className="text-ink">12%</strong> to the
                cooperative reserve, which subdivides for treasury,
                liquidity provisioning for the token rail, and
                cooperative benefits (health-fund, sabbatical, etc.).
              </li>
              <li>
                <strong className="text-ink">3%</strong> to admin
                operations for platform costs.
              </li>
            </ul>
            <p className="mt-3 text-sm text-ink-muted">
              The split is disclosed at engagement start on every
              contract. Members see it on their wallet history in
              compStage detail (base + released bonus + reclaimed
              bonus). No silent skim, no admin discretion after the
              fact.
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
              At the end of every calendar year, each active Member
              (and every Partner who held a recognition during the
              year) mints a canonization card. The card is an ERC-721
              NFT with an ERC-6551 token-bound account — it functions
              as a wallet for the Member&apos;s year.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Tier locks to the Member&apos;s rarity band at year-end
              (gray probation, green good standing, blue promotion
              eligible, magenta Future Modernist, gold-holographic
              Champion). The card holds their $BUILD allocation from
              that year, their wrapped recognition NFTs, cooperative
              artifacts they collected, and voting weight from that
              cohort.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Physical (phygital) versions become a marketplace product
              class — Members buy their own at near-cost; outsiders buy
              cards as collectibles at market rate.
            </p>
            <p className="mt-3 text-sm italic text-ink-muted">
              Cooperative canon starts at zero. The first real
              canonization runs at the end of the cooperative&apos;s
              first full calendar year of operation. No retroactive
              canon — that would invent standing nobody earned.
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
              Changes to the covenant, MVP mechanic, recognition rails,
              compensation structure, or revenue split require Member
              vote. Proposed changes are posted at least 30 days before
              the vote so Members can read, discuss, and weigh in.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Governance weight is the token-weighted balance held in
              each Member&apos;s annual canonization TBA (production
              rail). Sandbox: admin proposes changes for testing; Phase
              2 wires the vote.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Every framework change is audit-logged with the proposal,
              the vote results, and the effective date.
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
          Full policy library
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          The framework above is the readable summary. The formal
          documents live at{" "}
          <Link
            href="/policies"
            className="text-brand-magenta hover:underline"
          >
            /policies
          </Link>{" "}
          — Privacy, Covenant, Subprocessor Registry, and more as they
          land. For procurement-oriented visitors, security posture is
          summarized at{" "}
          <Link href="/trust" className="text-brand-magenta hover:underline">
            /trust
          </Link>
          .
        </p>
      </section>

      <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-xs text-ink-muted">
        <p>
          Version 0.1 · Last reviewed 2026-07-01 · Sandbox draft. The
          framework&apos;s shape is locked; individual wording gets
          counsel review and Member counter-signature at production
          launch.
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
