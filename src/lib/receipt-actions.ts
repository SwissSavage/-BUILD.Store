/**
 * Cooperative Receipt admin actions.
 *
 * Generate + remove post-project receipts — the gated proof-of-
 * improvement layer clients see after settlement. Sandbox mutates
 * MOCK_COOPERATIVE_RECEIPTS in memory; production persists to a
 * `cooperative_receipts` table and dispatches a signed magic-link to
 * the client contact.
 *
 * Design posture:
 *   - Milestones hit rate auto-computed from MOCK_PROJECT_MILESTONES
 *     where possible; admin can override.
 *   - Cash flow % defaults to 85 (baseline cooperative rule); admin
 *     overrides when the specific engagement diverged.
 *   - Time to match + peer-review OVR delta are admin-provided
 *     signals in sandbox; production reads them from the RFP + peer
 *     review tables.
 *   - Subsequent projects are admin-picked in sandbox; production
 *     derives from crew-membership queries.
 *   - Token is generated server-side and never regenerated on
 *     mutations — the client's magic-link stays stable.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_PROJECT_MILESTONES } from "@/lib/mock-data/project-milestones";
import { MOCK_COOPERATIVE_RECEIPTS } from "@/lib/mock-data/cooperative-receipts";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { CooperativeReceipt } from "@/lib/types";

function newReceiptId(): string {
  return `receipt_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

/**
 * Signed client token — sandbox uses a legible slug; production
 * replaces with a random opaque token (or a signed JWT). Never
 * regenerate on update: the client's magic-link stays stable.
 */
function newClientToken(projectId: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rcpt_${projectId.replace(/^p_/, "")}_${rand}`;
}

/**
 * Compute milestone hit rate from the existing milestone store.
 * "Hit" = completed. Denominator = total non-cancelled milestones.
 * Used as default; admin can override.
 */
function computeMilestoneRate(projectId: string): {
  hit: number;
  total: number;
} {
  const rows = MOCK_PROJECT_MILESTONES.filter(
    (m) => m.projectId === projectId,
  );
  const total = rows.length;
  const hit = rows.filter((m) => m.status === "completed").length;
  return { hit, total };
}

/**
 * Parse a comma- or space-delimited project-id list into an array of
 * validated project ids. Silently drops entries that don't resolve.
 */
function parseSubsequentProjectIds(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => MOCK_PROJECTS.some((p) => p.id === s));
}

/**
 * Admin generates a receipt for a settled project. Any single project
 * can only have one active receipt at a time — the client's magic-
 * link is meant to be stable across their engagement history. To
 * regenerate, remove the existing receipt first.
 */
export async function generateCooperativeReceipt(formData: FormData) {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const cashFlowPctRaw = String(formData.get("cashFlowPct") ?? "85").trim();
  const timeToMatchHoursRaw = String(
    formData.get("timeToMatchHours") ?? "48",
  ).trim();
  const milestonesHitRaw = String(formData.get("milestonesHit") ?? "").trim();
  const milestonesTotalRaw = String(
    formData.get("milestonesTotal") ?? "",
  ).trim();
  const crewPeerReviewOvrDeltaRaw = String(
    formData.get("crewPeerReviewOvrDelta") ?? "0",
  ).trim();
  const subsequentRaw = String(
    formData.get("subsequentProjectIds") ?? "",
  ).trim();

  if (!projectId) throw new Error("Pick a project to generate the receipt for.");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  if (MOCK_COOPERATIVE_RECEIPTS.some((r) => r.projectId === projectId)) {
    throw new Error(
      "A receipt already exists for this project. Remove the existing one before regenerating.",
    );
  }

  const cashFlowPct = Number.parseFloat(cashFlowPctRaw);
  if (Number.isNaN(cashFlowPct) || cashFlowPct <= 0 || cashFlowPct > 100) {
    throw new Error("Cash flow % must be between 0 and 100.");
  }

  const timeToMatchHours = Number.parseInt(timeToMatchHoursRaw, 10);
  if (Number.isNaN(timeToMatchHours) || timeToMatchHours < 0) {
    throw new Error("Time-to-match hours must be a non-negative integer.");
  }

  // Default milestone rate from the milestone store; admin can override
  // by providing explicit values.
  const computed = computeMilestoneRate(projectId);
  const milestonesHit = milestonesHitRaw.length > 0
    ? Number.parseInt(milestonesHitRaw, 10)
    : computed.hit;
  const milestonesTotal = milestonesTotalRaw.length > 0
    ? Number.parseInt(milestonesTotalRaw, 10)
    : computed.total;

  if (
    Number.isNaN(milestonesHit) ||
    Number.isNaN(milestonesTotal) ||
    milestonesHit < 0 ||
    milestonesTotal < 0 ||
    milestonesHit > milestonesTotal
  ) {
    throw new Error(
      "Milestone counts must be non-negative integers with hit ≤ total.",
    );
  }

  const crewPeerReviewOvrDelta = Number.parseFloat(crewPeerReviewOvrDeltaRaw);
  if (Number.isNaN(crewPeerReviewOvrDelta)) {
    throw new Error("Crew peer-review OVR delta must be numeric.");
  }

  const subsequentProjectIds = parseSubsequentProjectIds(subsequentRaw);

  const row: CooperativeReceipt = {
    id: newReceiptId(),
    clientToken: newClientToken(projectId),
    projectId,
    cashFlowPct,
    timeToMatchHours,
    milestonesHit,
    milestonesTotal,
    crewPeerReviewOvrDelta,
    subsequentProjectIds,
    generatedAt: new Date().toISOString(),
    collaboratorCardTokenId: null,
  };
  MOCK_COOPERATIVE_RECEIPTS.push(row);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "receipt.generated",
    resourceKind: "cooperative_receipt",
    resourceId: row.id,
    before: null,
    after: {
      projectId,
      clientToken: row.clientToken,
      cashFlowPct,
      milestonesHit,
      milestonesTotal,
    },
    reason: `Receipt for ${project.title}`,
  });

  revalidatePath("/admin/receipts");
  revalidatePath(`/receipts/${row.clientToken}`);
}

/**
 * Remove an existing receipt. Sandbox splices the array; production
 * should soft-delete + preserve the audit record so the magic-link
 * stops resolving but the historical footprint remains.
 */
export async function removeCooperativeReceipt(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Receipt id is required.");

  const idx = MOCK_COOPERATIVE_RECEIPTS.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Receipt not found.");

  const [removed] = MOCK_COOPERATIVE_RECEIPTS.splice(idx, 1);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "receipt.removed",
    resourceKind: "cooperative_receipt",
    resourceId: removed.id,
    before: {
      projectId: removed.projectId,
      clientToken: removed.clientToken,
      cashFlowPct: removed.cashFlowPct,
      milestonesHit: removed.milestonesHit,
      milestonesTotal: removed.milestonesTotal,
    },
    after: null,
    reason: null,
  });

  revalidatePath("/admin/receipts");
  revalidatePath(`/receipts/${removed.clientToken}`);
}
