/**
 * Edit a posted project, contract, or internal initiative.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Jobs had upsertJob. Projects and contracts had nothing. Once a
 * contract was posted, its title, brief, pillar and required skills
 * were frozen: a typo in an RFP or a scope correction meant trashing
 * the listing and posting a replacement, which loses the id, the
 * proposals attached to it, and the position on the board.
 *
 * Jamar: "I still don't see a way or an option to edit, or delete the
 * test proposal. Or any jobs, contracts, or projects."
 *
 * Same shape as the trash actions: admin only, audit-logged with the
 * before and after, and nothing here can touch money or approval
 * state.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectApplications, projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { parseRichText, richTextPlainText } from "@/lib/rich-text";
import type { Industry } from "@/lib/types";

const INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

const STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
type ProjectStatus = (typeof STATUSES)[number];

/**
 * Update the editable fields of a project or contract.
 *
 * Deliberately narrow. Budget, revenue, payout amounts, bonus state and
 * rfpApprovedAt are NOT editable here — those are money and governance
 * paths with their own guarded writers, and folding them into a general
 * edit form is how an accidental keystroke becomes a payout change.
 */
export async function editProject(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const before = await getProjectById(id);
  if (!before) throw new Error("Project not found.");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const featuredImageUrl = String(formData.get("featuredImageUrl") ?? "").trim();
  const richDescription = parseRichText(description);
  const descriptionText = richDescription
    ? richTextPlainText(richDescription)
    : description;
  const industryRaw = String(formData.get("industry") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const skillsRequired = String(formData.get("skillsRequired") ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!title) throw new Error("Title is required.");
  if (descriptionText.trim().length < 30) {
    throw new Error(
      "Description must be at least 30 characters. This is what people decide to bid on.",
    );
  }
  if (!INDUSTRIES.includes(industryRaw as Industry)) {
    throw new Error("Pick a pillar.");
  }
  if (!STATUSES.includes(statusRaw as ProjectStatus)) {
    throw new Error("Unknown status.");
  }
  if (featuredImageUrl) {
    try {
      const url = new URL(featuredImageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error();
      }
    } catch {
      throw new Error("Featured image must be a valid http(s) URL.");
    }
  }

  await db
    .update(projects)
    .set({
      title,
      description,
      featuredImageUrl: featuredImageUrl || null,
      industry: industryRaw as Industry,
      status: statusRaw as ProjectStatus,
      skillsRequired,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.edited",
    resourceKind: "project",
    resourceId: id,
    before: {
      title: before.title,
      status: before.status,
      industry: before.industry,
      skillsRequired: before.skillsRequired,
      featuredImageUrl: before.featuredImageUrl ?? null,
    },
    after: { title, status: statusRaw, industry: industryRaw, skillsRequired, featuredImageUrl: featuredImageUrl || null },
    reason: "Listing edited by admin.",
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/projects");
  revalidatePath("/contracts");
  revalidatePath("/admin/projects");
  redirect(before.kind === "contract" ? `/contracts/${id}` : `/projects/${id}`);
}

/**
 * Remove a proposal from the queue without destroying it.
 *
 * Sets status to "withdrawn" rather than deleting the row, which is the
 * same posture as the project trash bin: an admin who removes the wrong
 * proposal during triage should be able to put it back, and the
 * contractor's submission should not silently evaporate.
 *
 * Refuses once a proposal has been selected. At that point the person
 * is on the engagement, and removing them is a staffing decision that
 * belongs in the project, not a queue cleanup action.
 */
export async function withdrawProposalAsAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const [existing] = await db
    .select({
      id: projectApplications.id,
      status: projectApplications.status,
      projectId: projectApplications.projectId,
    })
    .from(projectApplications)
    .where(eq(projectApplications.id, id))
    .limit(1);

  if (!existing) throw new Error("Proposal not found.");
  if (existing.status === "approved") {
    throw new Error(
      "This proposal was selected, so the contractor is on the engagement. Remove them from the project instead.",
    );
  }

  await db
    .update(projectApplications)
    .set({
      status: "withdrawn",
      withdrawnAt: new Date().toISOString(),
      reviewedBy: admin.id,
      reviewedAt: new Date().toISOString(),
    })
    .where(eq(projectApplications.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "proposal.removed_from_queue",
    resourceKind: "project",
    resourceId: existing.projectId,
    before: { proposalId: id, status: existing.status },
    after: { proposalId: id, status: "withdrawn" },
    reason: "Proposal removed from the queue by admin. Reversible.",
  });

  revalidatePath("/admin/projects/applications");
  revalidatePath(`/contracts/${existing.projectId}`);
  revalidatePath(`/projects/${existing.projectId}`);
}

/** Put a withdrawn proposal back into the queue. */
export async function restoreProposalAsAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const restored = await db
    .update(projectApplications)
    .set({ status: "pending", withdrawnAt: null })
    .where(eq(projectApplications.id, id))
    .returning({ id: projectApplications.id, projectId: projectApplications.projectId });

  if (restored.length === 0) throw new Error("Proposal not found.");

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "proposal.restored_to_queue",
    resourceKind: "project",
    resourceId: restored[0].projectId,
    before: { proposalId: id, status: "withdrawn" },
    after: { proposalId: id, status: "pending" },
    reason: "Proposal restored to the queue by admin.",
  });

  revalidatePath("/admin/projects/applications");
}

