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
import { Faq, type FaqItem } from "@/components/Faq";
import { DefinedTermSchema } from "@/components/DefinedTermSchema";
import { getEntriesForPage } from "@/lib/glossary";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

/**
 * Static-rendered. Constellation is a client component that hydrates
 * after paint; the surrounding page is pure content.
 */

export default function GovernancePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* DefinedTerm JSON-LD for every canonical term authoritatively
          defined on this page. See /glossary for the full index. */}
      <DefinedTermSchema
        entries={getEntriesForPage("/governance")}
        pageUrl={`${SITE_URL}/governance`}
      />
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
        title="Viewer → Partner → Member"
        body={
          <>
            <p>
              Three tiers. Contribution and vouching. No tier for sale.
            </p>
            <ul className="mt-3 space-y-1 pl-5 text-sm text-ink-muted list-disc">
              <li>
                <strong className="text-ink">Viewer:</strong>{" "}
                unauthenticated public + anyone signed up but not yet
                vouched. Sees marketing surfaces, open RFPs, published
                showcase, policies, trust page; can manage own profile
                and opt in/out of Tier-2 data participation.
              </li>
              <li>
                <strong className="text-ink">Partner:</strong> vetted
                counterparty and active revenue-sharing contributor.
                Limited-scope EPK. Discovery-hidden by default;
                recognition unlocks a discovery window. Votes in the
                Partner body on operational governance.
              </li>
              <li>
                <strong className="text-ink">Member:</strong> full
                builder and cooperative steward. Sees the internal
                directory, calendar, activity feed. Full MVP score
                visibility. Co-brand rights. Canonization at year
                end. Votes in both bodies; carries treasury, covenant,
                and ratification voice on structural decisions.
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
              Each carries a consequence. Compliance penalty, or
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
        title="MVP Score. 0-99 OVR, updated daily."
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
        title="Compliance ladder. Real consequences, recorded."
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
                  Future Modernist of the Month:
                </strong>{" "}
                metric shortlist + admin editorial pick while the
                cooperative is small. Member vote once the voting
                Membership is large enough to make the outcome
                meaningful. Open to Members and Partners. Unlocks a
                public-discovery window for Partners.
              </li>
              <li>
                <strong className="text-ink">Constellation of the Year:</strong>{" "}
                annual cohort of Members who held Champion&apos;s
                Court standing during the year.
              </li>
              <li>
                <strong className="text-ink">Champion&apos;s Court:</strong>{" "}
                top 10% of Members at OVR ≥ 90. Refreshes daily.
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
        eyebrow="Money · talent side"
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
        eyebrow="Money · cooperative side"
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
                <strong className="text-ink">12%</strong> to reserve.
                Subdivides for treasury, LP for the token rail, and
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
        title="Annual canonization. ERC-721 + ERC-6551."
        body={
          <>
            <p>
              End of every calendar year, each active Member (plus every
              Partner who held a recognition that year) mints a
              canonization card. ERC-721 NFT with an ERC-6551 token-
              bound account. A wallet for that Member&apos;s year.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Tier locks to the year-end rarity band (gray probation,
              green good standing, blue promotion eligible, magenta
              Future Modernist, gold-holographic Champion). The card
              holds the $BUILD allocated that year, wrapped
              recognition NFTs, and cooperative artifacts collected
              from the cohort. On-chain provenance of a Member&apos;s
              year — not a vote-weight multiplier. Governance stays
              one-person-one-vote in each chamber.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Phygital versions become a marketplace product class.
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

      {/* Bicameral voting model */}
      <Section
        eyebrow="Voting"
        id="voting"
        title="Bicameral. One person, one vote per body."
        body={
          <>
            <p>
              Two chambers. Both one-person-one-vote in their own
              body. Token holdings do not weight votes — anti-whale
              at the governance layer.
            </p>
            <ul className="mt-3 space-y-2 pl-5 text-sm text-ink-muted list-disc">
              <li>
                <strong className="text-ink">Partner body</strong> —
                operational governance. Matching policy, project
                selection rules, admin approvals, RFP acceptance
                criteria, moderator selection, cohort spotlights.
                Working contributors get voice on how the work runs.
              </li>
              <li>
                <strong className="text-ink">Member body</strong> —
                existential governance. Treasury allocation, covenant
                amendments, tier structure changes, Member admissions,
                direction pivots. Also ratifies structural changes
                sent up from the Partner body.
              </li>
            </ul>
          </>
        }
        links={[
          { label: "Compliance dashboard (admin)", href: "/admin/compliance" },
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
              Operational rules — matching, RFP flow, moderator
              selection — change on Partner-body vote. Existential
              rules — covenant, MVP mechanic, recognition rails,
              compensation, revenue split — change on Member-body
              vote. Proposals posted 30 days before either vote.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Every change audit-logged with proposal, vote results,
              effective date. On-chain provenance from each Member&apos;s
              canonization TBA gives transparency to contribution and
              standing — it is not itself a vote-weight multiplier.
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
            className="text-brand-magentaText hover:underline"
          >
            /policies
          </Link>
          . Security:{" "}
          <Link href="/trust" className="text-brand-magentaText hover:underline">
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

      <div className="mt-16 -mx-6">
        <FaqSection />
      </div>
    </div>
  );
}

/**
 * Governance FAQ — the mechanics questions a serious reader lands with
 * after the framework diagram + tier ladder. Different angle from the
 * about-page FAQ (which is model-level) and the landing FAQ (which is
 * objection-handling).
 */
function FaqSection() {
  const items: FaqItem[] = [
    {
      question: "How does the MVP score actually work?",
      answer:
        "Every active Member carries an OVR (0-99) computed from seven sub-ratings: quality, outcomes, reliability, hustle, collaboration, attendance, referrals + BD. Twelve-month rolling window, weighted to recent work. Provisional new Members don't carry a public OVR until they cross the promotion threshold. Roughly three completed engagements plus two peer reviews received.\n\nBands: 90+ Champion's Court eligible. 75-89 promotion eligible. 65-74 good standing. Below 65 probation. Standing refreshes with each daily compute.",
    },
    {
      question: "What triggers a compliance penalty?",
      answer:
        "Covenant violations: missed milestones without communication, silence when the cooperative needs a signal, direct-hire circumvention around the platform, dishonest peer review, breach of client-privileged confidentiality. Each penalty is -9 OVR for 90 days, stacking.\n\nThe math is deliberate: three penalties inside 90 days moves a middle-band Member into probation; four moves them toward removal. Real-time impact. No slow decline that only surfaces after a year of accumulated damage.",
    },
    {
      question: "How does Champion's Court work?",
      answer:
        "Top 10% of active Members AND OVR ≥ 90. Both gates apply. Refreshes with each daily compute. You can enter and leave depending on how the cooperative is performing that week. Champion's Court is the only tier that carries the gold holographic canonization card.\n\nAt year-end, every Member who held Champion's Court standing during the year enters the Constellation of that year. The annual canonization cohort minted permanently on-chain.",
    },
    {
      question: "What is annual canonization?",
      answer:
        "At the end of each calendar year, every active Member (and any Partner who held a recognition during the year) mints an ERC-721 canonization card with an ERC-6551 token-bound account. Tier locks to their year-end rarity band.\n\nThe first canonization runs at the end of the cooperative's first full calendar year of operation. No retroactive canon. Members don't receive credit for pre-launch work through the cooperative record. Retroactive minting would invent standing nobody earned through the system. That's the integrity floor.",
    },
    {
      question: "Do Partners and Members have the same voting rights?",
      answer:
        "Not exactly the same, but Partners do vote. Governance is bicameral: the Partner body votes on operational rules (matching, RFP flow, moderator selection, admin approvals, cohort spotlights) and the Member body votes on existential rules (treasury, covenant amendments, tier changes, direction pivots, admissions). Both bodies run one-person-one-vote inside their own chamber. Token holdings never weight the vote.\n\nThe rationale: contribution earns voice. A Partner is an active revenue-sharing contributor and deserves a say in how the work runs. But hard-to-reverse decisions need proven stewards — that is the Member body's job. This also gives progression from Partner to Member a real step-up in weight, not just a badge.",
    },
    {
      question: "Can the Covenant change?",
      answer:
        "Yes, by Member-body vote. The covenant is existential — hard to reverse, sets the terms everyone signs — so it routes through the Member body, not the Partner body. Proposed changes are posted at least 30 days before the vote so Members have time to read, discuss, and weigh in. Voting is one-person-one-vote; token holdings do not weight the vote.\n\nSandbox has admin-only proposal for testing. Production runs on the real vote.",
    },
  ];

  return (
    <Faq
      eyebrow="Common questions"
      heading="Governance mechanics"
      items={items}
    />
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
                className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
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
