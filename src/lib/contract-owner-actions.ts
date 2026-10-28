/**
 * Set who owns a contract, without editing the contract.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A SEPARATE ACTION (2026-10-28)
 *
 * editProject already writes adminUserIds, but it writes everything
 * else at the same time: title, brief, budget, skills, industry. To
 * add two names to a deal you had to load the whole edit form and
 * post the whole project back.
 *
 * That is fine as an edit screen and wrong as a closeout step. The
 * contract hub needs to fix the one field that blocks settlement,
 * inline, without putting the rest of the record through a round trip
 * where a stale form could quietly overwrite something.
 *
 * So this does one thing. Same guard, same audit, one column.
 *
 * WHY IT MATTERS AT ALL
 *
 * The 12% operations pool is allocated at settlement from this list.
 * An empty list means that share has no recipient and the splits are
 * written anyway, so the money question is decided by whether anyone
 * remembered to set a field on a different page.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export async function setContractOwners(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Which contract?");

  const before = await getProjectById(projectId);
  if (!before) throw new Error("Contract not found.");

  // Only read when the form carried the marker, so a surface without
  // the control cannot blank the owners by omission. Present with
  // nothing ticked is a real choice and does clear them.
  if (formData.get("adminUserIdsPresent") === null) return;

  const adminUserIds = formData
    .getAll("adminUserIds")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const same =
    adminUserIds.length === (before.adminUserIds ?? []).length &&
    adminUserIds.every((id) => (before.adminUserIds ?? []).includes(id));
  if (same) return;

  const now = new Date().toISOString();
  await db
    .update(projects)
    .set({ adminUserIds, updatedAt: now })
    .where(eq(projects.id, projectId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "project.owners_changed",
    resourceKind: "project",
    resourceId: projectId,
    before: { adminUserIds: before.adminUserIds ?? [] },
    after: { adminUserIds },
    reason: `Set the admin owners on ${before.title}`,
  });

  revalidatePath(`/admin/contracts/${projectId}`);
  revalidatePath(`/admin/contracts/${projectId}/settle`);
  revalidatePath("/admin/contracts");
}
