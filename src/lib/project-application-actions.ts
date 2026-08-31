/**
 * Project application server actions (Phase 2.5 sandbox).
 *
 *   - applyToProject       → member submits an application + fans out a
 *                             notification to every admin
 *   - decideProjectApplication
 *                          → admin approve/reject; on approve, the user
 *                             is added to the project's assignedMemberIds
 *                             and the row's status flips. Either path
 *                             notifies the applicant.
 *   - withdrawProjectApplication
 *                          → applicant pulls a still-pending request
 *
 * All gating is on the SESSION user, not the form payload — a member
 * can never decide on someone else's application or withdraw a row
 * they don't own. Same shape the production Drizzle-backed handlers
 * will take.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";

import { notify } from "@/lib/writers/notifications";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projectApplications,
  projects as projectsTable,
} from "@/db/schema";
import { getProjectById } from "@/lib/readers/projects";
import {
  findPendingApplication,
  getApplicationById,
} from "@/lib/readers/project-applications";
import { getAdminUsers } from "@/lib/readers/users";
import { publicName } from "@/lib/types";
import type { Notification, ProjectApplication } from "@/lib/types";

/**
 * Create a notification. Writes to Postgres via the shared writer.
 * real DB insert per recipient; here it just keeps the in-memory array
 * coherent so the inbox surface re-renders with the new row.
 */
async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was appending to MOCK_NOTIFICATIONS, so every bid notification
  // died with the container process.
  await notify(partial);
}

/** Every platform admin's userId. Drives the apply-fan-out recipient list. */
async function adminUserIds(): Promise<string[]> {
  const { users } = await getAdminUsers();
  return users.map((u) => u.id);
}

