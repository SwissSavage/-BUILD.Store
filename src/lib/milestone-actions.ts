/**
 * Project milestone lifecycle server actions.
 *
 * Three caller surfaces:
 *   - Admin PM view (/admin/contracts/[id]/tracker): full CRUD plus the
 *     manual deadline sweep button.
 *   - Talent project page (/projects/[id]): owners can flip status and
 *     flag blockers on their own milestones.
 *   - Public client tracker (/contracts/[id]/tracker?token=...): read
 *     only; no actions wired.
 *
 * Notification fan-out:
 *   - status_changed → admins on the project + the owner (skip if actor
 *     is the recipient).
 *   - blocked → admins on the project, with the blocker note in body.
 *   - due_soon (sweep) → owner. Debounced by lastDueSoonNoticeAt.
 *   - overdue (sweep) → admins. Debounced by lastOverdueNoticeAt.
 *
 * REPLACE WITH: Drizzle inserts/updates against `project_milestones`. In
 * production, the sweep runs as a daily Vercel/Fly cron rather than an
 * admin button; the action body stays the same.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_PROJECT_MILESTONES,
  milestonesForProject,
} from "@/lib/mock-data/project-milestones";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  MILESTONE_DUE_SOON_DAYS,
  type MilestoneStatus,
  type Notification,
  type ProjectMilestone,
} from "@/lib/types";

const MILESTONE_STATUSES: ReadonlyArray<MilestoneStatus> = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
];

function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_ms_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function fanOut(
  userIds: string[],
  partial: Omit<Notification, "id" | "createdAt" | "readAt" | "userId">,
): void {
  for (const uid of new Set(userIds)) {
    pushNotification({ ...partial, userId: uid });
  }
}

function parseDueAt(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "").trim();
  if (!v) throw new Error("Due date is required");
  // Accept YYYY-MM-DD or ISO. Normalize to UTC noon ISO.
  const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) throw new Error("Due date is invalid");
  return d.toISOString();
}

function nextSequence(projectId: string): number {
  const existing = milestonesForProject(projectId);
  if (existing.length === 0) return 10;
  return existing[existing.length - 1].sequence + 10;
}

function newId(): string {
  return `ms_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function projectAdminUserIds(projectId: string): string[] {
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) return [];
  return [...project.adminUserIds];
}

/* ------------------------------------------------------------------ */
/*  Admin actions                                                      */
/* ------------------------------------------------------------------ */

