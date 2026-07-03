/**
 * /policies/covenant — Cooperative Covenant sandbox draft.
 *
 * The behavior expected of every Member and Partner, and the
 * consequences for departing from it. Public route because the
 * cooperative wants outsiders to see the terms of participation
 * before they decide to enter — this is a screening tool as much as
 * a governance document.
 *
 * SOC 2 CC1.1 evidence path (control environment / integrity + ethical
 * values). Sourced from _memory/legal.md and _memory/future-modern.md.
 */
import Link from "next/link";
import { CardEyebrow } from "@/components/Card";

export default function CovenantPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Policy</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Cooperative Covenant
      </h1>
      <p className="mt-2 text-xs text-ink-faint">
        Version 0.1 · Last reviewed 2026-07-01 · Sandbox draft
      </p>

      <div
        className="mt-6 rounded-2xl border px-5 py-4"
        style={{
          borderColor: "rgba(80, 112, 240, 0.35)",
          backgroundColor: "rgba(80, 112, 240, 0.06)",
        }}
      >
        <p
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "#5070F0" }}
        >
          Sandbox draft
        </p>
        <p className="mt-1 text-sm text-ink">
          Working draft. Production version carries counsel review and a
          signed effective-date footer counter-signed by the founding
          Members.
        </p>
      </div>

      <section className="mt-8 space-y-6 text-sm text-ink-muted">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            What the cooperative is for
          </h2>
          <p className="mt-2">
            $BUILD.Store is a shared professional infrastructure owned
            and operated by its Members. It exists to make it possible
            to do serious, well-compensated creative and technical work
            without surrendering the upside to an employer, a
            marketplace platform, or a private-equity aggregator. The
            Covenant is the shared operating agreement that keeps the
            cooperative worth belonging to.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Governance principle: flat governance, hierarchical relationships
          </h2>
          <p className="mt-2">
            Every Member has one voice in governance. Relationships
            inside project teams and client engagements are hierarchical
            when the work requires it — someone owns delivery, someone
            owns account, someone owns direction — but that hierarchy is
            confined to the engagement. Governance is not for sale, and
            leadership on one project confers no permanent authority
            over another.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            What every Member commits to
          </h2>
          <ul className="mt-2 space-y-2 pl-6">
            <li>
              <strong className="text-ink">Deliver work you agreed to.</strong>{" "}
              Missing milestones without communication is the number-one
              trigger for the compliance ladder below.
            </li>
            <li>
              <strong className="text-ink">Communicate at least weekly.</strong>{" "}
              Silence is a signal, and the cooperative reads it. Say
              you&apos;re heads-down, say you&apos;re stuck, say you&apos;re
              overextended — just say something.
            </li>
            <li>
              <strong className="text-ink">Route through the platform.</strong>{" "}
              Client relationships originated through the cooperative
              stay on the cooperative. Direct-hire circumvention is a
              covenant violation.
            </li>
            <li>
              <strong className="text-ink">Give peer review honestly.</strong>{" "}
              The MVP score depends on peer input being useful, not
              polite. Ratings that don&apos;t match the work devalue the
              system for everyone.
            </li>
            <li>
              <strong className="text-ink">Respect the confidentiality
              stance.</strong> Members see each other. Outsiders see what
              Members choose to publish. Client-privileged information
              stays with the engagement.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            MVP score — how standing is measured
          </h2>
          <p className="mt-2">
            Every active Member carries an OVR (0-99) computed from
            seven sub-ratings: quality, outcomes, reliability, hustle,
            collaboration, attendance, referrals + BD. Twelve-month
            rolling window, weighted to recent work. Provisional new
            Members do not carry a public OVR until they cross the
            promotion threshold (roughly three completed engagements +
            two peer reviews received).
          </p>
          <p className="mt-2">
            <strong className="text-ink">Bands:</strong> 90+ Champion&apos;s
            Court eligible. 75-89 Promotion eligible. 65-74 Good
            standing. Below 65 Probation.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Compliance ladder — the penalty mechanic
          </h2>
          <p className="mt-2">
            Covenant violations produce compliance penalties. Each
            penalty is -9 OVR for 90 days, stacking. The math is
            deliberate: three penalties inside 90 days moves a
            middle-band Member into probation; four moves them toward
            removal. Real-time impact prevents the pattern where a
            Member&apos;s slow decline is only recognized after a year
            of accumulated damage.
          </p>
          <p className="mt-2">
            Penalties are admin-recorded with an arbitration record —
            the reason text is preserved in the immutable audit log.
            Rescission by admin is possible and itself audit-logged. A
            Member facing a penalty they believe is mistaken can invoke
            the cooperative arbitration process; the formal Arbitration
            Procedure document lands with the production LLC operating-
            agreement rewrite (see{" "}
            <code>production-swap-checklist.md</code> §9).
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Recognition rails — how excellence is surfaced
          </h2>
          <ul className="mt-2 space-y-2 pl-6">
            <li>
              <strong className="text-ink">Future Modernist of the
              Month</strong> — admin editorial pick while the cooperative
              is small, Member vote once voting Membership is large
              enough to make the outcome meaningful. Open to Members and
              Partners; recognition unlocks a public-discovery window for
              Partners.
            </li>
            <li>
              <strong className="text-ink">Constellation of [Year]</strong> —
              annual cohort of Members who held Champion&apos;s Court
              standing during the year.
            </li>
            <li>
              <strong className="text-ink">Champion&apos;s Court</strong> —
              standing tier for Members in the top 10% AND at OVR ≥ 90.
              Refreshes with each daily compute.
            </li>
            <li>
              <strong className="text-ink">Annual canonization</strong> —
              at the end of every calendar year, each active Member (and
              any Partner who held a recognition during the year) mints
              an ERC-721 canonization card with ERC-6551 token-bound
              account. Tier locks to year-end rarity band.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Cooperative canon starts at zero
          </h2>
          <p className="mt-2">
            The first canonization runs at the end of the cooperative&apos;s
            first full calendar year of operation. No retroactive canon
            — Members do not receive credit for pre-launch work through
            the cooperative record, because retroactive minting would
            invent standing that nobody earned through the system. This
            is the integrity floor.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            How the Covenant changes
          </h2>
          <p className="mt-2">
            Changes to the Covenant require Member vote. Proposed
            changes are posted at least 30 days before the vote so
            Members have time to read, discuss, and weigh in. Governance
            weight is the token-weighted balance held in each Member&apos;s
            annual canonization TBA (production; sandbox has admin-only
            proposal for testing).
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Exit
          </h2>
          <p className="mt-2">
            Members can exit voluntarily at any time. Contribution
            record + canonization cards remain — the cooperative record
            does not retroactively erase what someone contributed. Data
            subject erasure is available at{" "}
            <Link
              href="/profile/data-rights"
              className="text-brand-magenta hover:underline"
            >
              /profile/data-rights
            </Link>{" "}
            and covers personal data; the financial subset is retained
            per legal-hold policy documented in{" "}
            <Link
              href="/policies/privacy"
              className="text-brand-magenta hover:underline"
            >
              the Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
