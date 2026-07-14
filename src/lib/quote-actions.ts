/**
 * Cooperative Quote admin actions.
 *
 * Compose + remove client-facing quotes at /admin/quotes. Sandbox
 * mutates MOCK_COOPERATIVE_QUOTES in memory; production persists to
 * a `cooperative_quotes` Drizzle table and dispatches magic-link
 * emails via the email provider (§7c).
 *
 * Design posture:
 *   - Every quote maps to an existing project. The project provides
 *     the domain context (client, scope base); the quote layers the
 *     admin's proposal (crew + relevance + delivery scope + price).
 *   - Client token is generated server-side using the project id +
 *     a random suffix. Legible in sandbox for testing convenience;
 *     production swaps for opaque token or signed JWT.
 *   - Per-member relevance narratives arrive as a single textarea in
 *     a "userId: narrative" line format (one per line). Simplest MVP
 *     that avoids dynamic form-field arrays.
 *   - Deliverables arrive as a newline-separated textarea. Empty
 *     lines are skipped.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_COOPERATIVE_QUOTES } from "@/lib/mock-data/cooperative-quotes";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type {
  CooperativeQuote,
  CooperativeQuotePricing,
  Notification,
  NotificationKind,
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
 * Fan out one notification per admin on the project's roster. Used when
 * the client makes a quote decision (approve or decline) so the admin
 * pool knows to move on kickoff logistics (or on iterating the pitch).
 * Same pattern as booking / DM / customer-feedback notifications.
 */
function notifyAdminsOnQuoteDecision(
  quote: CooperativeQuote,
  kind: NotificationKind,
  title: string,
  body: string,
): void {
  const project = MOCK_PROJECTS.find((p) => p.id === quote.projectId);
  const adminUserIds = project?.adminUserIds ?? [];
  if (adminUserIds.length === 0) {
    // Fall back to notifying the quote's creator so it doesn't get
    // dropped if the project's admin roster is empty. Rare in practice
    // (every project should have at least the creator as admin), but
    // the fallback avoids silent black-hole cases.
    adminUserIds.push(quote.createdByUserId);
  }
  const href = `/admin/cooperative-quotes`;
  const now = new Date().toISOString();
  for (const adminId of adminUserIds) {
    const ntf: Notification = {
      id: `ntf_quote_${quote.id}_${adminId}_${Math.random()
        .toString(36)
        .slice(2, 5)}`,
      userId: adminId,
      kind,
      title,
      body,
      href,
      createdAt: now,
      readAt: null,
    };
    MOCK_NOTIFICATIONS.push(ntf);
  }
}

/**
 * Parse the "userId: narrative" relevance textarea into a keyed map.
 * Silently drops lines that don't match the format, and lines with
 * userIds that aren't in the selected proposedMemberIds. Preserves
 * whichever narrative appears last if a userId is repeated.
 */
function parseRelevanceLines(
  raw: string,
  proposedMemberIds: string[],
): Record<string, string> {
  const proposed = new Set(proposedMemberIds);
  const result: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;
    const userId = trimmed.slice(0, colonIdx).trim();
    const narrative = trimmed.slice(colonIdx + 1).trim();
    if (!userId || !narrative) continue;
    if (!proposed.has(userId)) continue;
    result[userId] = narrative;
  }
  return result;
}

/**
 * Parse a newline-separated deliverables list. Empty lines skipped;
 * leading bullets stripped so admins can paste from anywhere.
 */
function parseDeliverables(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*·•]\s*/, ""))
    .filter((line) => line.length > 0);
}

/**
 * Author a new quote. Admin picks a project, adds a client display
 * name, selects 1-5 cooperators, writes per-member relevance
 * narratives, defines scope + pricing. Blocks duplicates on the same
 * project — remove the existing quote first if the plan changes.
 */
