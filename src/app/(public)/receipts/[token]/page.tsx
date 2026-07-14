/**
 * /receipts/[token] — Cooperative Receipt for a settled engagement.
 *
 * The gated proof-of-improvement layer. Reached via signed magic-link
 * emailed to the client contact when a project's settlement completes.
 * No account needed — the token is the credential (same pattern as
 * /invoices/[token], /proposals/[token]).
 *
 * What the client sees:
 *   - Cash flow % to the builders who did the work.
 *   - Time from RFP to matched crew.
 *   - Milestone hit rate on the engagement.
 *   - Aggregate peer-review OVR delta the crew earned during the
 *     project — signals how they held up under cooperative scrutiny.
 *   - "What the crew shipped after you" — subsequent engagements the
 *     same builders contributed to. Turns the receipt into an
 *     ongoing story: the client's project helped fund what came next.
 *   - Optional Collaborator Card claim (phase 3 mint, currently
 *     surfaced as coming-soon copy).
 *
 * What the client does NOT see:
 *   - Named contributors on this project (first-name-only elsewhere;
 *     the receipt keeps a crew-level view intentionally).
 *   - Internal peer review notes.
 *   - Financial line items — those live on /invoices/[token].
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { findCooperativeReceipt } from "@/lib/mock-data/cooperative-receipts";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

/** Static-rendered by token — Next builds one page per known token. */
export const dynamic = "force-static";

/**
 * Pre-generate the static params for every known receipt token so
 * Next builds a page for each at build time. Production replaces with
 * a Drizzle lookup on `cooperative_receipts.client_token`.
 */
export async function generateStaticParams() {
  const { MOCK_COOPERATIVE_RECEIPTS } = await import(
    "@/lib/mock-data/cooperative-receipts"
  );
  return MOCK_COOPERATIVE_RECEIPTS.map((r) => ({ token: r.clientToken }));
}

const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_dcg: "Direct Connect Global",
  client_bk_greenroots: "Brooklyn GreenRoots",
  client_arborai: "ArborAI",
};

export default async function CooperativeReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const receipt = findCooperativeReceipt(token);
  if (!receipt) notFound();

  const project = MOCK_PROJECTS.find((p) => p.id === receipt.projectId);
  if (!project) notFound();

  const clientLabel =
    CLIENT_LABELS[project.clientId] ?? "the client team";

  const subsequentProjects = receipt.subsequentProjectIds
    .map((id) => MOCK_PROJECTS.find((p) => p.id === id))
    .filter((p): p is (typeof MOCK_PROJECTS)[number] => !!p);

  const generatedDate = new Date(receipt.generatedAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" },
  );

  const hitRatePct = Math.round(
    (receipt.milestonesHit / receipt.milestonesTotal) * 100,
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <CardEyebrow>Cooperative Receipt</CardEyebrow>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight">
        Thank you for building with us.
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        A receipt of what shipped, where the money went, and how the
        crew held up. Generated on {generatedDate} for {clientLabel} on{" "}
        <span className="text-ink">{project.title}</span>.
      </p>

      {/* Primary receipt metrics — four stat blocks in the cooperative's
          differentiated commitments. */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardEyebrow>Cash flow to builders</CardEyebrow>
          <p className="mt-2 font-display text-4xl font-semibold text-brand-green">
            {receipt.cashFlowPct}
            <span className="text-2xl">%</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            of contract value paid directly to the builders who
            shipped this project. The remaining 15% covers cooperative
            operations. No platform take-rate. No agency middleman.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Time to matched crew</CardEyebrow>
          <p className="mt-2 font-display text-4xl font-semibold text-brand-blue">
            {receipt.timeToMatchHours}
            <span className="text-2xl"> hrs</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            from RFP submission to first curated crew presented. Not
            weeks. Not a résumé flood. A curated 3-to-5 set inside the
            zone of possible agreement.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Milestones hit on schedule</CardEyebrow>
          <p className="mt-2 font-display text-4xl font-semibold text-brand-magenta">
            {receipt.milestonesHit}
            <span className="text-2xl">
              {" "}
              / {receipt.milestonesTotal}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {hitRatePct}% delivery integrity. Every milestone tracked
            in real time, no closed-book surprises.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Crew peer-review OVR delta</CardEyebrow>
          <p className="mt-2 font-display text-4xl font-semibold text-brand-blue">
            +{receipt.crewPeerReviewOvrDelta.toFixed(1)}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            The builders on this project earned this OVR gain from
            peer review after your engagement. Quality validated by
            the people they ship alongside.
          </p>
        </Card>
      </div>

      {/* "What the crew shipped after you" — the retention line. */}
      {subsequentProjects.length > 0 && (
        <section className="mt-16">
          <CardEyebrow>What the crew shipped after you</CardEyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Your engagement helped fund the next builds.
          </h2>
          <p className="mt-3 text-ink-muted">
            The builders on your project didn&apos;t clock out. Since
            your engagement settled, they&apos;ve shipped{" "}
            {subsequentProjects.length}{" "}
            {subsequentProjects.length === 1 ? "engagement" : "engagements"}{" "}
            through the cooperative. You didn&apos;t just close a contract.
            You kept a team building.
          </p>
          <ul className="mt-6 space-y-3">
            {subsequentProjects.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardTitle className="text-lg">{p.title}</CardTitle>
                  <p className="mt-2 text-sm text-ink-muted">
                    {p.description}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Collaborator Card — phase 3 mint, coming-soon copy for now. */}
      <section className="mt-16 rounded-2xl border border-brand-blue/30 bg-brand-blue/5 px-6 py-6">
        <CardEyebrow>Collaborator Card</CardEyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          Coming: an on-chain keepsake of what we built together.
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          At mint launch, every client who ships through the cooperative
          will be able to claim a Collaborator Card. A lightweight
          ERC-721 tied to the engagement, held in your own wallet. Not
          a bill, not a receipt of payment; a durable record that you
          helped build a piece of the cooperative. When that rail opens,
          this receipt gets a claim button.
        </p>
      </section>

      {/* Follow-up CTA — hire again, browse the roster. */}
      <section className="mt-16 rounded-2xl border border-brand-magenta/30 bg-brand-magenta/5 px-6 py-6">
        <h2 className="font-display text-2xl font-semibold text-brand-magenta">
          Build with us again.
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          The same crew is available for follow-on work. New crews are
          spinning up every month as the cooperative onboards.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
          >
            Start a new project →
          </Link>
          <Link
            href="/cohort"
            className="inline-flex items-center rounded-full border border-brand-blue/60 px-5 py-2 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue/10"
          >
            See who&apos;s joining →
          </Link>
        </div>
      </section>

      <p className="mt-12 text-center text-[10px] uppercase tracking-wider text-ink-faint">
        Cooperative Receipt · Confidential to {clientLabel} · Not a bill
      </p>
    </div>
  );
}
