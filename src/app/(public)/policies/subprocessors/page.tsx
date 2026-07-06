/**
 * /policies/subprocessors — Subprocessor Registry sandbox draft.
 *
 * The list of third parties that process cooperative data. ISO 27001
 * A.15.1 (Supplier security) + GDPR Art. 28 (Processors) evidence.
 * Public route so Members and Partners can see who touches their
 * data before they decide to participate.
 *
 * 30-day advance notice pattern: adding a new subprocessor requires
 * a 30-day advance notice period during which Members can raise
 * objections. Removal or replacement follows the same window.
 */
import { Card, CardEyebrow } from "@/components/Card";

/** Static-rendered. Subprocessor Registry is a published document. */
export const dynamic = "force-static";

interface Subprocessor {
  name: string;
  purpose: string;
  dataCategories: string[];
  jurisdiction: string;
  dpaStatus: "signed" | "pending" | "planned";
  addedAt: string;
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Vercel (Inc.)",
    purpose: "Application hosting, edge network, image optimization.",
    dataCategories: ["Identity + contact", "Usage telemetry"],
    jurisdiction: "United States (SOC 2 Type II attested)",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "Managed Postgres provider (TBD)",
    purpose: "Primary datastore for all cooperative records.",
    dataCategories: [
      "Identity + contact",
      "Contribution record",
      "Financial",
      "Audit log",
    ],
    jurisdiction: "United States (provider selection pending — Neon / RDS / Vercel Postgres candidates)",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "Stripe",
    purpose:
      "Payment processing for client contracts + Stripe Connect for talent payouts.",
    dataCategories: [
      "Financial (payout destinations, contract amounts)",
      "Identity + contact (name, email, tax ID for 1099 reporting)",
    ],
    jurisdiction: "United States + Ireland (SOC 1 + SOC 2 attested)",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "HubSpot",
    purpose: "CRM for client relationships + deal pipeline.",
    dataCategories: [
      "Identity + contact (client contacts, submitter contacts)",
      "Contribution record (deal notes, engagement history)",
    ],
    jurisdiction: "United States (SOC 2 Type II attested)",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "Auth provider (TBD)",
    purpose: "Authentication + session management.",
    dataCategories: ["Identity + contact (email, hashed password)"],
    jurisdiction:
      "Provider selection pending — Clerk / Auth.js / WorkOS candidates",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "Email delivery (TBD)",
    purpose:
      "Transactional email (auth, order confirmations, notifications, milestone deadlines).",
    dataCategories: ["Identity + contact (email, notification body)"],
    jurisdiction:
      "Provider selection pending — Resend / Postmark / SendGrid candidates",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "Meeting transcript providers (member-configured)",
    purpose:
      "Ingestion of meeting recordings + transcripts for the internal minutes rail. Only when a Member chooses to connect their own account.",
    dataCategories: [
      "Meeting content (audio, transcript text, attendee list) — only for meetings the Member uploads",
    ],
    jurisdiction:
      "Varies by provider (Otter, Granola, Fireflies, Zoom Cloud Recording)",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
  {
    name: "Phygital print partner (TBD)",
    purpose:
      "Fulfillment of physical canonization cards when Members request the phygital extension.",
    dataCategories: [
      "Identity + contact (shipping address, name)",
      "Contribution record (card art, tier, year — non-personal beyond name)",
    ],
    jurisdiction: "Provider selection pending",
    dpaStatus: "planned",
    addedAt: "2026-07-01 (planned at production launch)",
  },
];

const DPA_LABEL: Record<Subprocessor["dpaStatus"], string> = {
  signed: "DPA signed",
  pending: "DPA in negotiation",
  planned: "Signed at production onboarding",
};
const DPA_COLOR: Record<Subprocessor["dpaStatus"], string> = {
  signed: "#007048",
  pending: "#5070F0",
  planned: "#A3A3A3",
};

export default function SubprocessorRegistry() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Policy</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Subprocessor Registry
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
          Intended production subprocessors with DPAs at production
          onboarding. Sandbox routes no data to any of these — all state
          is in-memory locally.
        </p>
      </div>

      <section className="mt-8 space-y-3 text-sm">
        <div className="text-ink-muted">
          <p>
            The Cooperative shares personal data only with the third
            parties below, and only for the purposes described. Adding a
            new subprocessor requires a 30-day advance notice period
            during which Members may object; removal or replacement
            follows the same window.
          </p>
        </div>

        {SUBPROCESSORS.map((s) => (
          <Card key={s.name}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-display text-lg font-semibold text-ink">
                {s.name}
              </h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                  color: DPA_COLOR[s.dpaStatus],
                  borderColor: DPA_COLOR[s.dpaStatus],
                  borderWidth: 1,
                  borderStyle: "solid",
                }}
              >
                {DPA_LABEL[s.dpaStatus]}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">{s.purpose}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                  Data categories
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
                  {s.dataCategories.map((cat) => (
                    <li key={cat}>· {cat}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                  Jurisdiction
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {s.jurisdiction}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                  Added
                </p>
                <p className="mt-1 text-xs text-ink-muted">{s.addedAt}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <div className="mt-10 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Change notification
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Members are notified of subprocessor additions or replacements
          at least 30 days before the change takes effect. Notification
          fires via the in-app notification rail plus a covenant-level
          email. Members who object can exercise their data rights at{" "}
          <a
            href="/profile/data-rights"
            className="text-brand-magenta hover:underline"
          >
            /profile/data-rights
          </a>{" "}
          before the effective date.
        </p>
      </div>
    </div>
  );
}
