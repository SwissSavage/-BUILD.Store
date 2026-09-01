/**
 * Project trash — soft delete, restore, purge.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY SOFT (2026-09-01)
 *
 * Admins need to clear test contracts. A hard DELETE takes the
 * project's applications, milestones, attribution entries and revenue
 * splits with it, and there is no way back from a wrong click on the
 * wrong row.
 *
 * So delete sets `deletedAt`. The row keeps existing, drops off every
 * surface via the `deleted_at IS NULL` filter in the projects reader,
 * and stays restorable for RETENTION_DAYS. The purge job clears
 * anything past that window.
 * ─────────────────────────────────────────────────────────────
 *
 * Admin-only, all three. Deleting a contract is not a member action
 * even for the member who created it — a project with other people's
 * work attached is not one person's to remove.
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projectApplications,
  projectMilestones,
  projects as projectsTable,
  revenueSplits,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

/** How long a trashed project stays restorable. */
export const RETENTION_DAYS = 30;

function revalidateProjectSurfaces(): void {
  revalidatePath("/projects");
  revalidatePath("/contracts");
  revalidatePath("/admin/projects");
  revalidatePath("/admin/contracts");
  revalidatePath("/admin/trash");
  revalidatePath("/admin");
}

/**
 * Move a project to the trash.
 *
 * Refuses when money has already moved. A contract with dispatched
 * payouts is a financial record, and hiding it from every surface —
 * even recoverably — breaks the ledger's own history. Those get
 * cancelled via the status field instead.
 */
export async function trashProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) throw new Error("id is required");

  const project = await getProjectById(id);
  if (!project) throw new Error("Project not found.");

  const [sent] = await db
    .select({ n: sql<number>`count(*)` })
    .from(revenueSplits)
    .where(
      and(
        eq(revenueSplits.contractId, id),
        isNotNull(revenueSplits.payoutSentAt),
      ),
    );
  if (Number(sent?.n ?? 0) > 0) {
    throw new Error(
      "This contract has dispatched payouts. It's a financial record — cancel it via status rather than deleting.",
    );
  }

  const now = new Date().toISOString();
  const trashed = await db
    .update(projectsTable)
    .set({
      deletedAt: now,
      deletedByUserId: admin.id,
      deleteReason: reason.length > 0 ? reason : null,
      updatedAt: now,
    })
    .where(
      and(eq(projectsTable.id, id), sql`${projectsTable.deletedAt} IS NULL`),
    )
    .returning({ id: projectsTable.id });
  if (trashed.length === 0) {
    throw new Error("Project was already in the trash.");
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.trashed",
    resourceKind: "project",
    resourceId: id,
    before: { deletedAt: null, title: project.title },
    after: { deletedAt: now },
    reason: reason.length > 0 ? reason : "Moved to trash.",
  });

  revalidateProjectSurfaces();
}

/** Pull a project back out of the trash. */
export async function restoreProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const project = await getProjectById(id, { includeDeleted: true });
  if (!project) throw new Error("Project not found.");

  const restored = await db
    .update(projectsTable)
    .set({
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(eq(projectsTable.id, id), isNotNull(projectsTable.deletedAt)),
    )
    .returning({ id: projectsTable.id });
  if (restored.length === 0) {
    throw new Error("Project is not in the trash.");
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.restored",
    resourceKind: "project",
    resourceId: id,
    before: { deletedAt: project.deletedAt },
    after: { deletedAt: null },
    reason: `Restored "${project.title}" from trash.`,
  });

  revalidateProjectSurfaces();
}

/**
 * Permanently remove a trashed project and everything hanging off it.
 *
 * Only reachable from the trash view, and only for rows already
 * soft-deleted — there is no path from a live project straight to
 * this. Two deliberate steps, because this one is the end.
 *
 * The audit entry is written BEFORE the delete and carries the title
 * and reason, so the record of what was destroyed survives the thing
 * being destroyed.
 */
export async function purgeProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (!id) throw new Error("id is required");

  const project = await getProjectById(id, { includeDeleted: true });
  if (!project) throw new Error("Project not found.");
  if (!project.deletedAt) {
    throw new Error(
      "Only trashed projects can be purged. Move it to the trash first.",
    );
  }
  if (confirm !== project.title) {
    throw new Error(
      "Type the project title exactly to confirm permanent deletion.",
    );
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.purged",
    resourceKind: "project",
    resourceId: id,
    before: {
      title: project.title,
      kind: project.kind,
      status: project.status,
      deletedAt: project.deletedAt,
      deleteReason: project.deleteReason,
    },
    after: null,
    reason: `Permanently purged "${project.title}".`,
  });

  // Children first — applications and milestones reference the
  // project, and the FK on splits is what the guard in trashProject
  // is protecting.
  await db.transaction(async (tx) => {
    await tx
      .delete(projectApplications)
      .where(eq(projectApplications.projectId, id));
    await tx
      .delete(projectMilestones)
      .where(eq(projectMilestones.projectId, id));
    await tx.delete(projectsTable).where(eq(projectsTable.id, id));
  });

  revalidateProjectSurfaces();
}

/**
 * Clear anything past the retention window. Called by the daily cron.
 *
 * Returns a count rather than throwing on a single bad row, so one
 * project with an unexpected reference doesn't stop the sweep.
 */
export async function purgeExpiredProjects(): Promise<{ purged: number }> {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const expired = await db
    .select({ id: projectsTable.id, title: projectsTable.title })
    .from(projectsTable)
    .where(
      and(
        isNotNull(projectsTable.deletedAt),
        lt(projectsTable.deletedAt, cutoff),
      ),
    );

  let purged = 0;
  for (const row of expired) {
    try {
      await logAuditEvent({
        actorUserId: null,
        actorRoleSnapshot: "system",
        action: "project.purged",
        resourceKind: "project",
        resourceId: row.id,
        before: { title: row.title },
        after: null,
        reason: `Auto-purged after ${RETENTION_DAYS} days in trash.`,
      });
      await db.transaction(async (tx) => {
        await tx
          .delete(projectApplications)
          .where(eq(projectApplications.projectId, row.id));
        await tx
          .delete(projectMilestones)
          .where(eq(projectMilestones.projectId, row.id));
        await tx.delete(projectsTable).where(eq(projectsTable.id, row.id));
      });
      purged += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[trash] purge failed for ${row.id}`, err);
    }
  }

  return { purged };
}
