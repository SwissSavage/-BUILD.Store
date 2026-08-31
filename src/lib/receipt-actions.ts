/**
 * Cooperative Receipt admin actions.
 *
 * Generate + remove post-project receipts — the gated proof-of-
 * improvement layer clients see after settlement. Rows land in
 * `cooperative_receipts`.
 *
 * Until 2026-08-30 these were in-memory while `/receipts/[token]`
 * already read Postgres, so generating a receipt produced a
 * magic-link that 404'd for the client it was sent to.
 *
 * Design posture:
 *   - Milestones hit rate auto-computed from the milestone table
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
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cooperativeReceipts } from "@/db/schema";
import { getAllProjects, getProjectById } from "@/lib/readers/projects";
import { getMilestonesForProject } from "@/lib/readers";
import { cooperativeReceiptReader } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { CooperativeReceipt } from "@/lib/types";

function newReceiptId(): string {
  return `receipt_${randomUUID()}`;
}

/**
 * Client magic-link token. Opaque and random.
 *
 * The previous form was `rcpt_<projectId>_<6 chars of Math.random>`,
 * which leaked the project id into a URL sent outside the
 * cooperative and left roughly 36^6 of actual entropy behind a
 * predictable prefix. This link is the only thing standing between a
 * stranger and a client's settlement figures, so it uses a CSPRNG and
 * carries no information about what it points at.
 *
 * Never regenerate on update — the client's link has to stay stable.
 */
function newClientToken(): string {
  return `rcpt_${randomUUID()}`;
}

/**
 * Compute milestone hit rate from the existing milestone store.
 * "Hit" = completed. Denominator = total non-cancelled milestones.
 * Used as default; admin can override.
 */
async function computeMilestoneRate(projectId: string): Promise<{
  hit: number;
  total: number;
}> {
  const rows = await getMilestonesForProject(projectId);
  const total = rows.length;
  const hit = rows.filter((m) => m.status === "completed").length;
  return { hit, total };
}

/**
 * Parse a comma- or space-delimited project-id list into an array of
 * validated project ids. Silently drops entries that don't resolve.
 */
async function parseSubsequentProjectIds(raw: string): Promise<string[]> {
  const ids = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0) return [];

  // One query for the whole list rather than a lookup per id. Entries
  // that don't resolve are dropped, same as before — this field is a
  // free-text admin convenience, not a validated relation.
  const found = await getAllProjects();
  const known = new Set(found.projects.map((p) => p.id));
  return ids.filter((id) => known.has(id));
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
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found.");

  const existing = await cooperativeReceiptReader.where(
    eq(cooperativeReceipts.projectId, projectId),
  );
  if (existing.length > 0) {
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
  const computed = await computeMilestoneRate(projectId);
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

  const subsequentProjectIds = await parseSubsequentProjectIds(subsequentRaw);

  const row: CooperativeReceipt = {
    id: newReceiptId(),
    clientToken: newClientToken(),
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
  await db.insert(cooperativeReceipts).values({
    id: row.id,
    clientToken: row.clientToken,
    projectId: row.projectId,
    cashFlowPct: String(row.cashFlowPct),
    timeToMatchHours: row.timeToMatchHours,
    milestonesHit: row.milestonesHit,
    milestonesTotal: row.milestonesTotal,
    crewPeerReviewOvrDelta: String(row.crewPeerReviewOvrDelta),
    subsequentProjectIds: row.subsequentProjectIds,
    generatedAt: row.generatedAt,
    collaboratorCardTokenId: row.collaboratorCardTokenId,
  });

  await logAuditEvent({
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
 * Remove an existing receipt.
 *
 * A hard delete. The audit entry below preserves the historical
 * footprint — what was generated, for which project, with what
 * figures — so the record survives even though the row does not, and
 * the client's magic-link stops resolving immediately.
 */
export async function removeCooperativeReceipt(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Receipt id is required.");

  const removed = await cooperativeReceiptReader.byId(id);
  if (!removed) throw new Error("Receipt not found.");

  await db.delete(cooperativeReceipts).where(eq(cooperativeReceipts.id, id));

  await logAuditEvent({
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
