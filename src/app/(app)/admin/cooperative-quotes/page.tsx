/**
 * /admin/cooperative-quotes — Cooperative Quote authoring + management.
 *
 * Distinct from /admin/quotes (which is the RFP member-bid approval
 * queue). This surface manages OUTBOUND proposals — the interactive
 * client-facing quotes that flip-reveal at /quotes/[clientToken].
 *
 * Tier 21 composer shape:
 *   - Pricing lives on each proposed Builder — matches Jamar's Google
 *     Doc quote-sheet format (Service Provider | Quote | Timeline per
 *     row). Aggregate engagement total is derived from the picked hand
 *     on the client-facing surface.
 *   - Admin composes the proposedBuilders array as a JSON block via
 *     the textarea below. Each entry carries userId + pricing (fixed
 *     / range / hourly) + per-Builder timeline + relevance narrative.
 *     A full per-Builder subform UI (dynamic add / remove Builder
 *     cards with radio + amount inputs) is queued as a follow-on
 *     tier — JSON keeps the schema honest without dynamic-form-fields
 *     scaffolding.
 *   - Scope block (engagement summary, deliverables, timeline rhythm)
 *     stays engagement-level, not per-Builder.
 *
 * Same operational pattern as /admin/cohort (Tier 6) and
 * /admin/receipts (Tier 7). Every action writes to the immutable
 * audit trail via await logAuditEvent().
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { notInArray, desc, eq, and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cooperativeQuotes as cooperativeQuotesTable,
  projects as projectsTable,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { type ProposedBuilder } from "@/lib/types";
import {
  removeCooperativeQuote,
  returnQuoteToDraft,
  retrySowDispatch,
} from "@/lib/quote-actions";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  aggregateHeadline,
  aggregateUnitLabel,
  deriveAggregatePricing,
} from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

/**
 * Quote composition starts from an approved RFP's applications. Keeping
 * the project picker here, and the applicant picker on the RFP's bid page,
 * prevents the old all-roster JSON workflow from bypassing project scope.
 */
async function eligibleProjects() {
  const alreadyQuoted = await db
    .select({ projectId: cooperativeQuotesTable.projectId })
    .from(cooperativeQuotesTable);
  const takenIds = alreadyQuoted.map((q) => q.projectId);

  return await db
    .select()
    .from(projectsTable)
    .where(
      takenIds.length > 0
        ? and(
            eq(projectsTable.kind, "contract"),
            eq(projectsTable.isRfp, true),
            eq(projectsTable.status, "open"),
            isNotNull(projectsTable.rfpApprovedAt),
            notInArray(projectsTable.id, takenIds),
          )
        : and(
            eq(projectsTable.kind, "contract"),
            eq(projectsTable.isRfp, true),
            eq(projectsTable.status, "open"),
            isNotNull(projectsTable.rfpApprovedAt),
          ),
    );
}

type QuoteStatus = "draft" | "sent" | "viewed" | "approved" | "declined";

const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft: "#A3A3A3",
  sent: "#5070F0",
  viewed: "#D828A0",
  approved: "#007048",
  declined: "#E53E3E",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  declined: "Declined",
};

/**
 * Where this deployment lives, for links an admin copies out of the
 * product and pastes into an email. Falls back to the production host
 * rather than to a relative path, because a half-written URL in a
 * client's inbox is worse than one pointing at the wrong environment.
 */
const siteOrigin = (
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "https://build.afuturemodern.com"
).replace(/\/$/, "");

export default async function AdminCooperativeQuotesPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) {
    redirect("/signin?next=/admin/cooperative-quotes");
  }

  const quotes = await db
    .select()
    .from(cooperativeQuotesTable)
    .orderBy(desc(cooperativeQuotesTable.createdAt));
  const projects = await eligibleProjects();

  // Batch-load the projects referenced by existing quotes so the list
  // renderer below can label each quote with its project title without
  // an N+1 lookup, replacing the old per-row fixture find.
  const quoteProjectIds = quotes.map((q) => q.projectId);
  const quoteProjects =
    quoteProjectIds.length > 0
      ? await db
          .select({
            id: projectsTable.id,
            title: projectsTable.title,
          })
          .from(projectsTable)
          .where(inArray(projectsTable.id, quoteProjectIds))
      : [];
  const quoteProjectById = new Map(
    quoteProjects.map((p) => [p.id, p]),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Cooperative Quotes</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Pre-project client proposals
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Start with an RFP&apos;s actual applicants, then curate three to five
            builders into the interactive quote a client receives. The
            client visits <code>/quotes/[clientToken]</code>, reviews the
            portrait cards, and chooses a lead.
          </p>
        </div>
      </div>

      {/* Author a new quote */}
      <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">
            Start a client quote
          </h2>
        {projects.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No approved RFP without a quote is ready for compilation.
              Approve an RFP, then collect applications before returning here.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 grid gap-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/admin/rfps/${project.id}/bids`}
                  className="block rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-brand-magenta"
                >
                  <CardTitle>{project.title}</CardTitle>
                  <p className="mt-2 text-sm text-ink-muted">
                    Review this RFP&apos;s applicants and curate three to five
                    people for the client quote.
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Existing quotes */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Existing quotes
        </h2>
        {quotes.length === 0 ? (
          <Card className="mt-6">
            <p className="text-sm text-ink-muted">
              No quotes authored yet. Compose the first one above.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-4">
            {quotes.map((quote) => {
              const project = quoteProjectById.get(quote.projectId);
              // proposedBuilders is jsonb → typed unknown by Drizzle.
              // Cast to the canonical shape; the authoring flow
              // enforces it at insert time.
              const proposedBuilders =
                quote.proposedBuilders as ProposedBuilder[];

              // ────────────────────────────────────────────────
              // WHY TWO NUMBERS (2026-10-07)
              //
              // This showed one line, derived from `pricing`, which is
              // what the BUILDER is paid. It sat under the label
              // "billed as delivered", which is client-facing wording,
              // so the same quote read $55/hr here and $77/hr on the
              // client's own page and nothing on screen explained the
              // gap.
              //
              // Both now, labelled. The client number first because
              // that is the one discussed on a call, the payout beside
              // it because that is the one an admin is accountable for.
              // ────────────────────────────────────────────────
              const clientAggregate = deriveAggregatePricing(
                proposedBuilders.map((b) => ({
                  ...b,
                  pricing: b.clientPricing ?? b.pricing,
                })),
              );
              const payoutAggregate = deriveAggregatePricing(proposedBuilders);
              const line = (a: ReturnType<typeof deriveAggregatePricing>) =>
                `${aggregateHeadline(a)}${
                  aggregateUnitLabel(a) ? ` ${aggregateUnitLabel(a)}` : ""
                }`;
              const aggregateLine = line(clientAggregate);
              const payoutLine = line(payoutAggregate);

              return (
                <li key={quote.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardEyebrow>
                        {quote.clientDisplayName} ·{" "}
                        {project?.title ?? quote.projectId}
                      </CardEyebrow>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          color: STATUS_COLOR[quote.status],
                          borderColor: STATUS_COLOR[quote.status],
                          borderWidth: 1,
                          borderStyle: "solid",
                        }}
                      >
                        {STATUS_LABEL[quote.status]}
                      </span>
                    </div>
                    <CardTitle className="mt-1 text-lg">
                      {aggregateLine} ·{" "}
                      {proposedBuilders.length}{" "}
                      {proposedBuilders.length === 1
                        ? "builder"
                        : "builders"}
                    </CardTitle>
                    <p className="mt-1 text-xs text-ink-faint">
                      Client sees {aggregateLine}. Builders are paid{" "}
                      {payoutLine}.
                    </p>
                    {quote.status === "draft" ? (
                      <p className="mt-3 text-xs text-ink-muted">
                        Internal draft. The client link is inactive and selected bids remain editable.
                      </p>
                    ) : (
                      <>
                        {/* The whole URL, and a button that puts it on
                            the clipboard or into the share sheet.

                            This used to render the bare path
                            "/quotes/q_..." in a code block: nothing to
                            click, no origin, and an admin about to send
                            a proposal had to know to prepend the domain
                            by hand. The one place in the product where
                            a URL is the deliverable was the one place
                            it was not a URL. */}
                        <p className="mt-3 text-xs text-ink-muted">
                          Client link. Send this to the client.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <CopyLinkButton
                            url={`${siteOrigin}/quotes/${quote.clientToken}`}
                            shareTitle={`Future Modern proposal for ${quote.clientDisplayName}`}
                          />
                          <a
                            href={`/quotes/${quote.clientToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] hover:border-brand-magenta hover:text-brand-magentaText"
                          >
                            Open ↗
                          </a>
                        </div>
                        <code className="mt-2 block break-all rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-[11px] text-ink">
                          {siteOrigin}/quotes/{quote.clientToken}
                        </code>
                      </>
                    )}

                    {/* Task #45 — SOW dual-envelope status strip.
                        Only renders on approved quotes since dispatch
                        fires from approveCooperativeQuote. */}
                    {quote.status === "approved" && (
                      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-[11px]">
                        <div className="font-medium uppercase tracking-wider text-ink-muted">
                          SOW dispatch
                        </div>
                        <div className="mt-1 grid gap-1 text-ink">
                          <div>
                            Client SOW:{" "}
                            {quote.sowClientSignedAt
                              ? `✓ signed ${new Date(quote.sowClientSignedAt).toLocaleDateString()}`
                              : quote.clientSowDocumensoId
                                ? `sent (envelope ${quote.clientSowDocumensoId})`
                                : "⚠ not dispatched"}
                          </div>
                          <div>
                            Talent engagement:{" "}
                            {quote.sowTalentSignedAt
                              ? `✓ signed ${new Date(quote.sowTalentSignedAt).toLocaleDateString()}`
                              : quote.talentEngagementDocumensoId
                                ? `sent (envelope ${quote.talentEngagementDocumensoId})`
                                : "⚠ not dispatched"}
                          </div>
                        </div>
                        {(!quote.clientSowDocumensoId ||
                          !quote.talentEngagementDocumensoId) && (
                          <form
                            action={retrySowDispatch}
                            className="mt-2"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={quote.id}
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-brand-magenta px-3 py-1 text-[10px] font-medium text-brand-magentaText hover:bg-brand-magenta hover:text-black"
                            >
                              Retry SOW dispatch
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                      {quote.status === "draft" ? (
                        <Link
                          href={`/admin/rfps/${quote.projectId}/bids`}
                          className="text-xs text-brand-magentaText hover:underline"
                        >
                          Continue editing draft →
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/quotes/${quote.clientToken}`}
                            className="text-xs text-brand-magentaText hover:underline"
                          >
                            Preview client view →
                          </Link>
                          {/* compileBidsIntoQuote refuses to touch a
                              quote that is no longer a draft and tells
                              you to make a revised one. Nothing made
                              one, so a sent quote was frozen and the
                              only way out was deleting it, which takes
                              the client token with it and breaks the
                              link already in their inbox.

                              Not offered on approved or declined. That
                              is a decision, and reversing it goes
                              through the client page, which asks them
                              to confirm their email first. */}
                          {(quote.status === "sent" ||
                            quote.status === "viewed") && (
                            <form action={returnQuoteToDraft}>
                              <input type="hidden" name="id" value={quote.id} />
                              <button
                                type="submit"
                                className="text-xs text-ink-muted hover:text-brand-magentaText hover:underline"
                                title="Pulls this back to draft so you can rebuild it from the bids. The client link keeps working and shows the draft state."
                              >
                                Pull back to draft
                              </button>
                            </form>
                          )}
                        </>
                      )}
                      <form action={removeCooperativeQuote}>
                        <input
                          type="hidden"
                          name="id"
                          value={quote.id}
                        />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint hover:text-brand-magentaText"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