export async function createCooperativeQuote(formData: FormData) {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const clientDisplayName = String(
    formData.get("clientDisplayName") ?? "",
  ).trim();
  const proposedMemberIds = formData
    .getAll("proposedMemberIds")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const relevanceRaw = String(formData.get("memberRelevance") ?? "").trim();
  const scopeSummary = String(formData.get("scopeSummary") ?? "").trim();
  const deliverablesRaw = String(formData.get("deliverables") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const pricingTypeRaw = String(
    formData.get("pricingType") ?? "fixed",
  ).trim();
  const baseAmountRaw = String(formData.get("baseAmount") ?? "").trim();
  const baseAmountMaxRaw = String(
    formData.get("baseAmountMax") ?? "",
  ).trim();
  const hourlyRateRaw = String(formData.get("hourlyRate") ?? "").trim();
  const talentSplitRaw = String(formData.get("talentSplit") ?? "85").trim();
  const operationsSplitRaw = String(
    formData.get("operationsSplit") ?? "15",
  ).trim();

  if (!projectId) throw new Error("Pick a project for this quote.");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  if (MOCK_COOPERATIVE_QUOTES.some((q) => q.projectId === projectId)) {
    throw new Error(
      "A quote already exists for this project. Remove the existing one before authoring a new quote.",
    );
  }

  if (clientDisplayName.length < 2) {
    throw new Error("Client display name is required.");
  }
  if (proposedMemberIds.length === 0) {
    throw new Error("Propose at least one cooperator.");
  }
  if (proposedMemberIds.length > 5) {
    throw new Error(
      "Propose no more than five cooperators. Quality of curation is the whole point.",
    );
  }
  for (const uid of proposedMemberIds) {
    if (!MOCK_USERS.some((u) => u.id === uid)) {
      throw new Error(`Unknown cooperator: ${uid}`);
    }
  }

  const memberRelevance = parseRelevanceLines(
    relevanceRaw,
    proposedMemberIds,
  );

  if (scopeSummary.length < 20) {
    throw new Error(
      "Scope summary is too thin. Write a full paragraph, minimum.",
    );
  }

  const deliverables = parseDeliverables(deliverablesRaw);
  if (deliverables.length === 0) {
    throw new Error("At least one deliverable is required.");
  }

  if (timeline.length < 4) {
    throw new Error("Timeline is required. One line, human-readable.");
  }

  const talentSplit = Number.parseFloat(talentSplitRaw);
  const operationsSplit = Number.parseFloat(operationsSplitRaw);
  if (
    Number.isNaN(talentSplit) ||
    Number.isNaN(operationsSplit) ||
    talentSplit < 0 ||
    operationsSplit < 0 ||
    Math.abs(talentSplit + operationsSplit - 100) > 0.01
  ) {
    throw new Error("Splits must be non-negative and sum to 100.");
  }

  // Discriminated union: fixed / range / hourly. Each shape takes its
  // own set of amount fields; admin form radio picks the type.
  let pricing: CooperativeQuotePricing;
  if (pricingTypeRaw === "range") {
    const min = Number.parseInt(baseAmountRaw, 10);
    const max = Number.parseInt(baseAmountMaxRaw, 10);
    if (Number.isNaN(min) || min <= 0) {
      throw new Error("Range min must be a positive integer (USD).");
    }
    if (Number.isNaN(max) || max <= 0) {
      throw new Error("Range max must be a positive integer (USD).");
    }
    if (max < min) {
      throw new Error("Range max cannot be less than range min.");
    }
    pricing = {
      type: "range",
      baseAmountMin: min,
      baseAmountMax: max,
      talentSplit,
      operationsSplit,
    };
  } else if (pricingTypeRaw === "hourly") {
    const rate = Number.parseInt(hourlyRateRaw, 10);
    if (Number.isNaN(rate) || rate <= 0) {
      throw new Error("Hourly rate must be a positive integer (USD).");
    }
    pricing = {
      type: "hourly",
      hourlyRate: rate,
      talentSplit,
      operationsSplit,
    };
  } else {
    // Default is fixed.
    const amount = Number.parseInt(baseAmountRaw, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error("Base amount must be a positive integer (USD).");
    }
    pricing = {
      type: "fixed",
      baseAmount: amount,
      talentSplit,
      operationsSplit,
    };
  }

  const now = new Date().toISOString();
  const row: CooperativeQuote = {
    id: newQuoteId(),
    clientToken: newClientToken(projectId),
    projectId,
    clientDisplayName,
    proposedMemberIds,
    memberRelevance,
    scope: {
      summary: scopeSummary,
      deliverables,
      timeline,
    },
    pricing,
    // Newly-authored quotes ship as `sent` in sandbox. Production adds
    // an explicit dispatch step. Admin can compose + dispatch in one
    // action for now.
    status: "sent",
    sentAt: now,
    viewedAt: null,
    decidedAt: null,
    createdAt: now,
    createdByUserId: admin.id,
    selectedLeadUserId: null,
  };
  MOCK_COOPERATIVE_QUOTES.push(row);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.created",
    resourceKind: "cooperative_quote",
    resourceId: row.id,
    before: null,
    after: {
      projectId,
      clientToken: row.clientToken,
      clientDisplayName,
      proposedMemberIds,
      pricingType: pricing.type,
    },
    reason: `Quote for ${project.title}`,
  });

  revalidatePath("/admin/quotes");
  revalidatePath(`/quotes/${row.clientToken}`);
}

/**
 * Remove an existing quote. Sandbox splices the array; production
 * should soft-delete so the magic-link stops resolving without
 * losing the historical record.
 */
export async function removeCooperativeQuote(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Quote id is required.");

  const idx = MOCK_COOPERATIVE_QUOTES.findIndex((q) => q.id === id);
  if (idx === -1) throw new Error("Quote not found.");

  const [removed] = MOCK_COOPERATIVE_QUOTES.splice(idx, 1);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "quote.removed",
    resourceKind: "cooperative_quote",
    resourceId: removed.id,
    before: {
      projectId: removed.projectId,
      clientToken: removed.clientToken,
      clientDisplayName: removed.clientDisplayName,
      status: removed.status,
    },
    after: null,
    reason: null,
  });

  revalidatePath("/admin/quotes");
  revalidatePath(`/quotes/${removed.clientToken}`);
}

