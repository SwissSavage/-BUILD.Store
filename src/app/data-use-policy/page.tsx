/**
 * Public Data Use Policy.
 *
 * Plain-language version of what the Tier-2 data participation opt-in
 * authorizes the cooperative to do, what it forbids, the anonymization
 * standards, and the worker-side covenants. This is the artifact that
 * unions, worker centers, and labor-research organizations evaluate
 * when considering whether to adopt FM-derived bargaining intelligence.
 *
 * Source of legal record: the formally drafted Talent Data Agreement
 * lives at `Future Modern/deliverables/legal/Future_Modern_Talent_Data_Agreement.docx`
 * and serves as the version of record for how this scope is described
 * in our governance documentation. This page is the public-facing
 * presentation of that scope.
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const metadata = {
  title: "Data Use Policy — $BUILD.Store",
  description:
    "How Future Modern Builderberg LLC collects, aggregates, and uses Member-Partner engagement data, with worker-side covenants.",
};

export default function DataUsePolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-xs uppercase tracking-wider text-brand-magenta">
        Future Modern Builderberg LLC
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
        Data Use Policy
      </h1>
      <p className="mt-3 text-sm text-ink-faint">
        Last updated May 4, 2026.
      </p>
      <p className="mt-6 max-w-prose text-ink-muted">
        The cooperative collects engagement data in the ordinary course of
        running the platform. This policy describes the two distinct
        purposes that data is used for, what protections apply, and how
        Member-Partners control their participation in the second of those
        purposes.
      </p>

      <Section eyebrow="Tier 1" title="Operational use (baseline)">
        <p>
          When you register and use the platform, the cooperative records
          basic operational data on your engagements: scope, deliverables,
          prices set and collected, package selection, time-to-close, and
          related details. This data is used for internal cooperative
          operations.
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-1 text-ink-muted">
          <li>Pricing and matching tools that route engagements to the right talent.</li>
          <li>Member intelligence dashboards available to admins and Member-Partners.</li>
          <li>Calibration of the cooperative&rsquo;s admin and reserve splits.</li>
          <li>Tax, accounting, and audit obligations.</li>
        </ul>
        <p className="mt-3">
          Tier-1 use is governed by your acceptance of the cooperative&rsquo;s
          baseline registration terms. It does not include any external
          publication of your data, and does not include sharing your
          individual price points with anyone outside the cooperative.
        </p>
      </Section>

      <Section eyebrow="Tier 2" title="Labor-value research and tooling (opt-in)">
        <p>
          The cooperative builds public labor-value intelligence and
          collective-bargaining tooling on top of aggregated Member-Partner
          engagement data. This is the work that makes the cooperative a
          worker-side asset for the broader workforce. It requires explicit,
          separate opt-in consent, distinct from your registration terms.
        </p>
        <p className="mt-3">
          When you opt in, you authorize the cooperative to:
        </p>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted">
          <li>Aggregate your engagement data with that of other opted-in Member-Partners.</li>
          <li>Derive analyses, benchmarks, indices, methodologies, and tooling from those aggregates.</li>
          <li>Publish anonymized aggregate insights externally, including in research, advocacy materials, and as inputs to collective-bargaining tools.</li>
          <li>Share anonymized aggregate insights with Cooperative-Aligned Recipients (worker cooperatives, labor unions, labor-research organizations, worker-advocacy nonprofits).</li>
        </ul>
      </Section>

      <Section eyebrow="What we do not do" title="Hard limits, by covenant">
        <ul className="list-disc pl-5 space-y-1 text-ink-muted">
          <li>
            <strong className="text-ink">No raw price points externally.</strong>{" "}
            Your individual prices, asks, and identifiable engagement details
            never leave the cooperative. Only derived aggregate insights do.
          </li>
          <li>
            <strong className="text-ink">No sale of data as a product.</strong>{" "}
            The cooperative does not sell engagement data, identifiable data,
            or aggregate insights to commercial third parties. Aggregate
            insights are shared with Cooperative-Aligned Recipients on a
            non-commercial or cost-recovery basis only.
          </li>
          <li>
            <strong className="text-ink">No employer-side use.</strong>{" "}
            We do not share engagement data or aggregate insights with
            employers, recruiters, staffing platforms, or any party whose
            use would foreseeably weaken the bargaining position of workers.
          </li>
          <li>
            <strong className="text-ink">No tooling that depresses wages.</strong>{" "}
            Anything we build on this data is built to advance the bargaining
            position and earnings of workers, including you.
          </li>
        </ul>
      </Section>

      <Section eyebrow="Anonymization" title="How aggregates are sanitized">
        <ul className="list-disc pl-5 space-y-1 text-ink-muted">
          <li>Minimum cohort size of five Member-Partners in any aggregate cell published externally.</li>
          <li>Cell suppression where a single contributor would dominate or expose a cell.</li>
          <li>Removal of names, handles, contact information, and any free-text fields that could re-identify.</li>
          <li>Periodic admin privacy review of published outputs, with a written record of the review.</li>
        </ul>
      </Section>

      <Section eyebrow="Reciprocity" title="What you get back">
        <ul className="list-disc pl-5 space-y-1 text-ink-muted">
          <li>Equal access to the same aggregate insights and tooling the cooperative builds on this data.</li>
          <li>Visibility into the methodologies and cohort definitions used to derive insights.</li>
          <li>A pre-publication review window of at least ten business days when your contributions materially shape a featured external insight.</li>
          <li>Continued accrual of cooperative equity, recognizing that the cooperative&rsquo;s growth on this work is shared economic upside across all Member-Partners.</li>
        </ul>
      </Section>

      <Section eyebrow="Control" title="Opt out and portability">
        <p>
          You can opt in or out of Tier-2 participation at any time from
          your <Link href="/profile" className="text-brand-magenta hover:underline">profile</Link>.
          Opt-out stops new collection for Tier-2 purposes effective on the
          date of the toggle. Anonymized aggregates already published as of
          the opt-out date remain published, because anonymization makes
          them non-revocable in effect.
        </p>
        <p className="mt-3">
          You can request a written export of your own engagement data at
          any time, in a structured machine-readable format, within thirty
          days of the request.
        </p>
      </Section>

      <Section eyebrow="Cooperative-equity recognition" title="Why the structure works">
        <p>
          Member-Partners participate in this Data Use scope as cooperative
          members with an accruing equity interest in Future Modern. Growth
          of the cooperative driven in part by aggregate insights advances
          your economic interest. The cooperative-equity logic is the
          consideration that aligns this Data Use scope with the
          beneficial-use standard in the Curated Artist Letter of Intent:
          use authorized under this policy is, by structural design, for
          the benefit of the Member-Partners collectively.
        </p>
      </Section>

      <Section eyebrow="Security" title="How we hold this">
        <ul className="list-disc pl-5 space-y-1 text-ink-muted">
          <li>Engagement data lives in encrypted, access-controlled systems.</li>
          <li>Access is granted on a need-to-know basis with logged accountability.</li>
          <li>Incident notification within 72 hours of any reasonable belief that identifiable data was exposed.</li>
        </ul>
      </Section>

      <Section eyebrow="Changes" title="How this policy is updated">
        <p>
          Material changes to this policy are announced to Member-Partners
          and posted with an updated effective date. If a change expands
          the scope of authorized use, your existing opt-in does not carry
          over to the new scope automatically. The cooperative will request
          renewed opt-in consent specific to the expanded use.
        </p>
      </Section>

      <Card className="mt-12 border-[#5070F0]/40">
        <CardEyebrow>Questions or red-pen?</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          We expect this to be evaluated.
        </CardTitle>
        <p className="mt-3 max-w-prose text-sm text-ink-muted">
          Unions, worker centers, and labor-research organizations are
          welcome to evaluate this policy on its substance. The version of
          record is held in our governance file as the Talent Data Agreement;
          this page is the public-facing presentation of the same scope.
          Direct your counsel to the cooperative through the channels on
          our <Link href="/about" className="text-brand-magenta hover:underline">About</Link> page.
        </p>
      </Card>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="text-xs uppercase tracking-wider text-brand-magenta">
        {eyebrow}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
        {children}
      </div>
    </section>
  );
}
