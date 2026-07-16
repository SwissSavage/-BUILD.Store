/**
 * Cooperative Quote admin actions.
 *
 * Compose + remove client-facing quotes at /admin/cooperative-quotes.
 * Sandbox mutates MOCK_COOPERATIVE_QUOTES in memory; production
 * persists to a `cooperative_quotes` Drizzle table and dispatches
 * magic-link emails via the email provider.
 *
 * Design posture (Tier 21):
 *   - Every quote maps to an existing project. The project provides
 *     the domain context (client, scope base); the quote layers the
 *     admin's proposal (crew + relevance + delivery scope + per-
 *     Builder pricing).
 *   - Pricing lives on each proposed Builder — same shape as Jamar's
 *     historical Google Doc quote sheet (Service Provider | Quote |
 *     Timeline per row). Aggregate quote total is derived from picked
 *     Builders at approval time (see `quote-pricing.ts`
 *     deriveAggregatePricing).
 *   - Client token is generated server-side using the project id +
 *     a random suffix. Legible in sandbox for testing convenience;
 *     production swaps for opaque token or signed JWT.
 *   - Admin composer serializes proposedBuilders as a JSON blob under
 *     `proposedBuildersJson` — dynamic-form-fields would be awkward
 *     for N Builders with per-Builder pricing sub-forms, JSON is the
 *     escape hatch.
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
 * Validate one per-Builder pricing payload from JSON parse. Returns
 * a typed CooperativeQuotePricing on success, throws with a specific
 * error message on failure so the admin knows which Builder failed
 * validation and why.
 */
function validateBuilderPricing(
  raw: unknown,
  builderLabel: string,
): CooperativeQuotePricing {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${builderLabel}: pricing is missing.`);
  }
  const p = raw as Record<string, unknown>;
  const type = String(p.type ?? "").trim();
  const talentSplit =
    typeof p.talentSplit === "number" ? p.talentSplit : 85;
  const operationsSplit =
    typeof p.operationsSplit === "number" ? p.operationsSplit : 15;
  if (
    talentSplit < 0 ||
    operationsSplit < 0 ||
    Math.abs(talentSplit + operationsSplit - 100) > 0.01
  ) {
    throw new Error(
      `${builderLabel}: splits must be non-negative and sum to 100.`,
    );
  }
  if (type === "fixed") {
    const baseAmount = Number(p.baseAmount);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      throw new Error(
        `${builderLabel}: fixed pricing needs a positive base amount.`,
      );
    }
    return {
      type: "fixed",
      baseAmount: Math.round(baseAmount),
      talentSplit,
      operationsSplit,
    };
  }
  if (type === "range") {
    const min = Number(p.baseAmountMin);
    const max = Number(p.baseAmountMax);
    if (!Number.isFinite(min) || min <= 0) {
      throw new Error(
        `${builderLabel}: range needs a positive min.`,
      );
    }
    if (!Number.isFinite(max) || max <= 0) {
      throw new Error(
        `${builderLabel}: range needs a positive max.`,
      );
    }
    if (max < min) {
      throw new Error(
        `${builderLabel}: range max cannot be less than range min.`,
      );
    }
    return {
      type: "range",
      baseAmountMin: Math.round(min),
      baseAmountMax: Math.round(max),
      talentSplit,
      operationsSplit,
    };
  }
  if (type === "hourly") {
    const rate = Number(p.hourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `${builderLabel}: hourly needs a positive hourly rate.`,
      );
    }
    return {
      type: "hourly",
      hourlyRate: Math.round(rate),
      talentSplit,
      operationsSplit,
    };
  }
  throw new Error(
    `${builderLabel}: unknown pricing type "${type}". Use fixed, range, or hourly.`,
  );
}

/**
 * Parse the proposedBuildersJson payload. Validates every entry has
 * a userId, pricing, timeline, and relevance. Returns typed builders.
 */
function parseProposedBuilders(raw: string): ProposedBuilder[] {
  if (!raw.trim()) {
    throw new Error("Propose at least one builder.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "proposedBuildersJson is not valid JSON. Fix the composer.",
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error("proposedBuildersJson must be an array.");
  }
  if (parsed.length === 0) {
    throw new Error("Propose at least one builder.");
  }
  if (parsed.length > 5) {
    throw new Error(
      "Propose no more than five builders. Quality of curation is the whole point.",
    );
  }
  const seen = new Set<string>();
  const result: ProposedBuilder[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new Error("Each builder entry must be an object.");
    }
    const b = item as Record<string, unknown>;
    const userId = String(b.userId ?? "").trim();
    if (!userId) {
      throw new Error("A builder is missing userId.");
    }
    if (seen.has(userId)) {
      throw new Error(
        `Duplicate builder ${userId}. Each Builder can appear at most once per quote.`,
      );
    }
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`Unknown builder: ${userId}`);
    }
    const label = `${user.firstName ?? userId}`;
    const timeline = String(b.timeline ?? "").trim();
    if (timeline.length < 3) {
      throw new Error(`${label}: timeline is required.`);
    }
    const relevance = String(b.relevance ?? "").trim();
    if (relevance.length < 10) {
      throw new Error(
        `${label}: relevance line is too thin. Write one honest sentence.`,
      );
    }
    const pricing = validateBuilderPricing(b.pricing, label);
    seen.add(userId);
    result.push({ userId, pricing, timeline, relevance });
  }
  return result;
}

/**
 * Author a new quote. Admin picks a project, adds a client display
 * name, composes the proposed hand as JSON (each Builder carrying
 * per-Builder pricing + timeline + relevance), defines engagement-
 * level scope. Blocks duplicates on the same project — remove the
 * existing quote first if the plan changes.
 */
export async function createCooperativeQuote(formData: FormData) {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const clientDisplayName = String(
    formData.get("clientDisplayName") ?? "",
  ).trim();
  const proposedBuildersJson = String(
    formData.get("proposedBuildersJson") ?? "",
  );
  const scopeSummary = String(formData.get("scopeSummary") ?? "").trim();
  const deliverablesRaw = String(formData.get("deliverables") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();

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

  const proposedBuilders = parseProposedBuilders(proposedBuildersJson);

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
    throw new Error(
      "Engagement timeline is required. One line, human-readable.",
    );
  }

  const now = new Date().toISOString();
  const row: CooperativeQuote = {
    id: newQuoteId(),
    clientToken: newClientToken(projectId),
    projectId,
    clientDisplayName,
    proposedBuilders,
    scope: {
      summary: scopeSummary,
      deliverables,
      timeline,
    },
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
      proposedBuilderIds: proposedBuilders.map((b) => b.userId),
      builderPricingTypes: proposedBuilders.map((b) => b.pricing.type),
    },
    reason: `Quote for ${project.title}`,
  });

  revalidatePath("/admin/cooperative-quotes");
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

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/quotes/${removed.clientToken}`);
}

