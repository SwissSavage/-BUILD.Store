/**
 * Compile 3–5 talent bids on an RFP into a client-facing cooperative
 * quote (task #41).
 *
 * The client-facing "3–5 bid comparison" is the flip side of the
 * dispatch surface (#36): admin dispatches quote requests to matched
 * talent → talent submits bids on /contracts/[id] → those bids land in
 * project_applications → admin curates the strongest 3–5, wraps them
 * in an engagement-level scope block, and sends the client one magic
 * link that renders all picks as TalentHand cards.
 *
 * We deliberately reuse createCooperativeQuote's storage shape (the
 * cooperative_quotes table with jsonb proposedBuilders + scope). Each
 * bid keeps its proposed pricing mode and range in the client quote.
 *
 * Non-goals for MVP:
 *  - Editing the compiled quote's scope after dispatch (remove +
 *    re-compile if the plan changes; matches the existing composer).
 *  - Mixing internal roster picks with external-invite bids in the
 *    same wizard (invites go through the dispatch surface + eventually
 *    fold into project_applications the same way).
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cooperativeQuotes,
  projectApplications,
  projects,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { richTextValuePlainText } from "@/lib/rich-text";
import { formatProposalHours } from "@/lib/proposal-terms";
import {
  clientPricingFromBuilderPayout,
  formatUsdCents,
  suggestedBuilderHourlyPayout,
  suggestedClientHourlyRate,
} from "@/lib/quote-pricing";
import type {
  CooperativeQuote,
  CooperativeQuotePricing,
  ProposedBuilder,
} from "@/lib/types";

const minimumProposalCount = 3;
const maximumProposalCount = 5;

function newQuoteId(): string {
  return `quote_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function newClientToken(projectId: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `q_${projectId.replace(/^p_/, "")}_${rand}`;
}

/**
 * Compile selected bids into a fresh cooperative quote for the client.
 * Admin picks between three and five bids: enough choice to compare,
 * without overwhelming the client.
 * Each pick becomes a ProposedBuilder with the contributor's terms.
 */
