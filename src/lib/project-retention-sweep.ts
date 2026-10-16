/**
 * Trash retention sweep — clears projects past the restore window.
 *
 * Deliberately NOT a "use server" module. Moved out of
 * project-trash-actions.ts on 2026-10-16 so that it stops being a
 * public POST endpoint with a content-hashed id.
 *
 * A CRON_SECRET check used to sit at the top of this function. It
 * closed the exposure and broke the admin path in the same move,
 * because an admin has no way to hold a cron secret. The exposure
 * came from the file, so the fix is the file. Authorisation belongs
 * to the callers, each of which already holds a real credential:
 * the cron route checks a constant-time bearer token, and any admin
 * entry point checks requireAdmin().
 */
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projectApplications,
  projectMilestones,
  projects as projectsTable,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/writers/audit-log";
import { RETENTION_DAYS } from "@/lib/trash-retention";

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