export async function applyToProject(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const projectId = String(formData.get("projectId") ?? "");
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const hoursRaw = String(formData.get("hoursPerWeek") ?? "0");
  const portfolioRaw = String(formData.get("portfolioLink") ?? "").trim();

  // Reader swap 2026-08-28: was MOCK_PROJECTS, which meant a bid on a
  // real (Postgres-created) project threw "Project not found".
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  if (project.kind !== "internal") {
    throw new Error("Apply is for internal cooperative projects only");
  }
  if (project.status !== "open" && project.status !== "in_progress") {
    throw new Error("Project is not accepting applicants");
  }
  if (project.assignedMemberIds.includes(user.id)) {
    throw new Error("You're already on this project");
  }

  // Block double-applies — one pending row at a time. Reapplies after a
  // rejection / withdraw are fine (a fresh row is created).
  const existingPending = await findPendingApplication(projectId, user.id);
  if (existingPending) {
    throw new Error("You already have a pending application on this project");
  }

  if (proposedRole.length === 0 || pitch.length === 0) {
    throw new Error("Role and pitch are required");
  }

  const hoursPerWeek = Math.max(0, Math.min(60, Number(hoursRaw) || 0));
  const portfolioLink = portfolioRaw.length > 0 ? portfolioRaw : null;

  const id = `pa_${Date.now().toString(36)}`;
  const application: ProjectApplication = {
    id,
    projectId,
    userId: user.id,
    proposedRole,
    pitch,
    hoursPerWeek,
    portfolioLink,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    withdrawnAt: null,
    createdAt: new Date().toISOString(),
  };
  // Writer swap 2026-08-28: was an in-memory push, so submitted bids
  // disappeared on the next deploy and never reached the admin queue.
  //
  // The catch that used to wrap this fell back to the array on any
  // database error, which turned a failed bid into a successful-
  // looking one. A member who can't bid needs to know that.
  await db.insert(projectApplications).values({
    id: application.id,
    projectId: application.projectId,
    userId: application.userId,
    proposedRole: application.proposedRole,
    pitch: application.pitch,
    hoursPerWeek: application.hoursPerWeek,
    hourlyRate: null,
    portfolioLink: application.portfolioLink,
    status: application.status,
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    withdrawnAt: null,
    createdAt: application.createdAt,
  });


  // Fan out to every admin so the queue light flips immediately.
  const applicantLabel = publicName(user);
  for (const adminId of await adminUserIds()) {
    await pushNotification({
      userId: adminId,
      kind: "project_application",
      title: `New application — ${project.title}`,
      body: `${applicantLabel} pitched themselves for "${proposedRole}". Triage in /admin/projects/applications.`,
      href: "/admin/projects/applications",
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/admin/projects/applications");
  revalidatePath("/notifications");
}

export async function decideProjectApplication(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  if (!user.isAdmin) throw new Error("Admin access required");

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const app = await getApplicationById(id);
  if (!app) throw new Error("Application not found");
  if (app.status !== "pending") {
    throw new Error("Already decided");
  }
  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Unknown decision");
  }

  const project = await getProjectById(app.projectId);
  if (!project) throw new Error("Project not found");

  const now = new Date().toISOString();

  if (decision === "approve") {
    // Approval and crew assignment move together. An approved bid
    // without the member on assignedMemberIds means they're told
    // they're on the contract and every surface that lists the crew
    // disagrees — including the settlement engine, which pays from
    // that list.
    //
    // The status guard makes the whole thing idempotent: a second
    // click lands on zero rows and leaves the roster alone.
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(projectApplications)
        .set({
          status: "approved",
          reviewedBy: user.id,
          reviewedAt: now,
          adminNote: adminNote.length > 0 ? adminNote : null,
        })
        .where(
          and(
            eq(projectApplications.id, id),
            eq(projectApplications.status, "pending"),
          ),
        )
        .returning({ id: projectApplications.id });
      if (claimed.length === 0) return;

      if (!project.assignedMemberIds.includes(app.userId)) {
        await tx
          .update(projectsTable)
          .set({
            assignedMemberIds: [...project.assignedMemberIds, app.userId],
            updatedAt: now,
          })
          .where(eq(projectsTable.id, project.id));
      }
    });

    await pushNotification({
      userId: app.userId,
      kind: "project_application_decision",
      title: `You're on — ${project.title}`,
      body:
        adminNote.length > 0
          ? `Approved as "${app.proposedRole}". Note from admin: ${adminNote}`
          : `Approved as "${app.proposedRole}". Pick up the thread on the project page.`,
      href: `/projects/${project.id}`,
    });
  } else {
    await db
      .update(projectApplications)
      .set({
        status: "rejected",
        reviewedBy: user.id,
        reviewedAt: now,
        adminNote: adminNote.length > 0 ? adminNote : null,
      })
      .where(
        and(
          eq(projectApplications.id, id),
          eq(projectApplications.status, "pending"),
        ),
      );
    await pushNotification({
      userId: app.userId,
      kind: "project_application_decision",
      title: `Application update — ${project.title}`,
      body:
        adminNote.length > 0
          ? `Not this round. Note from admin: ${adminNote}`
          : `Not this round. The team's gone in another direction; keep your eye out for the next one.`,
      href: `/projects/${project.id}`,
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  revalidatePath("/admin/projects/applications");
  revalidatePath("/notifications");
}

export async function withdrawProjectApplication(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const id = String(formData.get("id") ?? "");
  const app = await getApplicationById(id);
  if (!app) throw new Error("Application not found");
  if (app.userId !== user.id) {
    throw new Error("You can only withdraw your own applications");
  }
  if (app.status !== "pending") {
    throw new Error("Only pending applications can be withdrawn");
  }

  // Scoped to this member's own pending row, so a withdraw racing an
  // admin decision can't undo a decision that already landed.
  await db
    .update(projectApplications)
    .set({ status: "withdrawn", withdrawnAt: new Date().toISOString() })
    .where(
      and(
        eq(projectApplications.id, id),
        eq(projectApplications.userId, user.id),
        eq(projectApplications.status, "pending"),
      ),
    );

  revalidatePath("/projects");
  revalidatePath(`/projects/${app.projectId}`);
  revalidatePath("/admin/projects/applications");

  // If form posted with a "next" target, follow it.
  const next = String(formData.get("next") ?? "");
  if (next) redirect(next);
}
