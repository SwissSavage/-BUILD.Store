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
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { CooperativeQuote } from "@/lib/types";

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
  const baseAmountRaw = String(formData.get("baseAmount") ?? "").trim();
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
      "Propose no more than five cooperators — quality of curation is the whole point.",
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
      "Scope summary is too thin — write a full paragraph, minimum.",
    );
  }

  const deliverables = parseDeliverables(deliverablesRaw);
  if (deliverables.length === 0) {
    throw new Error("At least one deliverable is required.");
  }

  if (timeline.length < 4) {
    throw new Error("Timeline is required — one line, human-readable.");
  }

  const baseAmount = Number.parseInt(baseAmountRaw, 10);
  if (Number.isNaN(baseAmount) || baseAmount <= 0) {
    throw new Error("Base amount must be a positive integer (USD).");
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
    pricing: {
      baseAmount,
      talentSplit,
      operationsSplit,
    },
    // Newly-authored quotes ship as `sent` in sandbox — production
    // adds an explicit dispatch step. Admin can compose + dispatch in
    // one action for now.
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
      baseAmount,
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
