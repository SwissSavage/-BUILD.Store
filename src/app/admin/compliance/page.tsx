/**
 * /admin/compliance — SOC 2 + ISO 27001 control status dashboard.
 *
 * Every control we've decided to care about maps to one row. Each row
 * carries: the framework citation, the control text, current sandbox
 * state, the production remediation, and a pointer to on-platform
 * evidence (audit log link, code path, or policy doc).
 *
 * This is a read model, not authoritative — the readiness audit doc at
 * deliverables/compliance/soc2-iso27001-readiness.md is the canonical
 * long-form. This surface exists so admins can see the shape at a
 * glance without leaving the app.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_AUDIT_LOG } from "@/lib/mock-data/audit-log";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

type ControlStatus = "satisfied" | "partial" | "gap" | "planned";

interface ComplianceControl {
  framework: "SOC 2" | "ISO 27001";
  reference: string;
  title: string;
  requirement: string;
  status: ControlStatus;
  sandboxEvidence: string;
  productionRemediation: string;
  href?: string;
}

const CONTROLS: ComplianceControl[] = [
  // ── SOC 2 Trust Services Criteria ──────────────────────────────
  {
    framework: "SOC 2",
    reference: "CC1.1",
    title: "Governance and cooperative covenant",
    requirement:
      "The entity demonstrates a commitment to integrity and ethical values through a documented code of conduct.",
    status: "satisfied",
    sandboxEvidence:
      "Cooperative Covenant published at /policies/covenant. Sourced from memory/legal.md + bylaws in Chibu FL LLC filing. MVP compliance penalty mechanic enforces covenant with real-time impact.",
    productionRemediation:
      "Counsel review of covenant draft; require signed acknowledgement at Member conversion; annual re-acknowledgement recorded via user.covenant_acknowledged audit verb.",
    href: "/policies/covenant",
  },
  {
    framework: "SOC 2",
    reference: "CC1.4",
    title: "Personnel qualification and screening",
    requirement:
      "The entity establishes qualification requirements and screening for personnel commensurate with responsibilities.",
    status: "partial",
    sandboxEvidence:
      "Member conversion flow gates on partner+prospect application review; adminUserIds pool is explicit per contract.",
    productionRemediation:
      "Background check policy for admins with fiduciary/PII access; onboarding checklist stored in the members table.",
  },
  {
    framework: "SOC 2",
    reference: "CC2.1",
    title: "Communication of security responsibilities",
    requirement:
      "The entity communicates security responsibilities internally to enable users to fulfill their responsibilities.",
    status: "planned",
    sandboxEvidence: "Admin surfaces label admin-only controls with copy.",
    productionRemediation:
      "Publish security-responsibilities policy at /policies/security-responsibilities; include in Member onboarding walkthrough.",
  },
  {
    framework: "SOC 2",
    reference: "CC5.2",
    title: "Access control — role separation",
    requirement:
      "The entity restricts access to information assets based on business need.",
    status: "satisfied",
    sandboxEvidence:
      "requireAdmin() gates every admin server action. publicProfileEligible() gates public discovery. Member-tier auth-gates /team, /calendar, /activity.",
    productionRemediation:
      "Auth stub replaced by production provider (Clerk/Auth.js/WorkOS). RBAC roles: admin, member, partner, prospect, viewer. Row-level security on Postgres for tenant isolation.",
    href: "/admin/audit-log",
  },
  {
    framework: "SOC 2",
    reference: "CC5.3",
    title: "Least privilege",
    requirement:
      "The entity assigns access rights and permissions consistent with the principle of least privilege.",
    status: "partial",
    sandboxEvidence:
      "Admin flag scoped per action via requireAdmin(). adminUserIds pool per-contract for commission access. Quarterly access review surface at /admin/access-review writes config.access_reviewed audit entries; last-review date drives cadence status. Individual revocations write user.admin_flag_changed entries with reason.",
    productionRemediation:
      "Split admin into scoped roles (finance_admin, membership_admin, moderation_admin) so operators see only what their function requires. Quarterly cadence enforced via calendar reminder + overdue-status flag on this dashboard.",
    href: "/admin/access-review",
  },
  {
    framework: "SOC 2",
    reference: "CC6.1",
    title: "Encryption at rest",
    requirement:
      "The entity protects information at rest through encryption.",
    status: "planned",
    sandboxEvidence: "Not applicable in sandbox.",
    productionRemediation:
      "Postgres storage encrypted at rest via managed DB (AWS RDS/Neon/Vercel Postgres with encryption on). S3 buckets Server-Side Encryption. KMS-managed keys with rotation.",
  },
  {
    framework: "SOC 2",
    reference: "CC6.6",
    title: "Encryption in transit",
    requirement:
      "The entity protects information in transit through encryption.",
    status: "planned",
    sandboxEvidence: "Next dev server is HTTP-only for localhost.",
    productionRemediation:
      "TLS 1.3 enforced at edge (Vercel/CloudFront). HSTS with max-age ≥ 1 year and preload. Certificate pinning for the API subdomain.",
  },
  {
    framework: "SOC 2",
    reference: "CC7.2",
    title: "Logging and monitoring (audit log)",
    requirement:
      "The entity monitors systems and analyzes anomalies via an append-only audit log.",
    status: "satisfied",
    sandboxEvidence: `MOCK_AUDIT_LOG append-only in-memory store. logAuditEvent() called from every security/financial/compliance-adjacent server action. ${MOCK_AUDIT_LOG.length} entries recorded so far.`,
    productionRemediation:
      "Drizzle audit_log table with UPDATE/DELETE grants revoked at DB role. Replication to S3 Object Lock (WORM) within one business day. 12-month hot retention, 7-year cold for financial subset.",
    href: "/admin/audit-log",
  },
  {
    framework: "SOC 2",
    reference: "CC7.3",
    title: "Incident response",
    requirement:
      "The entity has procedures for incident response and communicates incident information to appropriate parties.",
    status: "planned",
    sandboxEvidence: "Not implemented in sandbox.",
    productionRemediation:
      "Runbook at deliverables/compliance/incident-response.md. Severity ladder + communication tree. Post-incident retros filed in the same repo.",
  },
  {
    framework: "SOC 2",
    reference: "CC8.1",
    title: "Change management",
    requirement:
      "The entity authorizes and approves changes to information assets.",
    status: "partial",
    sandboxEvidence:
      "Git-tracked codebase with commit history. Production-swap-checklist.md gates deploy.",
    productionRemediation:
      "Branch protection on main. Required review from at least one non-author on any src/lib/**/actions.ts change. CI gates on typecheck + test + lint. Deploy tagged commits only.",
  },
  {
    framework: "SOC 2",
    reference: "A1.2",
    title: "Availability — backup and recovery",
    requirement:
      "The entity maintains data recovery capabilities.",
    status: "planned",
    sandboxEvidence: "Not implemented (in-memory).",
    productionRemediation:
      "Postgres PITR retention ≥ 14 days. Daily off-region snapshot with 90-day retention. Quarterly restore drill; last-drill-date stamped in this dashboard.",
  },
  {
    framework: "SOC 2",
    reference: "C1.1",
    title: "Confidentiality — data classification",
    requirement:
      "The entity identifies information requiring confidentiality protection.",
    status: "satisfied",
    sandboxEvidence:
      "publicName() vs adminName() enforces first-name-only public exposure. Full names, emails, and legal identity confined to admin surfaces. Chibu profilePublic=false demonstrates defensive posture.",
    productionRemediation:
      "Add data-classification metadata to Drizzle column comments (public/internal/restricted/regulated). API layer refuses to serialize regulated columns without an explicit allowlist.",
  },
  {
    framework: "SOC 2",
    reference: "P1.1",
    title: "Privacy — data subject notice",
    requirement:
      "The entity provides notice to data subjects about privacy practices.",
    status: "partial",
    sandboxEvidence:
      "Privacy policy draft published at /policies/privacy covering purposes, categories, retention, third parties, and user rights. Cross-links to /profile/data-rights for the self-service surface.",
    productionRemediation:
      "Counsel review of privacy policy draft; sign effective-date footer; localization for EU/CA jurisdictions.",
    href: "/policies/privacy",
  },
  {
    framework: "SOC 2",
    reference: "P5.1",
    title: "Privacy — access, correction, and erasure",
    requirement:
      "The entity provides data subjects with mechanisms to access, correct, or delete their personal data.",
    status: "partial",
    sandboxEvidence:
      "/profile/data-rights Member surface with export + erasure request forms. profilePublic toggle for user-controlled visibility. data-rights-actions writes data.subject_export_requested / data.subject_erasure_requested audit verbs and notifies admin pool.",
    productionRemediation:
      "Automate the export dispatch (24-hour signed JSON URL by email) and the 30-day soft-delete + hard-delete cycle. Retain financial subset per legal-hold; audit-stamp each retained record at day-31.",
    href: "/profile/data-rights",
  },

  // ── ISO 27001 Annex A ─────────────────────────────────────────
  {
    framework: "ISO 27001",
    reference: "A.5.1",
    title: "Information security policies",
    requirement:
      "A set of policies for information security shall be defined, approved by management, published and communicated.",
    status: "planned",
    sandboxEvidence: "Covenant + memory files serve as internal reference.",
    productionRemediation:
      "Formal ISMS document set: information security policy, acceptable use, access control, cryptography, backup, incident response, supplier. Reviewed annually.",
  },
  {
    framework: "ISO 27001",
    reference: "A.8.1",
    title: "Asset inventory",
    requirement:
      "Assets associated with information and information processing facilities shall be identified.",
    status: "partial",
    sandboxEvidence:
      "types.ts enumerates domain models. mock-data/ directory maps 1:1 to production tables. adminUserIds field encodes stewardship per contract.",
    productionRemediation:
      "Publish an infrastructure inventory (hosts, databases, buckets, third parties) with owner and classification. Update quarterly.",
  },
  {
    framework: "ISO 27001",
    reference: "A.9.2",
    title: "User access management",
    requirement:
      "A formal user registration and de-registration process shall be implemented.",
    status: "partial",
    sandboxEvidence:
      "Membership tier transitions logged via user.membership_tier_changed audit verb. Quarterly access review at /admin/access-review with revoke-with-reason flow and audit-logged review completion.",
    productionRemediation:
      "Auto-suspend accounts after 180 days of inactivity. Wire the review cadence into a scheduled task that pages the compliance-admin scope when overdue.",
    href: "/admin/access-review",
  },
  {
    framework: "ISO 27001",
    reference: "A.10.1",
    title: "Cryptographic controls",
    requirement:
      "A policy on the use of cryptographic controls for protection of information shall be developed and implemented.",
    status: "planned",
    sandboxEvidence: "N/A in sandbox.",
    productionRemediation:
      "Cryptography policy documenting TLS 1.3 minimum, AES-256 at rest, key rotation (annual for KMS master, 90-day for JWT signing), and secret storage (Vercel/AWS Secrets Manager).",
  },
  {
    framework: "ISO 27001",
    reference: "A.12.1",
    title: "Operational procedures",
    requirement:
      "Operating procedures shall be documented and made available to all users who need them.",
    status: "partial",
    sandboxEvidence:
      "ROADMAP.md + production-swap-checklist.md + memory files document current operations.",
    productionRemediation:
      "Move to a runbook repo (deliverables/runbooks/*.md) with per-topic playbooks: deploy, rollback, DB migration, incident response, customer data request.",
  },
  {
    framework: "ISO 27001",
    reference: "A.12.4",
    title: "Logging and monitoring",
    requirement:
      "Event logs recording user activities, exceptions, faults, and information security events shall be produced, kept, and regularly reviewed.",
    status: "satisfied",
    sandboxEvidence:
      "Audit log (see CC7.2 above). Monthly compliance review is intended cadence.",
    productionRemediation:
      "Alert on anomalous verb bursts (>N failed_signin per hour per IP, >M compliance_penalty_applied per day per admin).",
    href: "/admin/audit-log",
  },
  {
    framework: "ISO 27001",
    reference: "A.12.6",
    title: "Technical vulnerability management",
    requirement:
      "Information about technical vulnerabilities shall be obtained in a timely fashion and evaluated.",
    status: "planned",
    sandboxEvidence: "npm audit runs locally.",
    productionRemediation:
      "Dependabot enabled on GitHub. Weekly npm audit run in CI. Snyk or equivalent SCA on the main branch. SLA: critical CVEs patched within 7 days.",
  },
  {
    framework: "ISO 27001",
    reference: "A.13.1",
    title: "Network security",
    requirement:
      "Networks shall be managed and controlled to protect information in systems and applications.",
    status: "planned",
    sandboxEvidence: "N/A for localhost sandbox.",
    productionRemediation:
      "Edge WAF (Vercel/Cloudflare). Rate limiting on public endpoints. Database not exposed to public internet (VPC-only). Bastion for admin DB access.",
  },
  {
    framework: "ISO 27001",
    reference: "A.15.1",
    title: "Supplier relationships",
    requirement:
      "Information security requirements for mitigating risks associated with supplier access to the entity's assets shall be agreed with the supplier.",
    status: "partial",
    sandboxEvidence:
      "Subprocessor registry published at /policies/subprocessors covering Vercel, managed Postgres, Stripe, HubSpot, auth provider, email delivery, transcript providers, print partner. 30-day advance notice pattern documented.",
    productionRemediation:
      "Sign DPAs with every listed subprocessor at production onboarding. Wire notification firehose so a registry addition auto-fires the 30-day member notice.",
    href: "/policies/subprocessors",
  },
  {
    framework: "ISO 27001",
    reference: "A.16.1",
    title: "Incident management",
    requirement:
      "Responsibilities and procedures shall be established to ensure a quick, effective, and orderly response to information security incidents.",
    status: "planned",
    sandboxEvidence: "Not implemented.",
    productionRemediation: "Same as SOC 2 CC7.3 above.",
  },
  {
    framework: "ISO 27001",
    reference: "A.17.1",
    title: "Business continuity",
    requirement:
      "Information security continuity shall be embedded in the entity's business continuity management systems.",
    status: "planned",
    sandboxEvidence: "Not implemented.",
    productionRemediation:
      "Business Continuity Plan document. Quarterly tabletop exercise. RTO 4 hours, RPO 1 hour on financial data.",
  },
  {
    framework: "ISO 27001",
    reference: "A.18.1",
    title: "Compliance with legal and contractual requirements",
    requirement:
      "All relevant legislative statutory, regulatory, contractual requirements shall be explicitly identified.",
    status: "partial",
    sandboxEvidence:
      "Chibu FL LLC bylaws + Cooperative Covenant in legal.md. Whitelist gates paid-membership sale of governance access.",
    productionRemediation:
      "Add jurisdictional matrix: FL corp filings, CA CCPA (for California residents), NY SHIELD Act, GDPR (if EU users). Annual legal review.",
  },
];

