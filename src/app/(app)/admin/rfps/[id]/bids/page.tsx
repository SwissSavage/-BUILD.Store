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
 * as a TalentHand card with each Builder's proposed pricing terms.
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
import { formatProposalHours, formatProposalPrice } from "@/lib/proposal-terms";
import { compileBidsIntoQuote } from "@/lib/rfp-bid-compile-actions";
import { scrubForClient } from "@/lib/pii-scrub";
import { StructuredText } from "@/components/StructuredText";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { ProposalAttachment } from "@/lib/proposal-attachments";
import { QuoteCompileRequirements } from "@/components/BidSelectionRequirement";
import { richTextValuePlainText } from "@/lib/rich-text";
import type { CooperativeQuote, ProposedBuilder } from "@/lib/types";
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
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.projectId, id))
    .limit(1);
  const draftQuote = existingQuote?.status === "draft" ? existingQuote : null;
  const draftBuilders = (draftQuote?.proposedBuilders ?? []) as ProposedBuilder[];
  const draftBuilderByUserId = new Map(
    draftBuilders.map((builder) => [builder.userId, builder]),
  );
  const draftScope = draftQuote?.scope as CooperativeQuote["scope"] | undefined;

  const bids = await db
    .select({
      id: projectApplications.id,
      userId: projectApplications.userId,
      proposedRole: projectApplications.proposedRole,
      pitch: projectApplications.pitch,
      hoursPerWeek: projectApplications.hoursPerWeek,
      hoursPerWeekMax: projectApplications.hoursPerWeekMax,
      hourlyRate: projectApplications.hourlyRate,
      hourlyRateMax: projectApplications.hourlyRateMax,
      priceMode: projectApplications.priceMode,
      fixedPriceMin: projectApplications.fixedPriceMin,
      fixedPriceMax: projectApplications.fixedPriceMax,
      portfolioLink: projectApplications.portfolioLink,
      attachments: projectApplications.attachments,
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
        Pick three to five bids. Each becomes a TalentHand card on the client
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

      {existingQuote && !draftQuote && (
        <Card className="mt-6 border-brand-magenta/40 bg-[var(--surface-elevated)]">
          <CardEyebrow>Client quote already sent</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            A cooperative quote already exists for this RFP (status:{" "}
            <span className="font-medium">{existingQuote.status}</span>).
            Its bid versions are locked so the client keeps the exact quote they received.
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
      ) : existingQuote && !draftQuote ? null : (
        <form
          action={compileBidsIntoQuote}
          id="compile-bids-form"
          noValidate
          className="mt-6 space-y-6"
        >
          <input type="hidden" name="rfpId" value={id} />
          <QuoteCompileRequirements />

          {draftQuote && (
            <Card className="border-brand-magenta/40 bg-brand-magenta/5">
              <CardEyebrow>Editing saved draft</CardEyebrow>
              <p className="mt-2 text-sm text-ink-muted">
                This draft is internal. Contributors can still update their bids until you send the client quote.
              </p>
            </Card>
          )}

          <Card>
            <CardTitle>Bids received ({bids.length})</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              Check three to five bids to include in the client comparison. Once
              five are selected, the remaining choices lock until one is removed.
              Add a curated relevance line beneath each pick — that&apos;s what the
              client sees on the card.
            </p>

            <ul className="mt-4 space-y-3">
              {bids.map((b) => {
                // Scrub the pitch preview before showing it to admin
                // so admin catches PII the talent may have leaked and
                // can note it back to them privately.
                const scrub = scrubForClient(richTextValuePlainText(b.pitch));
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
                        defaultChecked={draftBuilderByUserId.has(b.userId)}
                        className="mt-1 h-4 w-4 disabled:cursor-not-allowed disabled:opacity-40 data-[invalid=true]:outline data-[invalid=true]:outline-2 data-[invalid=true]:outline-red-500"
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
                          <span className="text-[11px] text-ink-faint">
                            · {formatProposalPrice(b)} · {formatProposalHours(b.hoursPerWeek, b.hoursPerWeekMax)}
                          </span>
                          <span className="text-[11px] text-ink-faint">
                            · {b.proposedRole}
                          </span>
                          {scrub.hits.length > 0 && (
                            <span className="rounded-full bg-brand-magenta/15 px-2 py-0.5 text-[10px] font-medium text-brand-magentaText">
                              PII flagged: {scrub.hits.join(", ")}
                            </span>
                          )}
                        </div>
                        {/* The pitch is client-facing copy and was
                            read-only here, carried to the quote
                            verbatim. On a quote assembled from several
                            bids that meant no way to fix voice, length
                            or anything a builder wrote badly, with the
                            client reading the seams.

                            Editing writes to the quote only. The bid
                            row keeps the builder's original words, so
                            what they submitted is still on the record.

                            Prefilled with the scrubbed text when the
                            PII scan flagged something, so saving
                            without touching it does not put contact
                            details back in front of a client. */}
                        <label className="mt-3 block">
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Pitch (client-facing, edit freely)
                          </span>
                          <RichTextEditor
                            name={`pitch_${b.id}`}
                            initialValue={
                              draftBuilderByUserId.get(b.userId)?.pitch ??
                              (scrub.hits.length > 0 ? scrub.scrubbed : b.pitch)
                            }
                          />
                        </label>

                        {/* Strengths and weaknesses carry most of the
                            weight in a real $BUILD quote sheet, and
                            the app had nowhere to put them. The client
                            is choosing between people and wants the
                            trade-offs stated, not a blurb each.

                            Write weaknesses plainly. "Does not code,
                            would need to pair with a web developer"
                            and "No real UX/UI experience" are both
                            from quotes that went out and won work. A
                            client who cannot see the trade-off cannot
                            decide, and finds out after they hire. */}
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                              Strengths
                            </span>
                            <textarea
                              name={`strengths_${b.id}`}
                              data-quote-strengths={b.id}
                              defaultValue={draftBuilderByUserId.get(b.userId)?.strengths ?? ""}
                              rows={3}
                              placeholder="What they are genuinely good at, for this scope."
                              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs data-[invalid=true]:border-red-500 data-[invalid=true]:ring-1 data-[invalid=true]:ring-red-500"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                              Weaknesses
                            </span>
                            <textarea
                              name={`weaknesses_${b.id}`}
                              data-quote-weaknesses={b.id}
                              defaultValue={draftBuilderByUserId.get(b.userId)?.weaknesses ?? ""}
                              rows={3}
                              placeholder="The honest trade-off. What they will need paired with them."
                              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs data-[invalid=true]:border-red-500 data-[invalid=true]:ring-1 data-[invalid=true]:ring-red-500"
                            />
                          </label>
                        </div>

                        {/* The "Work Sample(s)" column. One per line as
                            "Label | context", optionally "Label | URL |
                            context". A bare link makes the client work
                            out why they are looking at it; the line of
                            context is what the quote sheet has always
                            carried. Curated here rather than taken from
                            the bid, because most members do not present
                            their own portfolio effectively. */}
                        <label className="mt-3 block">
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Work samples (one per line: Label | URL | what they did on it)
                          </span>
                          <textarea
                            name={`workSamples_${b.id}`}
                            defaultValue={(draftBuilderByUserId.get(b.userId)?.workSamples ?? [])
                              .map((w) => [w.label, w.url, w.context].filter(Boolean).join(" | "))
                              .join("\n")}
                            rows={3}
                            placeholder={"Ontraport | https://... | Engineering manager and primary engineer on this platform"}
                            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
                          />
                        </label>

                        {/* What they actually submitted, kept in view.
                            The framing is the product here: most
                            talent cannot pitch themselves, which is
                            the whole reason an admin writes the
                            client-facing version. But the editor
                            replaces their text, so without this you
                            lose the source the moment you start
                            writing, and the facts you are allowed to
                            repeat live in it.

                            Always the unedited original, never the
                            scrubbed copy, because judging whether a
                            claim is theirs to make means reading what
                            they wrote. */}
                        <details className="mt-3 group">
                          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-wider text-ink-faint hover:text-brand-magentaText">
                            What they wrote
                            <span className="ml-1 group-open:hidden">▸</span>
                            <span className="ml-1 hidden group-open:inline">▾</span>
                          </summary>
                          <div className="mt-2 rounded-lg border border-dashed border-[var(--surface-border)] px-3 py-2">
                            <StructuredText text={b.pitch} />
                          </div>
                        </details>

                        {/* Portfolio and attachments. These are on the
                            bid row and were selected but never rendered
                            here, so the one page where you decide who
                            goes to the client showed none of their
                            work. */}
                        {(b.portfolioLink ||
                          (b.attachments as ProposalAttachment[] | null)?.length) && (
                          <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-ink-muted">
                              Their work
                            </p>
                            <ul className="mt-2 space-y-1">
                              {b.portfolioLink && (
                                <li>
                                  <a
                                    href={b.portfolioLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-brand-magentaText hover:underline"
                                  >
                                    Portfolio link →
                                  </a>
                                </li>
                              )}
                              {((b.attachments as ProposalAttachment[] | null) ?? []).map(
                                (file) => (
                                  <li key={file.name}>
                                    <a
                                      href={`data:${file.mimeType};base64,${file.base64}`}
                                      download={file.name}
                                      className="text-xs text-brand-magentaText hover:underline"
                                    >
                                      {file.name}
                                    </a>
                                    <span className="ml-2 text-[10px] text-ink-faint">
                                      {(file.sizeBytes / 1024).toFixed(0)} KB
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        <label className="mt-3 block">
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Relevance line (shown on client card)
                          </span>
                          <input
                            name={`relevance_${b.id}`}
                            defaultValue={draftBuilderByUserId.get(b.userId)?.relevance ?? ""}
                            placeholder="Why this person for this scope. One sentence."
                            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
                          />
                        </label>
                        {/* What this person owes. Everyone on the quote
                            is bidding something different, so a single
                            engagement-level list could never say who
                            owed what. The bid itself carries this only
                            as prose, which is why it is authored here. */}
                        <label className="mt-3 block">
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Deliverables (one per line, shown on client card)
                          </span>
                          <textarea
                            name={`deliverables_${b.id}`}
                            data-quote-deliverables={b.id}
                            defaultValue={(draftBuilderByUserId.get(b.userId)?.deliverables ?? []).join("\n")}
                            rows={3}
                            placeholder={"What this person hands over.\nOne line each."}
                            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs data-[invalid=true]:border-red-500 data-[invalid=true]:ring-1 data-[invalid=true]:ring-red-500"
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
                  required
                  minLength={2}
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm data-[invalid=true]:border-red-500 data-[invalid=true]:ring-1 data-[invalid=true]:ring-red-500"
                />
              </label>

              <section>
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Scope summary
                </span>
                <RichTextEditor
                  name="scopeSummary"
                  initialValue={draftScope?.summary ?? rfp.description ?? ""}
                  required
                  minLength={20}
                  validationKey="scopeSummary"
                />
                <span className="mt-2 block text-[11px] text-ink-faint">
                  Edit the client-facing scope directly. Formatting is retained
                  when the quote is compiled.
                </span>
              </section>

              {/* Only what belongs to the whole crew rather than to one
                  person. Each Builder's own deliverables are authored
                  on their card above. Usually left empty.

                  There is no engagement timeline field. Nothing about
                  the shape of the work is settled until the client
                  picks who is doing it, so the quote shows each
                  Builder's own timeline and the client reads the
                  engagement off those. */}
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Shared deliverables (optional, one per line)
                </span>
                <textarea
                  name="deliverables"
                  defaultValue={(draftScope?.deliverables ?? []).join("\n")}
                  rows={3}
                  placeholder={"Anything the whole crew owes jointly.\nLeave empty if each Builder's own list covers it."}
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              name="intent"
              value="draft"
              className="rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-medium hover:border-brand-magenta hover:text-brand-magentaText"
            >
              Save &amp; see draft
            </button>
            <button
              type="submit"
              name="intent"
              value="send"
              className="fm-btn-primary rounded-full px-6 py-2 text-sm font-medium"
            >
              Send client quote
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">
            Drafts stay internal and keep bids editable. Sending activates the client link and locks the selected bid versions.
          </p>
        </form>
      )}
    </div>
  );
}
