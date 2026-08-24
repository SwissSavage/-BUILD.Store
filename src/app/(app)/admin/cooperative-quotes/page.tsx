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
 * audit trail via logAuditEvent().
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { notInArray, desc, eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cooperativeQuotes as cooperativeQuotesTable,
  projects as projectsTable,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { publicName, type ProposedBuilder } from "@/lib/types";
import {
  createCooperativeQuote,
  removeCooperativeQuote,
  retrySowDispatch,
} from "@/lib/quote-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  aggregateHeadline,
  aggregateUnitLabel,
  deriveAggregatePricing,
} from "@/lib/quote-pricing";

/**
 * Candidate builders for proposal: Members + Partners. Sorted for
 * a predictable reference table. Admins can propose themselves —
 * sometimes the founder IS the lead on a founding-client engagement.
 *
 * Reads from seeded MOCK_USERS (which was mirrored into Postgres at
 * seed time). Full Drizzle swap of the users table read path is a
 * separate concern; this stays as mock read for now since seed keeps
 * both in sync.
 */
function proposalCandidates() {
  return [...MOCK_USERS]
    .filter(
      (u) =>
        u.membershipTier === "member" || u.membershipTier === "partner",
    )
    .sort((a, b) =>
      publicName(a).localeCompare(publicName(b), "en", {
        sensitivity: "base",
      }),
    );
}

/**
 * Eligible projects for quoting — contracts (not RFPs) that don't
 * already have a quote authored. Fetches from Postgres, excludes
 * projects with existing quotes via a NOT IN subquery so the admin
 * can't double-book. Remove the existing quote first if the plan
 * changes.
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
            notInArray(projectsTable.id, takenIds),
          )
        : eq(projectsTable.kind, "contract"),
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

/** JSON schema example — rendered as the composer placeholder. */
const BUILDER_JSON_TEMPLATE = `[
  {
    "userId": "u_bbg",
    "pricing": {
      "type": "range",
      "baseAmountMin": 18000,
      "baseAmountMax": 24000,
      "talentSplit": 85,
      "operationsSplit": 15
    },
    "timeline": "6 weeks across pre-pro, production, and post",
    "relevance": "BBG carries the FM voice through every read."
  },
  {
    "userId": "u_sunny",
    "pricing": {
      "type": "fixed",
      "baseAmount": 14000,
      "talentSplit": 85,
      "operationsSplit": 15
    },
    "timeline": "5 weeks brand direction",
    "relevance": "Sunny's brand systems chops mean the film ships coherent."
  }
]`;

export default async function AdminCooperativeQuotesPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) {
    redirect("/signin?next=/admin/cooperative-quotes");
  }

  const quotes = await db
    .select()
    .from(cooperativeQuotesTable)
    .orderBy(desc(cooperativeQuotesTable.createdAt));
  const candidates = proposalCandidates();
  const projects = await eligibleProjects();

  // Batch-load the projects referenced by existing quotes so the list
  // renderer below can label each quote with its project title without
  // an N+1 lookup. Post-Beta-cutover swap of the old MOCK_PROJECTS.find
  // per-row pattern.
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
            Author the interactive quote a client receives after a
            consultation call. Client visits{" "}
            <code>/quotes/[clientToken]</code>, sees face-down cards,
            reveals the proposed crew (each Builder carries their own
            price + timeline right on the card), picks their lead. Same
            URL evolves into the project dashboard after approval.
          </p>
        </div>
      </div>

      {/* Author a new quote */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Author a new quote
        </h2>
        {projects.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              Every eligible contract project already has a quote.
              Remove an existing quote below to re-author.
            </p>
          </Card>
        ) : (
          <form
            action={createCooperativeQuote}
            className="mt-6 space-y-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
          >
            <div>
              <label
                htmlFor="projectId"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Project
              </label>
              <select
                id="projectId"
                name="projectId"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pick a contract project…
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink-faint">
                Only contracts without existing quotes appear here.
              </p>
            </div>

            <div>
              <label
                htmlFor="clientDisplayName"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Client display name
              </label>
              <input
                id="clientDisplayName"
                name="clientDisplayName"
                type="text"
                required
                placeholder="URL Media"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                How the client is referred to on the quote header.
              </p>
            </div>

            {/* Candidate reference table — read-only lookup of userIds
                so the admin can copy them into the JSON below. Members
                + Partners only. */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-muted">
                Candidate builders (reference)
              </label>
              <div className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
                {candidates.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1"
                  >
                    <span className="truncate font-medium">
                      {publicName(user)}
                    </span>
                    <code className="text-[10px] text-ink-faint">
                      {user.id}
                    </code>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">
                Copy the userIds into the proposedBuilders JSON below.
                Order matters — the first entry is the recommended lead.
              </p>
            </div>

            <div>
              <label
                htmlFor="proposedBuildersJson"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Proposed builders (JSON, 1-5 entries)
              </label>
              <textarea
                id="proposedBuildersJson"
                name="proposedBuildersJson"
                rows={16}
                required
                placeholder={BUILDER_JSON_TEMPLATE}
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Each Builder carries per-Builder pricing (fixed / range
                / hourly), timeline, and relevance line. Aggregate
                engagement total derives from the sum of picked
                Builders on the client surface. Full per-Builder subform
                UI is queued for a follow-on tier.
              </p>
            </div>

            <div>
              <label
                htmlFor="scopeSummary"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Scope summary
              </label>
              <textarea
                id="scopeSummary"
                name="scopeSummary"
                rows={3}
                required
                minLength={20}
                placeholder="One-paragraph summary of what the crew delivers. Shown in the client's Scope section."
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="deliverables"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Deliverables (one per line)
              </label>
              <textarea
                id="deliverables"
                name="deliverables"
                rows={5}
                required
                placeholder={
                  "Hero film, 3 minutes, delivered in ProRes + H.264\n" +
                  "Social cutdowns: 60s, 30s, 15s\n" +
                  "Launch microsite, single-page interactive"
                }
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Newline-separated. Leading bullets (- * · •) stripped
                automatically.
              </p>
            </div>

            <div>
              <label
                htmlFor="timeline"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Engagement timeline rhythm
              </label>
              <input
                id="timeline"
                name="timeline"
                type="text"
                required
                placeholder="8 weeks from kickoff. 2 pre-production, 3 production, 3 post."
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                Engagement-level phase story. Per-Builder timelines
                live on each entry in the JSON above.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
              >
                Create quote
              </button>
            </div>
          </form>
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
              const aggregate = deriveAggregatePricing(proposedBuilders);
              const aggregateLine =
                `${aggregateHeadline(aggregate)}${
                  aggregateUnitLabel(aggregate)
                    ? ` ${aggregateUnitLabel(aggregate)}`
                    : ""
                }`;

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
                    <p className="mt-3 text-xs text-ink-muted">
                      Client magic-link (production dispatches to the
                      client contact):
                    </p>
                    <code className="mt-1 block break-all rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-[11px] text-ink">
                      /quotes/{quote.clientToken}
                    </code>

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
                              className="rounded-full border border-brand-magenta px-3 py-1 text-[10px] font-medium text-brand-magenta hover:bg-brand-magenta hover:text-white"
                            >
                              Retry SOW dispatch
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={`/quotes/${quote.clientToken}`}
                        className="text-xs text-brand-magenta hover:underline"
                      >
                        Preview client view →
                      </Link>
                      <form action={removeCooperativeQuote}>
                        <input
                          type="hidden"
                          name="id"
                          value={quote.id}
                        />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint hover:text-brand-magenta"
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
