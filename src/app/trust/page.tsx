/**
 * /trust — customer-facing security + privacy posture page.
 *
 * The page a security-conscious client visits during procurement.
 * Public route (no auth), reads-only, plain-spoken. Complements the
 * admin-only /admin/compliance dashboard (which is auditor-facing)
 * with a customer-facing summary at the right level of abstraction.
 *
 * Cross-references /policies/* + /profile/data-rights + the long-form
 * technical audit at deliverables/compliance/soc2-iso27001-readiness.md
 * (repo-only; not linked from here since it's development-facing).
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Trust</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Security &amp; privacy
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        The cooperative handles engagement briefs, contribution
        records, and financial data. Here&apos;s how we protect it,
        who has access, and what we log. Written for the person doing
        procurement on the other side of an engagement.
      </p>

      {/* Attestation posture — set expectations up front. */}
      <Card className="mt-8">
        <CardEyebrow>Attestation posture</CardEyebrow>
        <p className="mt-3 text-sm text-ink-muted">
          The platform is designed against{" "}
          <strong className="text-ink">SOC 2 Trust Services Criteria</strong>{" "}
          and{" "}
          <strong className="text-ink">ISO/IEC 27001:2022 Annex A</strong>.
          Formal Type I attestation follows production launch by three
          months (the minimum observation window); Type II follows at
          the twelve-month mark. In the meantime, the controls
          underlying those attestations are already in code — see the
          summary below.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          If your procurement process requires a signed vendor security
          questionnaire (VSA / CAIQ / SIG Lite), we&apos;ll fill and
          return one — the sandbox architecture already covers most
          questions substantively.
        </p>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          What we do
        </h2>

        <div className="mt-4 space-y-3">
          <Pillar
            title="Every consequential change is logged, immutably"
            body={
              "The cooperative records every security-relevant action — sign-ins, permission changes, compensation decisions, recognitions, canonizations — to an append-only audit trail. Log entries carry actor, action, before/after state, and IP hint. In production the log is stored in a table where UPDATE and DELETE grants have been revoked at the database role, with a replica shipped to a write-once-read-many archive within one business day. Twelve months hot retention; seven years cold for the financial subset."
            }
            evidence="SOC 2 CC7.2 · ISO 27001 A.12.4"
          />

          <Pillar
            title="Role-based access, least privilege by default"
            body={
              "Every admin action is gated by an explicit permission check on the server. Public discovery is gated separately, so a Member's profile visibility can be controlled independently of their tier — defensive when circumstances require it. Production splits the admin role into finance, membership, and moderation scopes so operators see only what their function requires; access is reviewed quarterly."
            }
            evidence="SOC 2 CC5.2 + CC5.3 · ISO 27001 A.9.2"
          />

          <Pillar
            title="Confidentiality by design"
            body={
              "Full names, emails, and legal identity are confined to admin surfaces. Public routes show first-name-only. Members can opt into or out of public discovery via a profile toggle independent of their standing tier. Direct messages between Members are cooperative-internal; external clients never see contact details for talent they haven't been formally routed to."
            }
            evidence="SOC 2 C1.1"
          />

          <Pillar
            title="Compensation with a receipts trail"
            body={
              "Every base pay release, every bonus decision (released or reclaimed), and every revenue split is a distinct entry on the audit log with the rationale that produced it — client rating, PM engagement rating, peer review composite, whichever gate applied. Talent sees the whole record on their own wallet; admins see the whole record across the cooperative. Nothing about the payout is silent."
            }
            evidence="SOC 2 CC7.2 · Processing Integrity"
          />

          <Pillar
            title="You control your data"
            body={
              "Members can request a full JSON export of everything the cooperative holds about them, and can request account erasure with a 30-day soft-delete followed by hard-delete. The financial subset is retained per business-records law with an audit stamp on each retained record at day 31. Both requests are logged to the same immutable audit trail as everything else."
            }
            evidence="SOC 2 P5.1 · GDPR Art. 15 + 17 · CCPA §1798.100 + 105"
            href="/profile/data-rights"
            hrefLabel="Self-service surface (Members) →"
          />

          <Pillar
            title="Subprocessors are named, and additions require notice"
            body={
              "The list of third parties the cooperative shares data with is published. Adding a new subprocessor requires 30 days of advance notice to Members, during which they can object or exercise their data rights. Every subprocessor on the production roster carries a signed Data Processing Addendum."
            }
            evidence="ISO 27001 A.15.1 · GDPR Art. 28"
            href="/policies/subprocessors"
            hrefLabel="Subprocessor Registry →"
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          What&apos;s coming with production launch
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          The architectural pieces above ship with the platform. The
          infrastructure hardening below lands with production
          deployment:
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Row
            title="Encryption at rest + in transit"
            body="TLS 1.3 minimum at the edge with HSTS + preload. Managed Postgres with encryption on. S3 Server-Side Encryption. KMS-managed keys with annual rotation."
          />
          <Row
            title="Backup + disaster recovery"
            body="Point-in-time recovery ≥ 14 days. Daily off-region snapshot with 90-day retention. Quarterly restore drills documented."
          />
          <Row
            title="Vulnerability management"
            body="Dependabot on the repo. Weekly npm audit in CI. Software composition analysis on the main branch. Critical CVEs patched within 7 days."
          />
          <Row
            title="Incident response"
            body="Documented severity ladder + communication tree. Public status page for SEV1/SEV2. Post-incident retros filed publicly-with-redactions."
          />
          <Row
            title="Change management"
            body="Branch protection on main. Required review from at least one non-author on any audit-log-writing code path. CI gates on typecheck + test + lint."
          />
          <Row
            title="Anomaly detection"
            body="Alerts on failed-sign-in bursts, unusual admin action rates, any hard-delete verb. Reviewed weekly by the compliance-admin scope."
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Policies</h2>
        <p className="mt-3 text-sm text-ink-muted">
          Published policies covering how the cooperative operates:
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link
              href="/policies/privacy"
              className="text-brand-magenta hover:underline"
            >
              Privacy Policy →
            </Link>{" "}
            <span className="text-ink-muted">
              — what we collect, why, and your rights.
            </span>
          </li>
          <li>
            <Link
              href="/policies/covenant"
              className="text-brand-magenta hover:underline"
            >
              Cooperative Covenant →
            </Link>{" "}
            <span className="text-ink-muted">
              — the behavior expected of every Member and Partner.
            </span>
          </li>
          <li>
            <Link
              href="/policies/subprocessors"
              className="text-brand-magenta hover:underline"
            >
              Subprocessor Registry →
            </Link>{" "}
            <span className="text-ink-muted">
              — third parties we share data with.
            </span>
          </li>
          <li>
            <Link
              href="/policies"
              className="text-brand-magenta hover:underline"
            >
              All policies →
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Questions</h2>
        <p className="mt-3 text-sm text-ink-muted">
          If you have questions about how the cooperative handles data
          on your engagement, the fastest path is to route them through
          the account admin on the deal. For anything policy-shaped,
          write to{" "}
          <code className="text-brand-magenta">security@buildstore</code>{" "}
          (production) or use the{" "}
          <Link href="/contact" className="text-brand-magenta hover:underline">
            /contact
          </Link>{" "}
          form (sandbox).
        </p>
      </section>

      <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-xs text-ink-muted">
        <p>
          This page is written for the person doing procurement. If
          you&apos;re an auditor and want the technical control-by-
          control mapping, the internal dashboard is at{" "}
          <code>/admin/compliance</code> (admin auth required) and the
          long-form audit is in the repo at{" "}
          <code>deliverables/compliance/soc2-iso27001-readiness.md</code>.
        </p>
      </div>
    </div>
  );
}

function Pillar({
  title,
  body,
  evidence,
  href,
  hrefLabel,
}: {
  title: string;
  body: string;
  evidence: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {evidence}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
      {href && hrefLabel && (
        <Link
          href={href}
          className="mt-2 inline-block text-xs text-brand-magenta hover:underline"
        >
          {hrefLabel}
        </Link>
      )}
    </Card>
  );
}

function Row({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardTitle className="text-base">{title}</CardTitle>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </Card>
  );
}