/** Edit a pending proposal during admin review, before client presentation. */
export async function editProposalAsAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const portfolioLink = String(formData.get("portfolioLink") ?? "").trim();
  const hoursPerWeek = Math.max(
    0,
    Math.min(60, Number.parseInt(String(formData.get("hoursPerWeek") ?? ""), 10) || 0),
  );
  const rateRaw = String(formData.get("hourlyRate") ?? "").trim();
  const rate = rateRaw ? Number.parseFloat(rateRaw) : null;

  if (!id) throw new Error("Proposal id is required.");
  if (!proposedRole) throw new Error("Proposed role is required.");
  if (pitch.length < 20) {
    throw new Error("Pitch must be at least 20 characters.");
  }
  if (rateRaw && (!Number.isFinite(rate) || rate! < 0)) {
    throw new Error("Hourly rate must be a non-negative number.");
  }

  const [before] = await db
    .select()
    .from(projectApplications)
    .where(eq(projectApplications.id, id))
    .limit(1);
  if (!before) throw new Error("Proposal not found.");
  if (before.status !== "pending") {
    throw new Error("Only proposals awaiting admin review can be edited.");
  }
  if (before.clientPresentedAt) {
    throw new Error("This proposal has already been sent to the client and is locked.");
  }

  await db
    .update(projectApplications)
    .set({
      proposedRole,
      pitch,
      hoursPerWeek,
      hourlyRate: rate === null ? null : rate.toFixed(2),
      portfolioLink: portfolioLink || null,
    })
    .where(eq(projectApplications.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "proposal.edited_by_admin",
    resourceKind: "project",
    resourceId: before.projectId,
    before: {
      proposalId: id,
      proposedRole: before.proposedRole,
      pitch: before.pitch,
      hoursPerWeek: before.hoursPerWeek,
      hourlyRate: before.hourlyRate,
      portfolioLink: before.portfolioLink,
    },
    after: {
      proposalId: id,
      proposedRole,
      pitch,
      hoursPerWeek,
      hourlyRate: rate === null ? null : rate.toFixed(2),
      portfolioLink: portfolioLink || null,
    },
    reason: "Proposal edited by admin during review before client presentation.",
  });

  revalidatePath("/admin/projects/applications");
  revalidatePath(`/admin/rfps/${before.projectId}/bids`);
  revalidatePath(`/contracts/${before.projectId}`);
  revalidatePath(`/projects/${before.projectId}`);
}
