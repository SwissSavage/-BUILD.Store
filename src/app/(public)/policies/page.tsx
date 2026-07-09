/**
 * /policies — public policy directory.
 *
 * All cooperative-facing policies live here. Public route (no auth
 * gate) — SOC 2 P1.1 / ISO 27001 A.5.1 require published policies
 * available to any data subject on request. The index lists status +
 * last-reviewed date + version so a reader can tell what's current.
 *
 * Sandbox: policies are drafted with SANDBOX DRAFT banners so nobody
 * mistakes them for executed documents. Production replaces the
 * banner with a signed + counter-signed effective-date footer.
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

/** Static-rendered. Policy index has no dynamic dependencies. */
export const dynamic = "force-static";

interface PolicyEntry {
  slug: string;
  title: string;
  purpose: string;
  status: "draft" | "review" | "effective";
  lastReviewed: string;
  version: string;
  framework: string;
}

const POLICIES: PolicyEntry[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    purpose:
      "How the cooperative collects, uses, retains, and shares personal data. Cross-references data subject rights at /profile/data-rights.",
    status: "draft",
    lastReviewed: "2026-07-01",
    version: "0.1",
    framework: "SOC 2 P1.1 · GDPR Art. 13-14 · CCPA §1798.100",
  },
  {
    slug: "covenant",
    title: "Cooperative Covenant",
    purpose:
      "The behavior expected of every Member and Partner in the cooperative. Governance principles, compliance ladder, penalty mechanic.",
    status: "draft",
    lastReviewed: "2026-07-01",
    version: "0.1",
    framework: "SOC 2 CC1.1 (Governance and control environment)",
  },
  {
    slug: "subprocessors",
    title: "Subprocessor Registry",
    purpose:
      "Third parties the cooperative shares data with to operate the platform. Categories, jurisdictions, DPA status. 30-day advance notice on additions.",
    status: "draft",
    lastReviewed: "2026-07-01",
    version: "0.1",
    framework: "ISO 27001 A.15.1 · GDPR Art. 28",
  },
];

const STATUS_LABEL: Record<PolicyEntry["status"], string> = {
  draft: "Sandbox draft",
  review: "In legal review",
  effective: "Effective",
};
const STATUS_COLOR: Record<PolicyEntry["status"], string> = {
  draft: "#A3A3A3",
  review: "#5070F0",
  effective: "#007048",
};

export default function PoliciesIndex() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Policies</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Cooperative policies
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        What we bind ourselves to. Sandbox drafts labeled. Production
        versions carry a signed effective-date footer, reviewed annually.
      </p>

      <div className="mt-8 space-y-3">
        {POLICIES.map((p) => (
          <Card key={p.slug}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <CardEyebrow>{p.framework}</CardEyebrow>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                  color: STATUS_COLOR[p.status],
                  borderColor: STATUS_COLOR[p.status],
                  borderWidth: 1,
                  borderStyle: "solid",
                }}
              >
                {STATUS_LABEL[p.status]}
              </span>
            </div>
            <CardTitle className="mt-2 text-xl">
              <Link
                href={`/policies/${p.slug}`}
                className="hover:text-brand-magenta"
              >
                {p.title} →
              </Link>
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">{p.purpose}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
              <span>Version {p.version}</span>
              <span>Last reviewed {p.lastReviewed}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Sandbox draft posture
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Drafts stay <strong>Sandbox draft</strong> until counsel review
          and Member counter-signature at production. Draft language
          matches the code; production is calibration, not rewrite.
        </p>
      </div>
    </div>
  );
}
