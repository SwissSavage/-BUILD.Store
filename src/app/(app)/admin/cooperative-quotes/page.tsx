/**
 * /admin/cooperative-quotes — Cooperative Quote authoring + management.
 *
 * Distinct from /admin/quotes (which is the RFP member-bid approval
 * queue). This surface manages OUTBOUND proposals — the interactive
 * client-facing quotes that flip-reveal at /quotes/[clientToken].
 *
 * Same operational pattern as /admin/cohort (Tier 6) and
 * /admin/receipts (Tier 7). Every action writes to the immutable
 * audit trail via logAuditEvent().
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_COOPERATIVE_QUOTES } from "@/lib/mock-data/cooperative-quotes";
import { publicName } from "@/lib/types";
import {
  createCooperativeQuote,
  removeCooperativeQuote,
} from "@/lib/quote-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { pricingCompactSummary } from "@/lib/quote-pricing";

/**
 * Candidate cooperators for proposal: Members + Partners. Sorted for
 * a predictable form. Admins can propose themselves — sometimes the
 * founder IS the lead on a founding-client engagement.
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
 * already have a quote authored. Excludes ones with existing quotes
 * so the admin can't double-book. Remove the existing quote first
 * if the plan changes.
 */
function eligibleProjects() {
  return MOCK_PROJECTS.filter(
    (p) =>
      p.kind === "contract" &&
      !MOCK_COOPERATIVE_QUOTES.some((q) => q.projectId === p.id),
  );
}

const STATUS_COLOR: Record<
  (typeof MOCK_COOPERATIVE_QUOTES)[number]["status"],
  string
> = {
  draft: "#A3A3A3",
  sent: "#5070F0",
  viewed: "#D828A0",
  approved: "#007048",
  declined: "#E53E3E",
};

const STATUS_LABEL: Record<
  (typeof MOCK_COOPERATIVE_QUOTES)[number]["status"],
  string
> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  declined: "Declined",
};

export default async function AdminCooperativeQuotesPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) {
    redirect("/signin?next=/admin/cooperative-quotes");
  }

  const quotes = [...MOCK_COOPERATIVE_QUOTES].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const candidates = proposalCandidates();
  const projects = eligibleProjects();

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
            reveals the proposed crew, picks their lead. Same URL
            evolves into the project dashboard after approval.
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

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-muted">
                Proposed cooperators (1-5)
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {candidates.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm hover:border-brand-magenta/50"
                  >
                    <input
                      type="checkbox"
                      name="proposedMemberIds"
                      value={user.id}
                      className="h-4 w-4"
                    />
                    <Avatar user={user} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {publicName(user)}
                      </p>
                      <p className="truncate text-[10px] text-ink-faint">
                        {user.id}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">
                Order matters — the first checked cooperator is the
                recommended lead. Copy user IDs into the relevance
                textarea below.
              </p>
            </div>

            <div>
              <label
                htmlFor="memberRelevance"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Per-member relevance narratives
              </label>
              <textarea
                id="memberRelevance"
                name="memberRelevance"
                rows={6}
                placeholder={
                  "u_bbg: BBG carries the FM voice through every read. Right creative match for the tone URL Media has been building.\n" +
                  "u_sunny: Sunny's brand systems chops mean the film ships with visual assets that carry into cutdowns + OOH.\n" +
                  "u_bayu: Bayu handles the launch microsite — brand-systems work translates into the digital surface."
                }
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-ink-faint">
                One line per cooperator. Format:{" "}
                <code>userId: narrative</code>. Lines without a colon
                or with unknown userIds are silently skipped.
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
                  "Hero film — 3 minutes, delivered in ProRes + H.264\n" +
                  "Social cutdowns — 60s, 30s, 15s\n" +
                  "Launch microsite — single-page interactive"
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
                Timeline
              </label>
              <input
                id="timeline"
                name="timeline"
                type="text"
                required
                placeholder="8 weeks from kickoff. 2 pre-production, 3 production, 3 post."
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            {/* Pricing type radio. Server action reads `pricingType`
                and picks the right amount fields (fixed uses baseAmount
                only, range uses baseAmount + baseAmountMax, hourly uses
                hourlyRate). All three fields are rendered here so the
                admin can pick without a JS-driven conditional show/hide;
                unused fields are ignored server-side. */}
            <fieldset>
              <legend className="block text-xs uppercase tracking-wider text-ink-muted">
                Pricing type
              </legend>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="pricingType"
                    value="fixed"
                    defaultChecked
                    className="accent-brand-magenta"
                  />
                  Fixed
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="pricingType"
                    value="range"
                    className="accent-brand-magenta"
                  />
                  Range
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="pricingType"
                    value="hourly"
                    className="accent-brand-magenta"
                  />
                  Hourly
                </label>
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                Fixed uses base amount only. Range uses base amount as
                min plus max. Hourly uses the hourly rate.
              </p>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="baseAmount"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Base amount / range min (USD)
                </label>
                <input
                  id="baseAmount"
                  name="baseAmount"
                  type="number"
                  min={1}
                  placeholder="45000"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="baseAmountMax"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Range max (USD)
                </label>
                <input
                  id="baseAmountMax"
                  name="baseAmountMax"
                  type="number"
                  min={1}
                  placeholder="55000"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[10px] text-ink-faint">
                  Range only. Leave blank for fixed or hourly.
                </p>
              </div>
              <div>
                <label
                  htmlFor="hourlyRate"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Hourly rate (USD/hr)
                </label>
                <input
                  id="hourlyRate"
                  name="hourlyRate"
                  type="number"
                  min={1}
                  placeholder="150"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[10px] text-ink-faint">
                  Hourly only. Leave blank for fixed or range.
                </p>
              </div>
              <div>
                <label
                  htmlFor="talentSplit"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Talent split (%)
                </label>
                <input
                  id="talentSplit"
                  name="talentSplit"
                  type="number"
                  step={0.1}
                  defaultValue={85}
                  required
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="operationsSplit"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Ops split (%)
                </label>
                <input
                  id="operationsSplit"
                  name="operationsSplit"
                  type="number"
                  step={0.1}
                  defaultValue={15}
                  required
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-ink-faint">
              Splits must sum to 100. Baseline is 85/15 — override only
              when the engagement diverged.
            </p>

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
              const project = MOCK_PROJECTS.find(
                (p) => p.id === quote.projectId,
              );

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
                      {pricingCompactSummary(quote.pricing)} ·{" "}
                      {quote.proposedMemberIds.length}{" "}
                      {quote.proposedMemberIds.length === 1
                        ? "cooperator"
                        : "cooperators"}{" "}
                      · {quote.pricing.talentSplit}/
                      {quote.pricing.operationsSplit} split
                    </CardTitle>
                    <p className="mt-3 text-xs text-ink-muted">
                      Client magic-link (production dispatches to the
                      client contact):
                    </p>
                    <code className="mt-1 block break-all rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-[11px] text-ink">
                      /quotes/{quote.clientToken}
                    </code>

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