/**
 * Client-facing approve action. Called from the tokenized quote surface
 * at /quotes/[token]. No admin auth requirement — the token IS the
 * credential (same pattern as /invoices/[token] and /receipts/[token]).
 * Anyone in possession of the magic link can approve the quote.
 *
 * Flips status → "approved", records the selected lead builder +
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
    throw new Error("Select a lead builder before approving.");
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
  if (
    !quote.proposedBuilders.some((b) => b.userId === selectedLeadUserId)
  ) {
    throw new Error(
      "Selected lead is not among the proposed builders for this quote.",
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

/**
 * Client-facing undo action. Reverts an approved or declined quote
 * back to "viewed" so the client can re-evaluate. Same token-based
 * auth as approve/decline. No admin required. Idempotent: refuses to
 * revert an already-open quote.
 *
 * Clears selectedLeadUserId + decidedAt. Logs the undo as its own
 * audit event with the previous decided-status in the before payload
 * so the trail preserves what the client had chosen.
 *
 * Notifies admins so they know to pause any kickoff momentum that
 * might have started off the original approve. Uses the same
 * quote_declined kind (nearest fit) with body text that spells out
 * this is a revert, not a fresh decline.
 */
export async function undoCooperativeQuoteDecision(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) throw new Error("Quote token is required.");

  const quote = MOCK_COOPERATIVE_QUOTES.find((q) => q.clientToken === token);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status !== "approved" && quote.status !== "declined") {
    throw new Error(
      "Only approved or declined quotes can be reopened.",
    );
  }

  const previousStatus = quote.status;
  const previousLead = quote.selectedLeadUserId;
  const previousDecidedAt = quote.decidedAt;
  quote.status = "viewed";
  quote.decidedAt = null;
  quote.selectedLeadUserId = null;

  const project = MOCK_PROJECTS.find((p) => p.id === quote.projectId);
  const projectTitle = project?.title ?? quote.projectId;

  logAuditEvent({
    actorUserId: quote.createdByUserId,
    actorRoleSnapshot: "system",
    action:
      previousStatus === "approved"
        ? "quote.approved"
        : "quote.declined",
    resourceKind: "cooperative_quote",
    resourceId: quote.id,
    before: {
      status: previousStatus,
      selectedLeadUserId: previousLead,
      decidedAt: previousDecidedAt,
    },
    after: {
      status: "viewed",
      selectedLeadUserId: null,
      decidedAt: null,
    },
    reason: `Client ${quote.clientDisplayName} reopened the quote after ${previousStatus}. Selection cleared.`,
  });

  notifyAdminsOnQuoteDecision(
    quote,
    "quote_declined",
    `${quote.clientDisplayName} reopened: ${projectTitle}`,
    `Previously ${previousStatus}. Selection cleared. Pause any kickoff momentum and re-engage.`,
  );

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/quotes/${quote.clientToken}`);
}
