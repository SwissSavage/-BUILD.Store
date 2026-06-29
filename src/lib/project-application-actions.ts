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
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_PROJECT_APPLICATIONS } from "@/lib/mock-data/project-applications";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { publicName } from "@/lib/types";
import type { Notification, ProjectApplication } from "@/lib/types";

/**
 * Push a new entry into MOCK_NOTIFICATIONS. In production this is a
 * real DB insert per recipient; here it just keeps the in-memory array
 * coherent so the inbox surface re-renders with the new row.
 */
function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_pa_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

/** Every platform admin's userId. Drives the apply-fan-out recipient list. */
function adminUserIds(): string[] {
  return MOCK_USERS.filter((u) => u.isAdmin).map((u) => u.id);
}

export async function applyToProject(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const projectId = String(formData.get("projectId") ?? "");
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const hoursRaw = String(formData.get("hoursPerWeek") ?? "0");
  const portfolioRaw = String(formData.get("portfolioLink") ?? "").trim();

  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
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
  const existingPending = MOCK_PROJECT_APPLICATIONS.find(
    (a) =>
      a.projectId === projectId &&
      a.userId === user.id &&
      a.status === "pending",
  );
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
  MOCK_PROJECT_APPLICATIONS.push(application);

  // Fan out to every admin so the queue light flips immediately.
  const applicantLabel = publicName(user);
  for (const adminId of adminUserIds()) {
    pushNotification({
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

  const app = MOCK_PROJECT_APPLICATIONS.find((a) => a.id === id);
  if (!app) throw new Error("Application not found");
  if (app.status !== "pending") {
    throw new Error("Already decided");
  }
  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Unknown decision");
  }

  const project = MOCK_PROJECTS.find((p) => p.id === app.projectId);
  if (!project) throw new Error("Project not found");

  const now = new Date().toISOString();
  app.reviewedBy = user.id;
  app.reviewedAt = now;
  app.adminNote = adminNote.length > 0 ? adminNote : null;

  if (decision === "approve") {
    app.status = "approved";
    if (!project.assignedMemberIds.includes(app.userId)) {
      project.assignedMemberIds = [...project.assignedMemberIds, app.userId];
    }
    project.updatedAt = now;
    pushNotification({
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
    app.status = "rejected";
    pushNotification({
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
  const app = MOCK_PROJECT_APPLICATIONS.find((a) => a.id === id);
  if (!app) throw new Error("Application not found");
  if (app.userId !== user.id) {
    throw new Error("You can only withdraw your own applications");
  }
  if (app.status !== "pending") {
    throw new Error("Only pending applications can be withdrawn");
  }

  app.status = "withdrawn";
  app.withdrawnAt = new Date().toISOString();

  revalidatePath("/projects");
  revalidatePath(`/projects/${app.projectId}`);
  revalidatePath("/admin/projects/applications");

  // If form posted with a "next" target, follow it.
  const next = String(formData.get("next") ?? "");
  if (next) redirect(next);
}