const STATUS_LABEL: Record<ControlStatus, string> = {
  satisfied: "Satisfied (sandbox)",
  partial: "Partial",
  gap: "Gap",
  planned: "Planned — production",
};
const STATUS_COLOR: Record<ControlStatus, string> = {
  satisfied: "#007048",
  partial: "#D4AF37",
  gap: "#D828A0",
  planned: "#5070F0",
};

function countByStatus(status: ControlStatus): number {
  return CONTROLS.filter((c) => c.status === status).length;
}

export default async function CompliancePage() {
  await requireAdmin();

  const summary: ControlStatus[] = ["satisfied", "partial", "gap", "planned"];

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <CardEyebrow>Compliance</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        SOC 2 + ISO 27001 control status
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-muted">
        Every control we&apos;ve decided to care about, one row. Sandbox
        evidence + production remediation per row. The long-form audit
        lives at{" "}
        <code className="text-brand-magenta">
          deliverables/compliance/soc2-iso27001-readiness.md
        </code>
        ; this surface is the at-a-glance shape.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {summary.map((s) => (
          <Card key={s}>
            <CardEyebrow>{STATUS_LABEL[s]}</CardEyebrow>
            <CardTitle className="mt-2 text-3xl">
              <span style={{ color: STATUS_COLOR[s] }}>
                {countByStatus(s)}
              </span>
            </CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              of {CONTROLS.length} tracked controls
            </p>
          </Card>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          SOC 2 Trust Services Criteria
        </h2>
        <div className="mt-4 space-y-3">
          {CONTROLS.filter((c) => c.framework === "SOC 2").map((c) => (
            <ControlRow key={c.reference} control={c} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          ISO 27001 Annex A
        </h2>
        <div className="mt-4 space-y-3">
          {CONTROLS.filter((c) => c.framework === "ISO 27001").map((c) => (
            <ControlRow key={c.reference} control={c} />
          ))}
        </div>
      </section>

      <div className="mt-10 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Attestation posture
        </p>
        <p className="mt-2 text-sm text-ink">
          Pre-attestation. Landing a SOC 2 Type I report requires the
          production stack (persistent audit log, encryption, backup,
          incident response) plus a three-month observation window; Type
          II requires twelve. The rows above map every gap to the
          production remediation so we can time the audit start to the
          moment the last &ldquo;planned&rdquo; row lands.
        </p>
      </div>
    </div>
  );
}

function ControlRow({ control }: { control: ComplianceControl }) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {control.framework} · {control.reference}
          </span>
          <CardTitle className="mt-1 text-lg">{control.title}</CardTitle>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
          style={{
            color: STATUS_COLOR[control.status],
            borderColor: STATUS_COLOR[control.status],
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          {STATUS_LABEL[control.status]}
        </span>
      </div>
      <p className="mt-2 text-xs italic text-ink-muted">
        {control.requirement}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-faint">
            Sandbox evidence
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {control.sandboxEvidence}
          </p>
          {control.href && (
            <Link
              href={control.href}
              className="mt-1 inline-block text-xs text-brand-magenta hover:underline"
            >
              View evidence →
            </Link>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-faint">
            Production remediation
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {control.productionRemediation}
          </p>
        </div>
      </div>
    </Card>
  );
}
