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
import { notify } from "@/lib/writers/notifications";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { secureToken } from "@/lib/secure-token";
import {
  cooperativeQuotes,
  projects,
  users as usersTable,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getUserById } from "@/lib/readers/users";
import { updateHubspotDealStage } from "@/lib/crm-stub";
import {
  DOCUMENSO_TEMPLATES,
  inviteRecipientToTemplate,
} from "@/lib/documenso";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
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

function newClientToken(_projectId: string): string {
  // The project id used to be embedded here, and project ids appear in
  // public URLs, so six random characters were all that separated a
  // known contract from its quote. A token must not describe what it
  // unlocks.
  void _projectId;
  return secureToken("q");
}

/**
 * Fan out one notification per admin on the project's roster. Used when
 * the client makes a quote decision (approve or decline) so the admin
 * pool knows to move on kickoff logistics (or on iterating the pitch).
 * Same pattern as booking / DM / customer-feedback notifications.
 */
async function notifyAdminsOnQuoteDecision(
  // Narrowed to just the fields this helper reads so callers can pass
  // the raw Drizzle row without casting the jsonb columns (proposedBuilders,
  // scope) to their canonical types just to satisfy CooperativeQuote.
  quote: Pick<CooperativeQuote, "id" | "projectId" | "createdByUserId">,
  kind: NotificationKind,
  title: string,
  body: string,
): Promise<void> {
  const [project] = await db
    .select({ adminUserIds: projects.adminUserIds })
    .from(projects)
    .where(eq(projects.id, quote.projectId))
    .limit(1);
  const adminUserIds = project?.adminUserIds ?? [];
  if (adminUserIds.length === 0) {
    // Fall back to notifying the quote's creator so it doesn't get
    // dropped if the project's admin roster is empty. Rare in practice
    // (every project should have at least the creator as admin), but
    // the fallback avoids silent black-hole cases.
    adminUserIds.push(quote.createdByUserId);
  }
  const href = `/admin/cooperative-quotes`;
  // Routed through the shared writer. These were pushed onto the
  // in-memory array, so a submitted quote never lit the admin queue
  // it was telling the admin to go look at.
  for (const adminId of adminUserIds) {
    await notify({ userId: adminId, kind, title, body, href });
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
async function parseProposedBuilders(
  raw: string,
): Promise<ProposedBuilder[]> {
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
    const user = await getUserById(userId);
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
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new Error("Project not found.");

  const existingQuote = await db
    .select({ id: cooperativeQuotes.id })
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.projectId, projectId))
    .limit(1);
  if (existingQuote.length > 0) {
    throw new Error(
      "A quote already exists for this project. Remove the existing one before authoring a new quote.",
    );
  }

  if (clientDisplayName.length < 2) {
    throw new Error("Client display name is required.");
  }

  const proposedBuilders = await parseProposedBuilders(proposedBuildersJson);

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
  await db.insert(cooperativeQuotes).values(row);

  await logAuditEvent({
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

  const [removed] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.id, id))
    .limit(1);
  if (!removed) throw new Error("Quote not found.");

  await db.delete(cooperativeQuotes).where(eq(cooperativeQuotes.id, id));

  await logAuditEvent({
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
  // Task #45 — client contact info captured on approve so the dual-
  // envelope SOW dispatch has an address. Magic-link viewing is
  // anonymous, so this is the first point where the client identifies.
  const clientContactEmail = String(
    formData.get("clientContactEmail") ?? "",
  )
    .trim()
    .toLowerCase();
  const clientContactName = String(
    formData.get("clientContactName") ?? "",
  ).trim();

  if (!token) throw new Error("Quote token is required.");
  if (!selectedLeadUserId) {
    throw new Error("Select a lead builder before approving.");
  }
  if (
    !clientContactEmail ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientContactEmail)
  ) {
    throw new Error("A valid contact email is required to send you the SOW.");
  }
  if (clientContactName.length < 2) {
    throw new Error("Your name is required so we can address the SOW to you.");
  }

  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.clientToken, token))
    .limit(1);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === "approved" || quote.status === "declined") {
    throw new Error(
      `This quote has already been ${quote.status}. Contact your Future Modern account owner if you need to change the decision.`,
    );
  }
  if (quote.status === "draft") {
    throw new Error("This quote hasn't been sent yet.");
  }
  const proposedBuilders = (quote.proposedBuilders ?? []) as ProposedBuilder[];
  if (!proposedBuilders.some((b) => b.userId === selectedLeadUserId)) {
    throw new Error(
      "Selected lead is not among the proposed builders for this quote.",
    );
  }

  const previousStatus = quote.status;
  const now = new Date().toISOString();
  await db
    .update(cooperativeQuotes)
    .set({
      status: "approved",
      decidedAt: now,
      selectedLeadUserId,
      clientContactEmail,
      clientContactName,
    })
    .where(eq(cooperativeQuotes.id, quote.id));
  // Reflect changes in the in-memory object for notification helper.
  quote.status = "approved";
  quote.decidedAt = now;
  quote.selectedLeadUserId = selectedLeadUserId;
  quote.clientContactEmail = clientContactEmail;
  quote.clientContactName = clientContactName;

  const leadUser = await getUserById(selectedLeadUserId);
  const leadName = leadUser
    ? `${leadUser.firstName} ${leadUser.lastName}`.trim()
    : selectedLeadUserId;
  const [project] = await db
    .select({
      title: projects.title,
      hubspotDealId: projects.hubspotDealId,
    })
    .from(projects)
    .where(eq(projects.id, quote.projectId))
    .limit(1);
  const projectTitle = project?.title ?? quote.projectId;

  // Task #49 + #50: push the approval to HubSpot. contractsent is
  // the right stage here — client has picked their lead but LOI + SOW
  // dispatch (task #45) haven't fired yet. Once both envelopes come
  // back signed, downstream logic moves the deal to closedwon.
  if (project?.hubspotDealId) {
    void updateHubspotDealStage(
      project.hubspotDealId,
      "contractsent",
      `Client ${quote.clientDisplayName} selected ${leadName} as lead. Awaiting LOI + SOW signatures.`,
    );
  }

  await logAuditEvent({
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
      clientContactEmail,
      clientContactName,
    },
    reason: `Client ${quote.clientDisplayName} approved the quote and selected ${leadName} as lead.`,
  });

  await notifyAdminsOnQuoteDecision(
    quote,
    "quote_approved",
    `${quote.clientDisplayName} approved: ${projectTitle}`,
    `Lead: ${leadName}. Kick off contracts + calendar within one business day.`,
  );

  // Task #45 — dispatch the two envelopes. Kept OUT of the approve
  // transaction so a Documenso outage doesn't roll back the client's
  // approval. Errors are audit-logged; admin gets a follow-up nudge
  // via the sow.dispatch_failed entry in /admin/audit-log.
  await dispatchSowDualEnvelope({
    quoteId: quote.id,
    clientToken: quote.clientToken,
    projectId: quote.projectId,
    projectTitle,
    clientContactEmail,
    clientContactName,
    leadUserId: selectedLeadUserId,
    leadName,
    actorUserId: quote.createdByUserId,
  });

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/quotes/${quote.clientToken}`);
}

/**
 * Task #45 — dispatch client SOW + talent engagement confirmation
 * envelopes via Documenso. Best-effort: if a template id is not
 * configured or the Documenso call fails, log the failure and continue
 * (the approval itself stays valid). Admin gets the failure via audit
 * log and can retry from /admin/cooperative-quotes.
 *
 * On success both envelope ids are persisted onto the quote row so the
 * webhook route (existing infra from task #19) can match inbound
 * signature-completed events back to the quote and stamp
 * sowClientSignedAt / sowTalentSignedAt.
 */
async function dispatchSowDualEnvelope(input: {
  quoteId: string;
  clientToken: string;
  projectId: string;
  projectTitle: string;
  clientContactEmail: string;
  clientContactName: string;
  leadUserId: string;
  leadName: string;
  actorUserId: string;
}): Promise<void> {
  const {
    quoteId,
    clientToken,
    projectId,
    projectTitle,
    clientContactEmail,
    clientContactName,
    leadUserId,
    leadName,
    actorUserId,
  } = input;

  // Fetch the picked talent's email for the engagement envelope.
  const [leadRow] = await db
    .select({
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(usersTable)
    .where(eq(usersTable.id, leadUserId))
    .limit(1);

  const leadEmail = leadRow?.email ?? null;
  const leadFullName = leadRow
    ? `${leadRow.firstName ?? ""} ${leadRow.lastName ?? ""}`.trim() || leadName
    : leadName;

  const clientTemplateId = DOCUMENSO_TEMPLATES.CLIENT_SOW;
  const talentTemplateId = DOCUMENSO_TEMPLATES.TALENT_ENGAGEMENT_CONFIRMATION;

  let clientSowDocumensoId: string | null = null;
  let talentEngagementDocumensoId: string | null = null;
  const failures: string[] = [];

  // 1) Client SOW envelope.
  if (!clientTemplateId) {
    failures.push(
      "CLIENT_SOW template id is not configured (DOCUMENSO_TEMPLATE_CLIENT_SOW).",
    );
  } else {
    try {
      const doc = await inviteRecipientToTemplate({
        templateEnvelopeId: clientTemplateId,
        recipient: {
          name: clientContactName,
          email: clientContactEmail,
          role: "SIGNER",
        },
        title: `SOW — ${projectTitle}`,
        externalId: `quote:${quoteId}:client_sow`,
      });
      clientSowDocumensoId = String(doc.documentId ?? doc.id ?? "");
    } catch (e) {
      failures.push(
        `Client SOW dispatch failed: ${(e as Error).message}`,
      );
    }
  }

  // 2) Talent engagement envelope.
  if (!talentTemplateId) {
    failures.push(
      "TALENT_ENGAGEMENT_CONFIRMATION template id is not configured (DOCUMENSO_TEMPLATE_TALENT_ENGAGEMENT_CONFIRMATION).",
    );
  } else if (!leadEmail) {
    failures.push(
      `Lead talent ${leadUserId} has no email on file — cannot send engagement envelope.`,
    );
  } else {
    try {
      const doc = await inviteRecipientToTemplate({
        templateEnvelopeId: talentTemplateId,
        recipient: {
          name: leadFullName,
          email: leadEmail,
          role: "SIGNER",
        },
        title: `Engagement Confirmation — ${projectTitle}`,
        externalId: `quote:${quoteId}:talent_engagement`,
      });
      talentEngagementDocumensoId = String(doc.documentId ?? doc.id ?? "");
    } catch (e) {
      failures.push(
        `Talent engagement dispatch failed: ${(e as Error).message}`,
      );
    }
  }

  const dispatchedAt = new Date().toISOString();
  await db
    .update(cooperativeQuotes)
    .set({
      clientSowDocumensoId,
      talentEngagementDocumensoId,
      sowDispatchedAt: dispatchedAt,
    })
    .where(eq(cooperativeQuotes.id, quoteId));

  if (failures.length > 0) {
    await logAuditEvent({
      actorUserId,
      actorRoleSnapshot: "system",
      action: "sow.dispatch_failed",
      resourceKind: "cooperative_quote",
      resourceId: quoteId,
      before: null,
      after: {
        projectId,
        clientContactEmail,
        leadUserId,
        clientSowDocumensoId,
        talentEngagementDocumensoId,
        failures,
      },
      reason: failures.join(" | "),
    });
  } else {
    await logAuditEvent({
      actorUserId,
      actorRoleSnapshot: "system",
      action: "sow.dispatched",
      resourceKind: "cooperative_quote",
      resourceId: quoteId,
      before: null,
      after: {
        projectId,
        clientContactEmail,
        leadUserId,
        clientSowDocumensoId,
        talentEngagementDocumensoId,
        dispatchedAt,
      },
      reason: `SOW + engagement envelopes dispatched for ${projectTitle}.`,
    });
  }
  void clientToken;
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

  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.clientToken, token))
    .limit(1);
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
  await db
    .update(cooperativeQuotes)
    .set({ status: "declined", decidedAt: now })
    .where(eq(cooperativeQuotes.id, quote.id));
  quote.status = "declined";
  quote.decidedAt = now;
  // Preserve selectedLeadUserId if it was chosen before the decline —
  // useful signal for the admin follow-up. But null it if the client
  // never chose a lead, so the record accurately reflects "no lead
  // selected."
  // (In practice most declines will null out selectedLeadUserId.)

  const [project] = await db
    .select({
      title: projects.title,
      hubspotDealId: projects.hubspotDealId,
    })
    .from(projects)
    .where(eq(projects.id, quote.projectId))
    .limit(1);
  const projectTitle = project?.title ?? quote.projectId;

  // Task #49: push the decline to HubSpot as closedlost so the deal
  // doesn't sit stale in the pipeline waiting for a manual admin
  // update. Best-effort — failure is logged but doesn't rollback
  // the platform-side decline; the inbound webhook will reconcile
  // on the next stage change.
  if (project?.hubspotDealId) {
    // Fire and forget; don't block the client action on HubSpot
    // latency. Response handling is inside updateHubspotDealStage.
    void updateHubspotDealStage(
      project.hubspotDealId,
      "closedlost",
      reason ||
        `Client ${quote.clientDisplayName} declined the cooperative quote via magic-link.`,
    );
  }

  await logAuditEvent({
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

  await notifyAdminsOnQuoteDecision(
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

  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.clientToken, token))
    .limit(1);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status !== "approved" && quote.status !== "declined") {
    throw new Error(
      "Only approved or declined quotes can be reopened.",
    );
  }

  const previousStatus = quote.status;
  const previousLead = quote.selectedLeadUserId;
  const previousDecidedAt = quote.decidedAt;
  await db
    .update(cooperativeQuotes)
    .set({
      status: "viewed",
      decidedAt: null,
      selectedLeadUserId: null,
    })
    .where(eq(cooperativeQuotes.id, quote.id));
  quote.status = "viewed";
  quote.decidedAt = null;
  quote.selectedLeadUserId = null;

  const [project] = await db
    .select({ title: projects.title })
    .from(projects)
    .where(eq(projects.id, quote.projectId))
    .limit(1);
  const projectTitle = project?.title ?? quote.projectId;

  await logAuditEvent({
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

  await notifyAdminsOnQuoteDecision(
    quote,
    "quote_declined",
    `${quote.clientDisplayName} reopened: ${projectTitle}`,
    `Previously ${previousStatus}. Selection cleared. Pause any kickoff momentum and re-engage.`,
  );

  revalidatePath("/admin/cooperative-quotes");
  revalidatePath(`/quotes/${quote.clientToken}`);
}

/**
 * Task #45 — admin retry for SOW dual-envelope dispatch. Fires when
 * the initial dispatch failed on one or both envelopes (Documenso
 * outage, missing template id at approve time, lead had no email on
 * file). Reads the current quote row, re-runs dispatchSowDualEnvelope
 * with the saved client contact + selected lead.
 */
export async function retrySowDispatch(formData: FormData) {
  const admin = await requireAdmin();
  const quoteId = String(formData.get("id") ?? "").trim();
  if (!quoteId) throw new Error("Quote id required.");

  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.id, quoteId))
    .limit(1);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status !== "approved" || !quote.selectedLeadUserId) {
    throw new Error(
      "Only approved quotes with a picked lead can retry SOW dispatch.",
    );
  }
  if (!quote.clientContactEmail || !quote.clientContactName) {
    throw new Error(
      "Missing client contact — no way to re-dispatch. Ask the client to re-submit.",
    );
  }

  const leadUser = await getUserById(quote.selectedLeadUserId);
  const leadName = leadUser
    ? `${leadUser.firstName} ${leadUser.lastName}`.trim()
    : quote.selectedLeadUserId;

  const [project] = await db
    .select({ title: projects.title })
    .from(projects)
    .where(eq(projects.id, quote.projectId))
    .limit(1);

  await dispatchSowDualEnvelope({
    quoteId: quote.id,
    clientToken: quote.clientToken,
    projectId: quote.projectId,
    projectTitle: project?.title ?? quote.projectId,
    clientContactEmail: quote.clientContactEmail,
    clientContactName: quote.clientContactName,
    leadUserId: quote.selectedLeadUserId,
    leadName,
    actorUserId: admin.id,
  });

  revalidatePath("/admin/cooperative-quotes");
}
