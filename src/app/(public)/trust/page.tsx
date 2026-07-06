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

/** Static-rendered. Trust posture page — pure content. */
export const dynamic = "force-static";

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Trust</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Security &amp; privacy
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Provenance is a system. Every action attributed. Every payout
        receipted. Members hold their own data.
      </p>

      <Card className="mt-8">
        <CardEyebrow>Attestation</CardEyebrow>
        <p className="mt-3 text-sm text-ink-muted">
          <strong className="text-ink">SOC 2</strong> and{" "}
          <strong className="text-ink">ISO/IEC 27001:2022</strong>. Type
          I lands three months after production launch. Type II at
          twelve.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Send us your VSA, CAIQ, or SIG Lite. We&apos;ll fill it.
        </p>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          What the platform does
        </h2>

        <div className="mt-4 space-y-3">
          <Pillar
            title="Every change, on the record"
            body={
              "Sign-ins, permission changes, compensation decisions, recognitions, canonizations. Append-only trail: actor, action, before/after state. Production revokes UPDATE and DELETE on the app database role; replica shipped to WORM within one business day. Twelve months hot. Seven years cold on financial records."
            }
            evidence="SOC 2 CC7.2 · ISO 27001 A.12.4"
          />

          <Pillar
            title="Authority follows the work"
            body={
              "Every admin action, server-checked. Discovery gated separately from tier. Production splits admin into finance, membership, moderation. Quarterly review."
            }
            evidence="SOC 2 CC5.2 + CC5.3 · ISO 27001 A.9.2"
          />

          <Pillar
            title="First names, in public"
            body={
              "Full names, emails, legal identity: admin only. Public routes: first name. Members control their discoverability. DMs stay cooperative-internal. External clients never see talent contact details."
            }
            evidence="SOC 2 C1.1"
          />

          <Pillar
            title="Compensation with receipts"
            body={
              "Every base release, bonus decision, revenue split — a distinct audit entry with the gate rationale. Client rating, PM rating, peer composite, whichever applied. Talent sees the full record on wallet."
            }
            evidence="SOC 2 CC7.2 · Processing Integrity"
          />

          <Pillar
            title="Your data, your terms"
            body={
              "Export the JSON. Erase the account. Erasure runs a 30-day soft-delete then hard-delete; financial records retained per business-records law. Both requests audit-logged."
            }
            evidence="SOC 2 P5.1 · GDPR Art. 15 + 17 · CCPA §1798.100 + 105"
            href="/profile/data-rights"
            hrefLabel="Self-service (Members) →"
          />

          <Pillar
            title="Subprocessors, named"
            body={
              "Every third party we share data with is on the registry. New ones get 30 days advance notice to Members. Every production subprocessor carries a signed DPA."
            }
            evidence="ISO 27001 A.15.1 · GDPR Art. 28"
            href="/policies/subprocessors"
            hrefLabel="Subprocessor Registry →"
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Landing at production
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          Infrastructure hardening ships with the deploy:
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Row
            title="Encryption"
            body="TLS 1.3 at the edge. HSTS with preload. Managed Postgres encrypted at rest. S3 SSE. KMS keys, annual rotation."
          />
          <Row
            title="Backup + DR"
            body="PITR ≥ 14 days. Daily off-region snapshot, 90-day retention. Restore drills quarterly."
          />
          <Row
            title="Vulnerability management"
            body="Dependabot. Weekly npm audit in CI. SCA on main. Critical CVEs patched within 7 days."
          />
          <Row
            title="Incident response"
            body="Severity ladder + communication tree. Public status page for SEV1/SEV2. Post-incident retros filed publicly, with redactions."
          />
          <Row
            title="Change management"
            body="Branch protection on main. Review required from a non-author on any audit-log-writing path. CI: typecheck, test, lint."
          />
          <Row
            title="Anomaly detection"
            body="Alerts on failed-sign-in bursts, unusual admin action rates, any hard-delete verb. Reviewed weekly."
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Policies</h2>
        <p className="mt-3 text-sm text-ink-muted">
          The words we bind ourselves to:
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
          Engagement questions: your account admin. Policy questions:{" "}
          <code className="text-brand-magenta">security@buildstore</code>{" "}
          in production,{" "}
          <Link href="/contact" className="text-brand-magenta hover:underline">
            /contact
          </Link>{" "}
          in sandbox.
        </p>
      </section>

      <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 text-xs text-ink-muted">
        <p>
          Auditors: the control-by-control mapping is at{" "}
          <code>/admin/compliance</code> (auth required); the long-form
          audit is at{" "}
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
