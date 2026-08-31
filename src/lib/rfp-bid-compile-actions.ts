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
 * cooperative_quotes table with jsonb proposedBuilders + scope). Every
 * bid becomes a ProposedBuilder entry with pricing.type === "hourly"
 * seeded from the bid's hourlyRate, so the aggregate math on
 * /quotes/[token] already works — no new render surface required.
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
import type {
  CooperativeQuote,
  ProposedBuilder,
} from "@/lib/types";

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
 * Admin picks between 3 and 5 bids (Jamar's "3–5 comparison cards"
 * design intent — enough choice to feel curated, few enough to skim).
 * Each pick becomes a ProposedBuilder priced hourly at the bid's
 * proposed rate.
 */
export async function compileBidsIntoQuote(formData: FormData) {
  const admin = await requireAdmin();

  const rfpId = String(formData.get("rfpId") ?? "").trim();
  const applicationIds = formData
    .getAll("applicationIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const clientDisplayName = String(
    formData.get("clientDisplayName") ?? "",
  ).trim();
  const scopeSummary = String(formData.get("scopeSummary") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const deliverablesRaw = String(formData.get("deliverables") ?? "");

  if (!rfpId) throw new Error("rfpId is required.");
  if (applicationIds.length < 3) {
    throw new Error(
      "Pick at least 3 bids. The client needs enough options to feel curated.",
    );
  }
  if (applicationIds.length > 5) {
    throw new Error(
      "Pick at most 5 bids. Any more and the comparison card view stops being skimmable.",
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
  if (timeline.length < 4) {
    throw new Error("Engagement timeline is required.");
  }
  const deliverables = deliverablesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (deliverables.length === 0) {
    throw new Error(
      "List at least one deliverable, one per line.",
    );
  }

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

  // Block re-compilation — createCooperativeQuote uses the same
  // guard. Admin removes the existing quote first if the plan changes.
  const existingQuote = await db
    .select({ id: cooperativeQuotes.id })
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.projectId, rfpId))
    .limit(1);
  if (existingQuote.length > 0) {
    throw new Error(
      "A quote already exists for this RFP. Remove it from /admin/cooperative-quotes before compiling a new one.",
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
      hourlyRate: projectApplications.hourlyRate,
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
        : p.pitch.split(".")[0]?.slice(0, 200) ?? "Strong fit for this scope.";
    const rate = p.hourlyRate ? Number.parseFloat(p.hourlyRate) : 0;
    const hoursLine = p.hoursPerWeek
      ? `${p.hoursPerWeek} hrs/week across the engagement`
      : "Availability per engagement";
    return {
      userId: p.userId,
      pricing: {
        type: "hourly" as const,
        hourlyRate: rate,
        talentSplit: 85,
        operationsSplit: 15,
      },
      timeline: hoursLine,
      relevance,
    };
  });

  const now = new Date().toISOString();
  const row: CooperativeQuote = {
    id: newQuoteId(),
    clientToken: newClientToken(rfpId),
    projectId: rfpId,
    clientDisplayName,
    proposedBuilders,
    scope: {
      summary: scopeSummary,
      deliverables,
      timeline,
    },
    status: "sent",
    sentAt: now,
    viewedAt: null,
    decidedAt: null,
    createdAt: now,
    createdByUserId: admin.id,
    selectedLeadUserId: null,
  };
  await db.insert(cooperativeQuotes).values(row);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.created",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      projectId: rfpId,
      clientToken: row.clientToken,
      clientDisplayName,
      compiledFromApplicationIds: applicationIds,
      proposedBuilderIds: proposedBuilders.map((b) => b.userId),
      compileMode: "rfp_bid_compile",
    },
    reason: `Compiled ${picks.length} bids into client quote for ${rfp.title}`,
  });

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/admin/rfps/${rfpId}/bids`);
  revalidatePath(`/quotes/${row.clientToken}`);

  // Land admin on the composed quote surface so they can copy the
  // magic link out to the client email.
  redirect(`/admin/cooperative-quotes`);
}