export async function compileBidsIntoQuote(formData: FormData) {
  const admin = await requireAdmin();
  const intent = formData.get("intent") === "send" ? "send" : "draft";

  const rfpId = String(formData.get("rfpId") ?? "").trim();
  const applicationIds = formData
    .getAll("applicationIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const clientDisplayName = String(
    formData.get("clientDisplayName") ?? "",
  ).trim();
  const scopeSummary = String(formData.get("scopeSummary") ?? "").trim();
  const deliverablesRaw = String(formData.get("deliverables") ?? "");

  if (!rfpId) throw new Error("rfpId is required.");
  // Three to five is the house standard for a readable comparison, not a
  // rule the software gets to enforce. Sometimes there are two bids
  // worth sending and waiting for a third is worse than sending two.
  // The form says so; it no longer refuses.
  if (applicationIds.length === 0) {
    throw new Error("Pick at least one bid for the client quote.");
  }
  if (applicationIds.length > maximumProposalCount) {
    throw new Error(
      `Pick at most ${maximumProposalCount} bids. Any more and the client comparison stops being skimmable.`,
    );
  }
  if (clientDisplayName.length < 2) {
    throw new Error("Client display name is required.");
  }
  if (scopeSummary.length < 20) {
    throw new Error(
      "Scope summary is too thin. Write a full paragraph so the client understands what they're getting.",
    );
  }
  // Engagement-level deliverables are now optional and usually empty.
  // What each Builder owes lives on their own entry, read per pick
  // below. See the WHY on CooperativeQuote["scope"].
  const deliverables = deliverablesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Verify RFP is a compilable open contract.
  const [rfp] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, rfpId))
    .limit(1);
  if (
    !rfp ||
    rfp.kind !== "contract" ||
    !rfp.isRfp ||
    rfp.status !== "open" ||
    !rfp.rfpApprovedAt
  ) {
    throw new Error("RFP not found or not open for compilation.");
  }

  const [existingQuote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.projectId, rfpId))
    .limit(1);
  if (existingQuote && existingQuote.status !== "draft") {
    throw new Error(
      "A client-facing quote already exists for this RFP. Create a revised draft instead of changing the version the client received.",
    );
  }

  // Fetch the picked bids + their proposers so we can build
  // ProposedBuilder entries. Filter to bids on THIS RFP so a leaked
  // application id from another project can't smuggle into the quote.
  const picks = await db
    .select({
      id: projectApplications.id,
      userId: projectApplications.userId,
      proposedRole: projectApplications.proposedRole,
      hoursPerWeek: projectApplications.hoursPerWeek,
      hoursPerWeekMax: projectApplications.hoursPerWeekMax,
      hourlyRate: projectApplications.hourlyRate,
      hourlyRateMax: projectApplications.hourlyRateMax,
      priceMode: projectApplications.priceMode,
      fixedPriceMin: projectApplications.fixedPriceMin,
      fixedPriceMax: projectApplications.fixedPriceMax,
      pitch: projectApplications.pitch,
      status: projectApplications.status,
    })
    .from(projectApplications)
    .where(
      and(
        eq(projectApplications.projectId, rfpId),
        inArray(projectApplications.id, applicationIds),
        sql`${projectApplications.status} IN ('pending', 'approved')`,
      ),
    );

  if (picks.length !== applicationIds.length) {
    throw new Error(
      "Some picked bids couldn't be resolved. Refresh the page and try again.",
    );
  }
  // Enforce one bid per talent — duplicate userIds in a quote card
  // view would confuse the client.
  const seenUserIds = new Set<string>();
  for (const p of picks) {
    if (seenUserIds.has(p.userId)) {
      throw new Error(
        "Two of the picked bids belong to the same person. Pick one bid per talent.",
      );
    }
    seenUserIds.add(p.userId);
  }

  // Per-bid relevance one-liner. Falls back to the bid's own pitch
  // trimmed to a sentence if admin didn't author a curated line —
  // better than a blank card, but curated is the norm.
  const proposedBuilders: ProposedBuilder[] = picks.map((p) => {
    const perBidRelevance = String(
      formData.get(`relevance_${p.id}`) ?? "",
    ).trim();
    const relevance =
      perBidRelevance.length >= 10
        ? perBidRelevance
        : richTextValuePlainText(p.pitch).split(".")[0]?.slice(0, 200) ?? "Strong fit for this scope.";
    const priceMode = p.priceMode ?? (p.hourlyRate ? "hourly" : "negotiable");
    if (priceMode === "hourly" && (!p.hourlyRate || Number(p.hourlyRate) <= 0)) {
      throw new Error(`Bid ${p.id} needs a valid hourly minimum before sending it to the client.`);
    }
    if (priceMode === "fixed" && (!p.fixedPriceMin || Number(p.fixedPriceMin) <= 0)) {
      throw new Error(`Bid ${p.id} needs a valid project price before sending it to the client.`);
    }
    const split = { talentSplit: 85, operationsSplit: 15 };
    let pricing: ProposedBuilder["pricing"];
    if (priceMode === "fixed") {
      pricing = p.fixedPriceMax && Number(p.fixedPriceMax) > Number(p.fixedPriceMin)
        ? { type: "range", baseAmountMin: Number(p.fixedPriceMin), baseAmountMax: Number(p.fixedPriceMax), ...split }
        : { type: "fixed", baseAmount: Number(p.fixedPriceMin), minimumOnly: !p.fixedPriceMax, ...split };
    } else if (priceMode === "hourly") {
      pricing = {
        type: "hourly",
        hourlyRate: Number(p.hourlyRate),
        hourlyRateMax: p.hourlyRateMax ? Number(p.hourlyRateMax) : null,
        minimumOnly: !p.hourlyRateMax,
        ...split,
      };
    } else {
      pricing = { type: "negotiable", ...split };
    }
    // ──────────────────────────────────────────────────────────
    // WHY (2026-10-05)
    //
    // clientPricingFromBuilderPayout has existed, correct, and unused.
    // Nothing called it, so clientPricing was never written, and the
    // quote page falls back to `builder.clientPricing ?? builder.pricing`.
    // The client was shown the builder's own payout: a member asking
    // $55/hr appeared on the client quote at $55/hr, with the
    // cooperative's 15% nowhere in the number the client approves.
    //
    // That is a revenue bug, not a display one. A client who approves
    // that quote has approved $55/hr, and the operations share has to
    // come out of someone after the fact.
    //
    // Default is the straight gross-up. clientRate_<id> overrides it
    // when an admin wants margin above the floor, for a bonus hedge or
    // because the market rate for the work is higher than what the
    // member thought to ask. The builder's payout is untouched either
    // way: `pricing` still carries exactly what they bid.
    // ──────────────────────────────────────────────────────────
    const clientPricing = (() => {
      // Hourly bids go through the standing rules: $10 over a Builder's
      // minimum, never under a $50/hr payout, and a quoted band taken at
      // the top already clears the hedge so nothing is added to it.
      // Fixed and range project prices get the straight gross-up, since
      // adding $10 to a scoped project price means nothing.
      const grossedUp: CooperativeQuotePricing =
        pricing.type === "hourly"
          ? {
              ...pricing,
              hourlyRate: suggestedClientHourlyRate(
                pricing.hourlyRate,
                pricing.hourlyRateMax,
              ),
              hourlyRateMax: pricing.hourlyRateMax
                ? Math.ceil(
                    suggestedBuilderHourlyPayout(
                      pricing.hourlyRate,
                      pricing.hourlyRateMax,
                    ) / 0.85,
                  )
                : null,
            }
          : clientPricingFromBuilderPayout(pricing);
      const override = Number(
        String(formData.get(`clientRate_${p.id}`) ?? "").replace(/[$,\s]/g, ""),
      );
      if (!Number.isFinite(override) || override <= 0) return grossedUp;

      // Never below the gross-up. Quoting under it would pay the member
      // out of the cooperative's share without anyone deciding to.
      const floor = (() => {
        switch (grossedUp.type) {
          case "hourly":
            return grossedUp.hourlyRate;
          case "fixed":
            return grossedUp.baseAmount;
          case "range":
            return grossedUp.baseAmountMin;
          default:
            return 0;
        }
      })();
      if (override < floor) {
        throw new Error(
          `Client rate for bid ${p.id} is below the ${formatUsdCents(floor)} floor that keeps the builder's payout whole.`,
        );
      }

      switch (grossedUp.type) {
        case "hourly":
          return {
            ...grossedUp,
            hourlyRate: override,
            // Scale the top of the band by the same factor so an
            // override does not quietly flatten a range into a point.
            hourlyRateMax: grossedUp.hourlyRateMax
              ? Math.ceil(grossedUp.hourlyRateMax * (override / grossedUp.hourlyRate))
              : null,
          };
        case "fixed":
          return { ...grossedUp, baseAmount: override };
        case "range":
          return {
            ...grossedUp,
            baseAmountMin: override,
            baseAmountMax: Math.ceil(
              grossedUp.baseAmountMax * (override / grossedUp.baseAmountMin),
            ),
          };
        default:
          return grossedUp;
      }
    })();

    const hoursLine = p.hoursPerWeek > 0
      ? `${formatProposalHours(p.hoursPerWeek, p.hoursPerWeekMax)} across the engagement`
      : "Availability per engagement";
    // What this person is on the hook for. Authored per bid, because
    // bids arrive as prose and projectApplications has no deliverables
    // column to carry one through. Required: a Builder card with a
    // price and no deliverables is the thing a client cannot evaluate.
    const perBidDeliverables = String(formData.get(`deliverables_${p.id}`) ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (perBidDeliverables.length === 0) {
      throw new Error(
        `List what each Builder is delivering, one per line. Missing for bid ${p.id}.`,
      );
    }
    // The two fields that carry most of the weight in a real quote
    // sheet. Required, because a client choosing between people needs
    // the trade-off stated and a card with only strengths on it is
    // marketing rather than a basis for a decision.
    const strengths = String(formData.get(`strengths_${p.id}`) ?? "").trim();
    const weaknesses = String(formData.get(`weaknesses_${p.id}`) ?? "").trim();
    if (!strengths || !weaknesses) {
      throw new Error(
        `Write both strengths and weaknesses for every Builder. Missing for bid ${p.id}.`,
      );
    }

    // "Label | URL | context" per line, with the URL optional, since
    // some samples are a description of work that has no public link.
    const workSamples = String(formData.get(`workSamples_${p.id}`) ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        const [label, second, third] = parts;
        const looksLikeUrl = /^https?:\/\//i.test(second ?? "");
        return {
          label: label ?? "",
          url: looksLikeUrl ? second : undefined,
          context: (looksLikeUrl ? third : [second, third].filter(Boolean).join(" ")) ?? "",
        };
      })
      .filter((sample) => sample.label.length > 0);

    return {
      userId: p.userId,
      pricing,
      clientPricing,
      deliverables: perBidDeliverables,
      timeline: hoursLine,
      relevance,
      strengths,
      weaknesses,
      workSamples: workSamples.length > 0 ? workSamples : undefined,
      // Carried for admin reference only. The pitch never reaches a
      // client: the price points, deliverables, strengths, trade-offs
      // and work samples speak for themselves, and a member writing
      // about themselves is always selling themselves.
      pitch: p.pitch,
    };
  });

  const now = new Date().toISOString();
  const isSending = intent === "send";
  const row: CooperativeQuote = {
    id: existingQuote?.id ?? newQuoteId(),
    clientToken: existingQuote?.clientToken ?? newClientToken(rfpId),
    projectId: rfpId,
    clientDisplayName,
    proposedBuilders,
    scope: {
      summary: scopeSummary,
      // Only what spans the whole crew. Nothing is written for
      // `timeline`: the engagement shape is derived from the selected
      // Builders' own timelines, because none of it is real until the
      // client picks who is doing the work.
      deliverables: deliverables.length > 0 ? deliverables : undefined,
    },
    status: isSending ? "sent" : "draft",
    sentAt: isSending ? now : null,
    viewedAt: null,
    decidedAt: null,
    createdAt: existingQuote?.createdAt ?? now,
    createdByUserId: existingQuote?.createdByUserId ?? admin.id,
    selectedLeadUserId: null,
  };
  await db.transaction(async (tx) => {
    if (existingQuote) {
      await tx
        .update(cooperativeQuotes)
        .set({
          clientDisplayName: row.clientDisplayName,
          proposedBuilders: row.proposedBuilders,
          scope: row.scope,
          status: row.status,
          sentAt: row.sentAt,
        })
        .where(eq(cooperativeQuotes.id, row.id));
    } else {
      await tx.insert(cooperativeQuotes).values(row);
    }
    if (isSending) {
      // Sending freezes exactly the bid versions the client receives.
      await tx
        .update(projectApplications)
        .set({ clientPresentedAt: now })
        .where(inArray(projectApplications.id, applicationIds));
    }
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: isSending ? "quote.sent" : "quote.draft_saved",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      projectId: rfpId,
      clientToken: row.clientToken,
      clientDisplayName,
      compiledFromApplicationIds: applicationIds,
      proposedBuilderIds: proposedBuilders.map((b) => b.userId),
      intent,
    },
    reason: isSending
      ? `Sent ${picks.length} bids to ${rfp.clientId ?? "the client"} for ${rfp.title}`
      : `Saved a ${picks.length}-bid draft for ${rfp.title}`,
  });

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/admin/rfps/${rfpId}/bids`);
  revalidatePath(`/quotes/${row.clientToken}`);
  redirect(
    isSending
      ? "/admin/cooperative-quotes"
      : `/quotes/${row.clientToken}?draft=1`,
  );
}
