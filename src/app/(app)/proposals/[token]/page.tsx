/**
 * Client-facing proposal view (Phase 1.2).
 *
 * Reached via a signed magic-link emailed to the client when an admin approves
 * a quote sheet. No login required — the token IS the credential. Mirrors the
 * URL Media "service provider proposal" Google-Doc layout, scrubbed of any
 * contributor PII.
 *
 * What the client sees:
 *   - Cooperative letterhead + their logical client label (no internal IDs).
 *   - The RFP title, scope, and pillar.
 *   - The team option: pillar + skills + work samples + admin-authored
 *     strengths/weaknesses + approved price/timeline. Contributor name is
 *     redacted to a cooperative handle ("Cooperative member · {pillar}").
 *   - A "respond" CTA that opens a mailto to the cooperative inbox — every
 *     reply path runs through the platform; no contributor email is ever
 *     surfaced.
 *
 * What the client does NOT see:
 *   - Contributor names, emails, phone numbers, social handles.
 *   - The member's `memberNote` (admin-only context).
 *   - Other quote sheets attached to the same RFP — each quote is sent as its
 *     own proposal so the client compares like-with-like and the cooperative
 *     controls the framing per send.
 *
 * View tracking: incrementing `viewCount` and updating `lastViewedAt` on every
 * GET. Sandbox just mutates MOCK_PROPOSALS; production writes through Drizzle
 * + maybe queues a Slack ping to the contract's admins so they can react in
 * real time.
 *
 * REPLACE WITH: Drizzle lookup on `client_proposals.token`, JWT signature
 * verification, audit-log entry per view. Token expiry handled at the lookup
 * layer (not just visually).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_PROPOSALS } from "@/lib/mock-data/proposals";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  INDUSTRY_LABELS,
  clientQuoteView,
  userPillars,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

// Friendly client labels. In production this is just the CRM record's
// company name; sandbox keeps a tiny lookup so we don't surface raw IDs.
const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_dcg: "Direct Connect Global",
};

export default async function ClientProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = MOCK_PROPOSALS.find((p) => p.token === token);
  if (!proposal) notFound();

  const expired = new Date(proposal.expiresAt).getTime() < Date.now();
  if (expired) return <ExpiredView />;

  const quote = MOCK_QUOTES.find((q) => q.id === proposal.quoteSheetId);
  const project = MOCK_PROJECTS.find((p) => p.id === proposal.contractId);
  const clientView = quote ? clientQuoteView(quote) : null;
  if (!quote || !project || !clientView) notFound();

  // Track the view. Side effect during render is non-ideal but acceptable in
  // the sandbox; production does this in a route handler before the page
  // renders so retries and pre-render are clean.
  proposal.viewCount += 1;
  proposal.lastViewedAt = new Date().toISOString();

  // Pillar for the contributor (used as the only identity surface — no name).
  const contributor = MOCK_USERS.find((u) => u.id === clientView.userId);
  const contributorPillars = contributor ? userPillars(contributor) : [];
  const primaryPillar = contributorPillars[0] ?? project.industry;
  const contributorLabel = `Cooperative member · ${INDUSTRY_LABELS[primaryPillar]}`;

  const clientLabel = CLIENT_LABELS[project.clientId] ?? "Your team";
  const sentDate = new Date(proposal.sentAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const expiresDate = new Date(proposal.expiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Cooperative letterhead — kept understated; the proposal content
          should carry the visual weight. */}
      <header className="border-b border-[var(--surface-border)] pb-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold">
            $BUILD<span className="text-brand-magenta">.Store</span>
          </Link>
          <div className="text-right text-xs text-ink-muted">
            <div>Prepared for {clientLabel}</div>
            <div>{sentDate}</div>
          </div>
        </div>
      </header>

      <div className="mt-8 text-xs uppercase tracking-wider text-brand-magenta">
        Proposal
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">
        {project.title}
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        {INDUSTRY_LABELS[project.industry]} · Submitted by Future Modern
        Builderberg via the $BUILD.Store cooperative.
      </p>

      <Card className="mt-8">
        <CardEyebrow>Scope</CardEyebrow>
        <p className="mt-3 leading-relaxed">{project.description}</p>
        {project.skillsRequired.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {project.skillsRequired.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2.5 py-0.5 text-xs"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Recommended team option</CardEyebrow>
        <CardTitle className="mt-2">{contributorLabel}</CardTitle>
        <p className="mt-1 text-xs text-ink-faint">
          The cooperative routes all communication. Reply to this email and
          the contract&apos;s admin will introduce the right people at the
          right time.
        </p>

        {clientView.strengths && (
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Strengths
            </div>
            <p className="mt-1.5 leading-relaxed">{clientView.strengths}</p>
          </div>
        )}

        {clientView.weaknesses && (
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Considerations
            </div>
            <p className="mt-1.5 leading-relaxed">{clientView.weaknesses}</p>
          </div>
        )}

        {clientView.workSamples.length > 0 && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Work samples
            </div>
            <ul className="mt-3 space-y-3">
              {clientView.workSamples.map((s) => (
                <li
                  key={s.url}
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-4 py-3"
                >
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-medium text-brand-magenta hover:underline"
                  >
                    {s.url.replace(/^https?:\/\//, "")}
                  </a>
                  <p className="mt-1 text-sm text-ink-muted">{s.caption}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardEyebrow>Investment</CardEyebrow>
          <p className="mt-3 leading-relaxed">{clientView.price}</p>
        </Card>
        <Card>
          <CardEyebrow>Timeline</CardEyebrow>
          <p className="mt-3 leading-relaxed">{clientView.timeline}</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardEyebrow>Next step</CardEyebrow>
        <p className="mt-3 leading-relaxed">
          If this team and approach feel right, reply to the email this link
          arrived in or click below to start a thread with the cooperative.
          We&apos;ll set up a 30-minute scope-confirmation call and move into a
          signed engagement.
        </p>
        <a
          href={`mailto:contracts@afuturemodern.com?subject=${encodeURIComponent(
            `Re: ${project.title} — proposal ${proposal.id}`,
          )}`}
          className="mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Reply to the cooperative
        </a>
      </Card>

      <footer className="mt-10 border-t border-[var(--surface-border)] pt-4 text-xs text-ink-faint">
        Magic-link proposal · expires {expiresDate} · viewed{" "}
        {proposal.viewCount} {proposal.viewCount === 1 ? "time" : "times"}.
        Future Modern Builderberg LLC · all communication routes through the
        cooperative.
      </footer>
    </div>
  );
}

function ExpiredView() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card>
        <CardEyebrow>Link expired</CardEyebrow>
        <CardTitle className="mt-2">This proposal is no longer live.</CardTitle>
        <p className="mt-3 text-ink-muted">
          Magic-link proposals expire 30 days after they&apos;re sent. Email{" "}
          <a
            href="mailto:contracts@afuturemodern.com"
            className="text-brand-magenta hover:underline"
          >
            contracts@afuturemodern.com
          </a>{" "}
          and the cooperative will resend a fresh link if the engagement is
          still on the table.
        </p>
      </Card>
    </div>
  );
}
