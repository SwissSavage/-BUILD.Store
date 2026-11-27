"use server";

/**
 * Assigning who did what on an engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-23)
 *
 * Jamar: "Reviews must reflect roles so people are not evaluated
 * outside of their scope. That needs manual adjustment with roles for
 * each project."
 *
 * Manual is the point. Who brought in the client, who directed the
 * work, who sent the money — none of that is derivable from the data
 * the app holds, and guessing it would put a confident label on an
 * assumption. Only somebody who was there can say.
 *
 * Optional too: "it doesn't need to be mandatory. Roles need to be
 * optional based on input and assigned." Nothing blocks on roles
 * being set. Where they exist the review form narrows; where they do
 * not, it asks everything and the reviewer skips.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT REPLACES RATHER THAN APPENDS
 *
 * The form posts the full set of roles for one person, so unticking a
 * box has to mean something. Deleting this person's rows on this
 * project and writing what was submitted is the only version where
 * the UI and the database agree about an empty set.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT IS AUDITED
 *
 * A role decides what somebody can be judged on. Narrowing one after
 * reviews are in changes the meaning of their record, so who changed
 * it and when is worth keeping.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { engagementRoles, projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import {
  CONTRIBUTOR_ROLES,
  ENGAGEMENT_ROLES,
  describeRoles,
} from "@/lib/engagement-roles";

export interface RoleAssignResult {
  ok: boolean;
  message: string;
}

// Both taxonomies. The six describe running an engagement, the two
// describe delivering it, and a person holds one kind or the other —
// enforced by which picker an admin is shown rather than here, since
// a contributor who later runs something is a real case.
const KNOWN = new Set([
  ...ENGAGEMENT_ROLES.map((r) => r.role),
  ...CONTRIBUTOR_ROLES.map((r) => r.role),
]);

export async function setEngagementRoles(
  formData: FormData,
): Promise<RoleAssignResult> {
  // Inlined rather than wrapped: check-server-action-auth looks for
  // the gate inside each exported function body.
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!projectId || !userId) {
    return { ok: false, message: "Missing engagement or person." };
  }

  const [project] = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };

  // Unknown values are dropped rather than refused. The checkbox
  // names come from ENGAGEMENT_ROLES, so anything else is a crafted
  // post, and the schema's CHECK would reject it anyway.
  const submitted = formData
    .getAll("roles")
    .map((v) => String(v))
    .filter((r) => KNOWN.has(r as never));
  const roles = Array.from(new Set(submitted));

  const before = await db
    .select({ role: engagementRoles.role })
    .from(engagementRoles)
    .where(
      and(
        eq(engagementRoles.projectId, projectId),
        eq(engagementRoles.userId, userId),
      ),
    );
  const previous = before.map((r) => r.role);

  // Replace, so unticking means something. See the header.
  await db
    .delete(engagementRoles)
    .where(
      and(
        eq(engagementRoles.projectId, projectId),
        eq(engagementRoles.userId, userId),
      ),
    );

  if (roles.length > 0) {
    await db.insert(engagementRoles).values(
      roles.map((role) => ({
        id: `erole_${randomUUID()}`,
        projectId,
        userId,
        role,
        assignedByUserId: admin.id,
      })),
    );
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "engagement.roles_set",
    resourceKind: "project",
    resourceId: projectId,
    before: { userId, roles: previous },
    after: { userId, roles },
    reason: `Roles on ${project.title}: ${describeRoles(roles)}.`,
  });

  revalidatePath(`/admin/contracts/${projectId}/reviews`);
  revalidatePath(`/projects/${projectId}`);

  return {
    ok: true,
    message:
      roles.length > 0
        ? `Saved: ${describeRoles(roles)}.`
        : "Cleared. They will be asked about everything, and can skip.",
  };
}