/**
 * Client-facing approve action. Called from the tokenized quote surface
 * at /quotes/[token]. No admin auth requirement — the token IS the
 * credential (same pattern as /invoices/[token] and /receipts/[token]).
 * Anyone in possession of the magic link can approve the quote.
 *
 * Flips status → "approved", records the selected lead cooperator +
 * decision timestamp, logs the audit event, and fans out notifications
 * to every admin on the deal's roster so kickoff logistics can start.
 *
 * The actor on the audit log is the quote's creator (not the client)
 * because the sandbox has no client-side identity model. In production,
 * the client_token → client_contact resolution lets us stamp the actor
 * as the actual client email or a synthetic "client:<token-hash>"
 * pseudo-actor for compliance traceability.
 */
export async function approveCooperativeQuote(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const selectedLeadUserId = String(
    formData.get("selectedLeadUserId") ?? "",
  ).trim();
  if (!token) throw new Error("Quote token is required.");
  if (!selectedLeadUserId) {
    throw new Error("Select a lead cooperator before approving.");
  }

  const quote = MOCK_COOPERATIVE_QUOTES.find((q) => q.clientToken === token);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "approved" || quote.status === "declined") {
    throw new Error(
      `This quote has already been ${quote.status}. Contact your Future Modern account owner if you need to change the decision.`,
    );
  }
  if (quote.status === "draft") {
    throw new Error("This quote hasn't been sent yet.");
  }
  if (!quote.proposedMemberIds.includes(selectedLeadUserId)) {
    throw new Error(
      "Selected lead is not among the proposed cooperators for this quote.",
    );
  }

  const previousStatus = quote.status;
  const now = new Date().toISOString();
  quote.status = "approved";
  quote.decidedAt = now;
  quote.selectedLeadUserId = selectedLeadUserId;

  const leadUser = MOCK_USERS.find((u) => u.id === selectedLeadUserId);
  const leadName = leadUser
    ? `${leadUser.firstName} ${leadUser.lastName}`.trim()
    : selectedLeadUserId;
  const project = MOCK_PROJECTS.find((p) => p.id === quote.projectId);
  const projectTitle = project?.title ?? quote.projectId;

  logAuditEvent({
    actorUserId: quote.createdByUserId,
    actorRoleSnapshot: "system",
    action: "quote.approved",
    resourceKind: "cooperative_quote",
    resourceId: quote.id,
    before: {
      status: previousStatus,
      selectedLeadUserId: null,
      decidedAt: null,
    },
    after: {
      status: "approved",
      selectedLeadUserId,
      decidedAt: now,
    },
    reason: `Client ${quote.clientDisplayName} approved the quote and selected ${leadName} as lead.`,
  });

  notifyAdminsOnQuoteDecision(
    quote,
    "quote_approved",
    `${quote.clientDisplayName} approved: ${projectTitle}`,
    `Lead: ${leadName}. Kick off contracts + calendar within one business day.`,
  );

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/quotes/${quote.clientToken}`);
}

/**
 * Client-facing decline action. Same auth model as approve (token is
 * the credential). Optional free-text reason lets the client name what
 * would need to change (crew, scope, price, timing). Admin follow-up
 * lives outside this action.
 */
export async function declineCooperativeQuote(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!token) throw new Error("Quote token is required.");

  const quote = MOCK_COOPERATIVE_QUOTES.find((q) => q.clientToken === token);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "approved" || quote.status === "declined") {
    throw new Error(
      `This quote has already been ${quote.status}. Contact your Future Modern account owner if you need to change the decision.`,
    );
  }
  if (quote.status === "draft") {
    throw new Error("This quote hasn't been sent yet.");
  }

  const previousStatus = quote.status;
  const now = new Date().toISOString();
  quote.status = "declined";
  quote.decidedAt = now;
  // Preserve selectedLeadUserId if it was chosen before the decline —
  // useful signal for the admin follow-up. But null it if the client
  // never chose a lead, so the record accurately reflects "no lead
  // selected."
  // (In practice most declines will null out selectedLeadUserId.)

  const project = MOCK_PROJECTS.find((p) => p.id === quote.projectId);
  const projectTitle = project?.title ?? quote.projectId;

  logAuditEvent({
    actorUserId: quote.createdByUserId,
    actorRoleSnapshot: "system",
    action: "quote.declined",
    resourceKind: "cooperative_quote",
    resourceId: quote.id,
    before: {
      status: previousStatus,
      decidedAt: null,
    },
    after: {
      status: "declined",
      decidedAt: now,
      reason: reason || null,
    },
    reason: reason
      ? `Client ${quote.clientDisplayName} declined the quote. Reason: ${reason}`
      : `Client ${quote.clientDisplayName} declined the quote.`,
  });

  const bodyLine = reason
    ? `Reason: ${reason}`
    : `No reason provided. Follow up to iterate on crew, scope, or price.`;

  notifyAdminsOnQuoteDecision(
    quote,
    "quote_declined",
    `${quote.clientDisplayName} declined: ${projectTitle}`,
    bodyLine,
  );

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/quotes/${quote.clientToken}`);
}