export async function createMilestone(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");

  const title = String(formData.get("title") ?? "").trim();
  if (title.length === 0) throw new Error("Title is required");
  const description = String(formData.get("description") ?? "").trim() || null;
  const ownerUserId = String(formData.get("ownerUserId") ?? "");
  if (!MOCK_USERS.find((u) => u.id === ownerUserId)) {
    throw new Error("Owner not found");
  }
  const dueAt = parseDueAt(formData.get("dueAt"));
  const now = new Date().toISOString();

  const row: ProjectMilestone = {
    id: newId(),
    projectId,
    sequence: nextSequence(projectId),
    title,
    description,
    ownerUserId,
    dueAt,
    status: "not_started",
    blockerNote: null,
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_PROJECT_MILESTONES.push(row);

  pushNotification({
    userId: ownerUserId,
    kind: "milestone_status_changed",
    title: `New milestone on ${project.title}`,
    body: `You have a new milestone: "${title}". Due ${dueAt.slice(0, 10)}.`,
    href: `/projects/${projectId}`,
  });

  revalidatePath(`/admin/contracts/${projectId}/tracker`);
  revalidatePath(`/contracts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMilestone(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const idx = MOCK_PROJECT_MILESTONES.findIndex((m) => m.id === id);
  if (idx === -1) return;
  const projectId = MOCK_PROJECT_MILESTONES[idx].projectId;
  MOCK_PROJECT_MILESTONES.splice(idx, 1);
  revalidatePath(`/admin/contracts/${projectId}/tracker`);
  revalidatePath(`/contracts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function pingMilestoneOwner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = MOCK_PROJECT_MILESTONES.find((m) => m.id === id);
  if (!row) throw new Error("Milestone not found");
  const project = MOCK_PROJECTS.find((p) => p.id === row.projectId);
  if (!project) throw new Error("Project not found");

  const daysOut = Math.ceil(
    (new Date(row.dueAt).getTime() - Date.now()) / 86_400_000,
  );
  const dueCopy =
    daysOut > 0
      ? `Due in ${daysOut} day${daysOut === 1 ? "" : "s"}.`
      : daysOut === 0
        ? "Due today."
        : `Overdue by ${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? "" : "s"}.`;

  pushNotification({
    userId: row.ownerUserId,
    kind: "milestone_due_soon",
    title: `Ping: ${row.title}`,
    body: `Admin nudge on "${row.title}" (${project.title}). ${dueCopy}`,
    href: `/projects/${row.projectId}`,
  });
  row.lastDueSoonNoticeAt = new Date().toISOString();
  row.updatedAt = row.lastDueSoonNoticeAt;
  revalidatePath(`/admin/contracts/${row.projectId}/tracker`);
}

export async function resolveBlocker(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = MOCK_PROJECT_MILESTONES.find((m) => m.id === id);
  if (!row) throw new Error("Milestone not found");
  if (row.status !== "blocked") return;
  row.status = "in_progress";
  row.blockerNote = null;
  row.updatedAt = new Date().toISOString();

  pushNotification({
    userId: row.ownerUserId,
    kind: "milestone_status_changed",
    title: `Blocker cleared on "${row.title}"`,
    body: "An admin marked the blocker resolved. Back to in-progress.",
    href: `/projects/${row.projectId}`,
  });

  revalidatePath(`/admin/contracts/${row.projectId}/tracker`);
  revalidatePath(`/projects/${row.projectId}`);
}

/**
 * Admin sweep: scans every milestone, fires `milestone_due_soon` for
 * owners on rows due within MILESTONE_DUE_SOON_DAYS that haven't been
 * notified in the last 24 hours, and fans `milestone_overdue` to project
 * admins for past-due rows that haven't been notified in the last 24
 * hours. Debounced via the lastDueSoon / lastOverdue timestamps.
 *
 * In production this runs on a daily cron; the action body is identical.
 */
export async function sweepDeadlines() {
  await requireAdmin();
  const now = Date.now();
  const dueSoonMs = MILESTONE_DUE_SOON_DAYS * 86_400_000;
  const debounceMs = 24 * 60 * 60 * 1000;

  for (const row of MOCK_PROJECT_MILESTONES) {
    if (row.status === "completed") continue;
    const dueMs = new Date(row.dueAt).getTime();
    const project = MOCK_PROJECTS.find((p) => p.id === row.projectId);
    if (!project) continue;

    if (dueMs < now) {
      const last = row.lastOverdueNoticeAt
        ? new Date(row.lastOverdueNoticeAt).getTime()
        : 0;
      if (now - last < debounceMs) continue;
      const daysOver = Math.ceil((now - dueMs) / 86_400_000);
      fanOut(projectAdminUserIds(row.projectId), {
        kind: "milestone_overdue",
        title: `Overdue: ${row.title}`,
        body: `${project.title}. ${daysOver} day${daysOver === 1 ? "" : "s"} past due. Owner: ${ownerName(row.ownerUserId)}.`,
        href: `/admin/contracts/${row.projectId}/tracker`,
      });
      row.lastOverdueNoticeAt = new Date(now).toISOString();
      row.updatedAt = row.lastOverdueNoticeAt;
    } else if (dueMs - now <= dueSoonMs) {
      const last = row.lastDueSoonNoticeAt
        ? new Date(row.lastDueSoonNoticeAt).getTime()
        : 0;
      if (now - last < debounceMs) continue;
      const daysOut = Math.ceil((dueMs - now) / 86_400_000);
      pushNotification({
        userId: row.ownerUserId,
        kind: "milestone_due_soon",
        title: `Due soon: ${row.title}`,
        body: `${project.title}. Due in ${daysOut} day${daysOut === 1 ? "" : "s"}.`,
        href: `/projects/${row.projectId}`,
      });
      row.lastDueSoonNoticeAt = new Date(now).toISOString();
      row.updatedAt = row.lastDueSoonNoticeAt;
    }
  }

  revalidatePath("/admin");
}

function ownerName(userId: string): string {
  const u = MOCK_USERS.find((x) => x.id === userId);
  if (!u) return userId;
  return u.firstName ?? u.handle;
}

/* ------------------------------------------------------------------ */
/*  Owner / talent actions                                             */
/* ------------------------------------------------------------------ */

export async function updateMilestoneStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "");
  const row = MOCK_PROJECT_MILESTONES.find((m) => m.id === id);
  if (!row) throw new Error("Milestone not found");

  const isOwner = row.ownerUserId === user.id;
  if (!isOwner && !user.isAdmin) {
    throw new Error("Only the milestone owner or an admin can change status");
  }

  const next = String(formData.get("status") ?? "") as MilestoneStatus;
  if (!(MILESTONE_STATUSES as ReadonlyArray<string>).includes(next)) {
    throw new Error("Invalid status");
  }

  const project = MOCK_PROJECTS.find((p) => p.id === row.projectId);
  if (!project) throw new Error("Project not found");

  const prev = row.status;
  if (prev === next) return;

  row.status = next;
  row.updatedAt = new Date().toISOString();
  if (next === "completed") {
    row.completedAt = row.updatedAt;
    row.blockerNote = null;
  } else if (next === "blocked") {
    row.blockerNote =
      String(formData.get("blockerNote") ?? "").trim() ||
      "Owner flagged a blocker. Awaiting admin follow-up.";
  } else if (prev === "blocked") {
    row.blockerNote = null;
  }
  if (next !== "completed" && prev === "completed") {
    row.completedAt = null;
  }

  // Fan-out: notify project admins + the owner if the actor differs.
  const recipients = projectAdminUserIds(row.projectId);
  if (row.ownerUserId !== user.id) recipients.push(row.ownerUserId);

  fanOut(recipients, {
    kind: next === "blocked" ? "milestone_blocked" : "milestone_status_changed",
    title:
      next === "blocked"
        ? `Blocker flagged: ${row.title}`
        : `${row.title}: ${next.replace("_", " ")}`,
    body:
      next === "blocked"
        ? `${project.title} — ${row.blockerNote}`
        : `${project.title}. ${ownerName(user.id)} moved this from ${prev.replace("_", " ")} to ${next.replace("_", " ")}.`,
    href: `/projects/${row.projectId}`,
  });

  revalidatePath(`/admin/contracts/${row.projectId}/tracker`);
  revalidatePath(`/contracts/${row.projectId}`);
  revalidatePath(`/projects/${row.projectId}`);
}
