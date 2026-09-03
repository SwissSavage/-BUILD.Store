/**
 * /admin/rfps/[id]/bids — bid triage + client-facing quote compiler
 * (task #41).
 *
 * Flow context: after admin approves an RFP (rfp-actions), dispatch
 * fires notifications to matched talent (task #36 dispatch page), and
 * talent submits bids on /contracts/[id] which land as
 * project_applications. THIS page is where those bids get curated
 * into the 3–5-card client comparison — the endpoint of the RFP-to-
 * client-quote arc.
 *
 * The admin picks 3–5 bids, jots a curated per-bid relevance one-
 * liner, and authors engagement-level scope (summary, deliverables,
 * timeline). Submitting compiles those picks into a single
 * cooperative_quote whose /quotes/[token] surface renders each pick
 * as a TalentHand card with per-Builder pricing pulled from the bid's
 * proposed hourly rate.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-stub";
import { memberLabel } from "@/lib/member-label";
import { db } from "@/db/client";
import {
  cooperativeQuotes,
  projectApplications,
  projects,
  users,
} from "@/db/schema";
import { compileBidsIntoQuote } from "@/lib/rfp-bid-compile-actions";
import { scrubForClient } from "@/lib/pii-scrub";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

interface Params {
  id: string;
}

export default async function RfpBidCompilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [rfp] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (
    !rfp ||
    rfp.kind !== "contract" ||
    !rfp.isRfp ||
    rfp.status !== "open" ||
    !rfp.rfpApprovedAt
  ) {
    notFound();
  }

  // Existing quote check — surface a warning + link, don't render the
  // composer, since compileBidsIntoQuote will throw on double-compile.
  const [existingQuote] = await db
    .select({
      id: cooperativeQuotes.id,
      clientToken: cooperativeQuotes.clientToken,
      status: cooperativeQuotes.status,
    })
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.projectId, id))
    .limit(1);

  const bids = await db
    .select({
      id: projectApplications.id,
      userId: projectApplications.userId,
      proposedRole: projectApplications.proposedRole,
      pitch: projectApplications.pitch,
      hoursPerWeek: projectApplications.hoursPerWeek,
      hourlyRate: projectApplications.hourlyRate,
      portfolioLink: projectApplications.portfolioLink,
      status: projectApplications.status,
      createdAt: projectApplications.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
      handle: users.handle,
      tagline: users.tagline,
      // memberLabel derives the dense-slot label from these rather
      // than the retired `discipline` column.
      primaryIndustry: users.primaryIndustry,
      secondaryIndustries: users.secondaryIndustries,
      skills: users.skills,
      membershipTier: users.membershipTier,
    })
    .from(projectApplications)
    .leftJoin(users, eq(users.id, projectApplications.userId))
    .where(
      and(
        eq(projectApplications.projectId, id),
        sql`${projectApplications.status} IN ('pending', 'approved')`,
      ),
    )
    .orderBy(desc(projectApplications.createdAt));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin/rfps"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← RFP queue
      </Link>

      <div className="mt-3">
        <CardEyebrow>Compile bids into client quote</CardEyebrow>
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {rfp.title}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Pick 3–5 bids. Each becomes a TalentHand card on the client
        magic-link. Per-Builder pricing seeds from each bid's
        proposed hourly rate.
      </p>

      <div className="mt-4 flex gap-3 text-xs">
        <Link
          href={`/admin/rfps/${id}/dispatch`}
          className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
        >
          ← Dispatch to more talent
        </Link>
        <Link
          href={`/contracts/${id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
        >
          Public contract page ↗
        </Link>
      </div>

      {existingQuote && (
        <Card className="mt-6 border-brand-magenta/40 bg-[var(--surface-elevated)]">
          <CardEyebrow>Quote already compiled</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            A cooperative quote already exists for this RFP (status:{" "}
            <span className="font-medium">{existingQuote.status}</span>).
            Remove it before re-compiling.
          </p>
          <div className="mt-3 flex gap-3">
            <Link
              href="/admin/cooperative-quotes"
              className="text-xs text-brand-magentaText hover:underline"
            >
              → Manage existing quote
            </Link>
            <Link
              href={`/quotes/${existingQuote.clientToken}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-magentaText hover:underline"
            >
              → Client-facing view
            </Link>
          </div>
        </Card>
      )}

      {bids.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">
            No bids yet. Dispatch quote requests to talent from the{" "}
            <Link
              href={`/admin/rfps/${id}/dispatch`}
              className="text-brand-magentaText hover:underline"
            >
              dispatch surface
            </Link>
            , then check back.
          </p>
        </Card>
      ) : existingQuote ? null : (
        <form
          action={compileBidsIntoQuote}
          className="mt-6 space-y-6"
        >
          <input type="hidden" name="rfpId" value={id} />

          <Card>
            <CardTitle>Bids received ({bids.length})</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              Check 3–5 bids to include in the client comparison. Add a
              curated relevance line beneath each pick — that's what
              the client sees on the card.
            </p>

            <ul className="mt-4 space-y-3">
              {bids.map((b) => {
                const rate = b.hourlyRate
                  ? Number.parseFloat(b.hourlyRate)
                  : null;
                // Scrub the pitch preview before showing it to admin
                // so admin catches PII the talent may have leaked and
                // can note it back to them privately.
                const scrub = scrubForClient(b.pitch);
                return (
                  <li
                    key={b.id}
                    className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="applicationIds"
                        value={b.id}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium">
                            {b.firstName ?? b.handle ?? "Talent"}
                          </span>
                          {memberLabel(b, {
                              skillsRequired: rfp.skillsRequired,
                              industry: rfp.industry,
                            }) && (
                            <span className="text-[11px] text-ink-muted">
                              · {memberLabel(b, {
                              skillsRequired: rfp.skillsRequired,
                              industry: rfp.industry,
                            })}
                            </span>
                          )}
                          {rate !== null && (
                            <span className="text-[11px] text-ink-faint">
                              · ${rate.toFixed(0)}/hr
                              {b.hoursPerWeek > 0 &&
                                ` · ${b.hoursPerWeek} hrs/wk`}
                            </span>
                          )}
                          <span className="text-[11px] text-ink-faint">
                            · {b.proposedRole}
                          </span>
                          {scrub.hits.length > 0 && (
                            <span className="rounded-full bg-brand-magenta/15 px-2 py-0.5 text-[10px] font-medium text-brand-magentaText">
                              PII flagged: {scrub.hits.join(", ")}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">
                          {scrub.scrubbed.slice(0, 400)}
                          {scrub.scrubbed.length > 400 ? "…" : ""}
                        </p>
                        <label className="mt-3 block">
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Relevance line (shown on client card)
                          </span>
                          <input
                            name={`relevance_${b.id}`}
                            placeholder="Why this person for this scope. One sentence."
                            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
                          />
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle>Engagement scope (client-facing)</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              This wraps every picked bid into a single quote the client
              can approve with one click.
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Client display name
                </span>
                <input
                  name="clientDisplayName"
                  defaultValue={rfp.clientId ?? ""}
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Scope summary
                </span>
                <textarea
                  name="scopeSummary"
                  rows={4}
                  defaultValue={rfp.description}
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <span className="text-[11px] text-ink-faint">
                  Prefilled from the RFP description. Reword for
                  client-facing tone as needed.
                </span>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Deliverables (one per line)
                </span>
                <textarea
                  name="deliverables"
                  rows={4}
                  placeholder={"Weekly deliverable\nMilestone 1: …\nMilestone 2: …"}
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Engagement timeline
                </span>
                <input
                  name="timeline"
                  placeholder="8 weeks from kickoff — 2 discovery, 4 build, 2 polish"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
            </div>
          </Card>

          <button
            type="submit"
            className="fm-btn-primary rounded-full px-6 py-2 text-sm font-medium"
          >
            Compile into client quote
          </button>
          <p className="text-[11px] text-ink-faint">
            Creates a cooperative_quote row + client magic-link. Copy
            the link from /admin/cooperative-quotes and send to the
            client email.
          </p>
        </form>
      )}
    </div>
  );
}
