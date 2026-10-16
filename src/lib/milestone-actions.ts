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

import {
  fanOut,
  newId,
  nextSequence,
  ownerName,
  parseDueAt,
  projectAdminUserIds,
  pushNotification,
  runMilestoneSweep,
} from "@/lib/milestone-core";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMilestones } from "@/db/schema";
import { getAllProjects, getProjectById } from "@/lib/readers/projects";
import { getMilestonesForProject, milestoneReader } from "@/lib/readers";
import { getUserById } from "@/lib/readers/users";
import {
  MILESTONE_DUE_SOON_DAYS,
  type MilestoneStatus,
  type Notification,
  type NotificationKind,
  type ProjectMilestone,
} from "@/lib/types";

const MILESTONE_STATUSES: ReadonlyArray<MilestoneStatus> = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
];

/* ------------------------------------------------------------------ */
/*  Admin actions                                                      */
/* ------------------------------------------------------------------ */

export async function createMilestone(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const title = String(formData.get("title") ?? "").trim();
  if (title.length === 0) throw new Error("Title is required");
  const description = String(formData.get("description") ?? "").trim() || null;
  const ownerUserId = String(formData.get("ownerUserId") ?? "");
  // Real lookup. The fixture scan here threw "Owner not found" for
  // every member who signed up through the live flow, so a milestone
  // could only be assigned to a seed profile.
  if (!(await getUserById(ownerUserId))) {
    throw new Error("Owner not found");
  }
  const dueAt = parseDueAt(formData.get("dueAt"));
  const now = new Date().toISOString();

  const row: ProjectMilestone = {
    id: newId(),
    projectId,
    sequence: await nextSequence(projectId),
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
  // Writer swap 2026-08-28: was in-memory, so milestones vanished
  // from the client tracker on the next deploy.
  await db.insert(projectMilestones).values(row);

  await pushNotification({
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

/**
 * Task #46 — seed a fresh project with a standard 5-milestone
 * template so admin can iterate from a starting point rather than an
 * empty screen. Only fires when the project has zero milestones (no
 * clobber risk). Assigns every milestone to the first admin on the
 * project's roster; admin re-owner-assigns per milestone after seed.
 */
export async function seedProjectWithTemplate(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");

  const existing = await getMilestonesForProject(projectId);
  if (existing.length > 0) {
    throw new Error(
      "Project already has milestones. Seed only runs on empty trackers.",
    );
  }

  const defaultOwner =
    project.adminUserIds[0] ??
    project.assignedMemberIds[0];
  if (!defaultOwner) {
    throw new Error(
      "Project has no admin or assigned member. Assign someone before seeding.",
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  // Standard 5-milestone template — kickoff, discovery, build, review,
  // handoff. Weekly cadence gives clients a concrete rhythm; admin
  // adjusts dates + owners after seed. Order matters (sequence = i * 10).
  const template = [
    { title: "Kickoff + scope confirmation", offsetDays: 7 },
    { title: "Discovery + planning complete", offsetDays: 14 },
    { title: "Build in progress + first review", offsetDays: 28 },
    { title: "Client review + revisions", offsetDays: 42 },
    { title: "Delivery + handoff", offsetDays: 56 },
  ];

  for (let i = 0; i < template.length; i++) {
    const t = template[i];
    const due = new Date(now.getTime() + t.offsetDays * 24 * 60 * 60 * 1000);
    const row: ProjectMilestone = {
      id: newId(),
      projectId,
      sequence: (i + 1) * 10,
      title: t.title,
      description: null,
      ownerUserId: defaultOwner,
      dueAt: due.toISOString(),
      status: "not_started",
      blockerNote: null,
      completedAt: null,
      lastDueSoonNoticeAt: null,
      lastOverdueNoticeAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await db.insert(projectMilestones).values(row);
  }

  revalidatePath(`/admin/contracts/${projectId}/tracker`);
  revalidatePath(`/contracts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMilestone(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const existing = await milestoneReader.byId(id);
  if (!existing) return;
  const projectId = existing.projectId;
  await db.delete(projectMilestones).where(eq(projectMilestones.id, id));
  revalidatePath(`/admin/contracts/${projectId}/tracker`);
  revalidatePath(`/contracts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function pingMilestoneOwner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = await milestoneReader.byId(id);
  if (!row) throw new Error("Milestone not found");
  const project = await getProjectById(row.projectId);
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

  await pushNotification({
    userId: row.ownerUserId,
    kind: "milestone_due_soon",
    title: `Ping: ${row.title}`,
    body: `Admin nudge on "${row.title}" (${project.title}). ${dueCopy}`,
    href: `/projects/${row.projectId}`,
  });
  row.lastDueSoonNoticeAt = new Date().toISOString();
  await db
    .update(projectMilestones)
    .set({ lastDueSoonNoticeAt: row.lastDueSoonNoticeAt })
    .where(eq(projectMilestones.id, row.id));
  row.updatedAt = row.lastDueSoonNoticeAt;
  revalidatePath(`/admin/contracts/${row.projectId}/tracker`);
}

export async function resolveBlocker(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = await milestoneReader.byId(id);
  if (!row) throw new Error("Milestone not found");
  if (row.status !== "blocked") return;
  const resolvedAt = new Date().toISOString();
  await db
    .update(projectMilestones)
    .set({ status: "in_progress", blockerNote: null, updatedAt: resolvedAt })
    .where(eq(projectMilestones.id, id));
  row.status = "in_progress";
  row.blockerNote = null;
  row.updatedAt = resolvedAt;

  await pushNotification({
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
 * Admin sweep: scans every milestone, fires escalating pre-due pings
 * (7d → 3d → 1d → day-of) for owners, and fans `milestone_overdue`
 * to project admins for past-due rows.
 *
 * Escalation logic: each bucket is more urgent than the last. When
 * the milestone crosses into a more-urgent bucket, we fire a fresh
 * ping regardless of when the last one went out. The bucket is
 * encoded in `lastDueSoonNoticeAt` via a short suffix so we don't
 * need a schema migration for the tracking field — YYYY-MM-DDTHH
 * format with a "|bucket" suffix. Real Drizzle swap adds a proper
 * `last_notice_bucket` column.
 *
 * In production this runs on a daily cron via
 * /api/cron/sweep-milestones; the action body stays the same.
 */
export async function sweepDeadlines() {
  // The only authorisation this path needs. runMilestoneSweep lives
  // in milestone-core.ts, which is not a "use server" module and so
  // is not reachable by POST — it checks nothing itself, because
  // nothing can reach it without coming through a caller like this
  // one. Before 2026-10-16 it demanded a cron secret instead, which
  // an admin has no way to hold, so this button threw on every click.
  await requireAdmin();
  await runMilestoneSweep();
  revalidatePath("/admin");
  revalidatePath("/admin/contracts");
}


/* ------------------------------------------------------------------ */
/*  Owner / talent actions                                             */
/* ------------------------------------------------------------------ */

export async function updateMilestoneStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "");
  const row = await milestoneReader.byId(id);
  if (!row) throw new Error("Milestone not found");

  const isOwner = row.ownerUserId === user.id;
  if (!isOwner && !user.isAdmin) {
    throw new Error("Only the milestone owner or an admin can change status");
  }

  const next = String(formData.get("status") ?? "") as MilestoneStatus;
  if (!(MILESTONE_STATUSES as ReadonlyArray<string>).includes(next)) {
    throw new Error("Invalid status");
  }

  const project = await getProjectById(row.projectId);
  if (!project) throw new Error("Project not found");

  const prev = row.status;
  if (prev === next) return;

  // Writer swap 2026-08-28: these were plain property assignments on
  // an in-memory object, so a contributor marking a milestone complete
  // saw it flip and then silently revert.
  const updatedAt = new Date().toISOString();
  let completedAt = row.completedAt;
  let blockerNote = row.blockerNote;

  if (next === "completed") {
    completedAt = updatedAt;
    blockerNote = null;
  } else if (next === "blocked") {
    blockerNote =
      String(formData.get("blockerNote") ?? "").trim() ||
      "Owner flagged a blocker. Awaiting admin follow-up.";
  } else if (prev === "blocked") {
    blockerNote = null;
  }
  if (next !== "completed" && prev === "completed") {
    completedAt = null;
  }

  await db
    .update(projectMilestones)
    .set({ status: next, completedAt, blockerNote, updatedAt })
    .where(eq(projectMilestones.id, id));

  // Keep the local object consistent for the notification copy below.
  row.status = next;
  row.updatedAt = updatedAt;
  row.completedAt = completedAt;
  row.blockerNote = blockerNote;

  // Fan-out: notify project admins + the owner if the actor differs.
  const recipients = await projectAdminUserIds(row.projectId);
  if (row.ownerUserId !== user.id) recipients.push(row.ownerUserId);

  await fanOut(recipients, {
    kind: next === "blocked" ? "milestone_blocked" : "milestone_status_changed",
    title:
      next === "blocked"
        ? `Blocker flagged: ${row.title}`
        : `${row.title}: ${next.replace("_", " ")}`,
    body:
      next === "blocked"
        ? `${project.title} — ${row.blockerNote}`
        : `${project.title}. ${await ownerName(user.id)} moved this from ${prev.replace("_", " ")} to ${next.replace("_", " ")}.`,
    href: `/projects/${row.projectId}`,
  });

  revalidatePath(`/admin/contracts/${row.projectId}/tracker`);
  revalidatePath(`/contracts/${row.projectId}`);
  revalidatePath(`/projects/${row.projectId}`);
}
