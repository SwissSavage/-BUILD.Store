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

import { notify, notifyMany } from "@/lib/writers/notifications";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMilestones } from "@/db/schema";
import { getAllProjects, getProjectById } from "@/lib/readers/projects";
import { getMilestonesForProject, milestoneReader } from "@/lib/readers";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
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

async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was an in-memory push, so these notifications never survived a
  // deploy and the bell icon was effectively decorative.
  await notify(partial);
}

async function fanOut(
  userIds: string[],
  partial: Omit<Notification, "id" | "createdAt" | "readAt" | "userId">,
): Promise<void> {
  // Batched insert rather than N round-trips.
  await notifyMany(Array.from(new Set(userIds)), partial);
}

function parseDueAt(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "").trim();
  if (!v) throw new Error("Due date is required");
  // Accept YYYY-MM-DD or ISO. Normalize to UTC noon ISO.
  const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) throw new Error("Due date is invalid");
  return d.toISOString();
}

async function nextSequence(projectId: string): Promise<number> {
  const existing = await getMilestonesForProject(projectId);
  if (existing.length === 0) return 10;
  return Math.max(...existing.map((m) => m.sequence)) + 10;
}

function newId(): string {
  return `ms_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

async function projectAdminUserIds(projectId: string): Promise<string[]> {
  const project = await getProjectById(projectId);
  if (!project) return [];
  return [...project.adminUserIds];
}

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
  if (!MOCK_USERS.find((u) => u.id === ownerUserId)) {
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
 * Escalating urgency buckets for pre-due milestone pings (task #51).
 * The bucket enum encodes both the timing and the priority label —
 * more urgent buckets fire even if a less-urgent bucket already
 * pinged, so a milestone that was 7d out yesterday still gets a
 * fresh 3d ping today.
 *
 * Notification `kind` maps 1:1 so surface renderers can route by
 * urgency (bell red vs muted, sort order, digest inclusion, etc).
 */
type DueBucket = "day_of" | "one_day" | "three_days" | "seven_days";
const BUCKET_ORDER: DueBucket[] = [
  "seven_days",
  "three_days",
  "one_day",
  "day_of",
];
const BUCKET_MS: Record<DueBucket, number> = {
  seven_days: 7 * 86_400_000,
  three_days: 3 * 86_400_000,
  one_day: 1 * 86_400_000,
  day_of: 0,
};
const BUCKET_KIND: Record<DueBucket, NotificationKind> = {
  seven_days: "milestone_due_soon",
  three_days: "milestone_due_soon",
  one_day: "milestone_due_important",
  day_of: "milestone_due_urgent",
};
const BUCKET_LABEL: Record<DueBucket, string> = {
  seven_days: "Heads up",
  three_days: "Reminder",
  one_day: "Important",
  day_of: "Due today",
};

/** Returns the most urgent bucket the milestone currently qualifies
 *  for, or null if the due date is more than 7 days out. */
function currentBucket(dueMs: number, now: number): DueBucket | null {
  const remaining = dueMs - now;
  if (remaining < 0) return null;
  // Walk buckets from most urgent to least urgent.
  if (remaining <= BUCKET_MS.day_of + 86_400_000) return "day_of";
  if (remaining <= BUCKET_MS.one_day + 86_400_000) return "one_day";
  if (remaining <= BUCKET_MS.three_days) return "three_days";
  if (remaining <= BUCKET_MS.seven_days) return "seven_days";
  return null;
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
  await requireAdmin();
  await runMilestoneSweep();
  revalidatePath("/admin");
}

/**
 * Cron-friendly body — no auth check, no revalidate. Called by
 * requireAdmin-gated sweepDeadlines above AND by the cron route
 * (/api/cron/sweep-milestones) which does its own shared-secret
 * auth. Split so the cron doesn't need an admin session.
 *
 * Async signature satisfies the "use server" module contract even
 * though the current body runs synchronously against MOCK data —
 * the real Drizzle swap will introduce awaited queries.
 */
export async function runMilestoneSweep(): Promise<{
  preDuePings: number;
  overduePings: number;
  scanned: number;
}> {
  const now = Date.now();
  const debounceMs = 20 * 60 * 60 * 1000; // 20h — avoids double-fire on same day
  let preDuePings = 0;
  let overduePings = 0;
  let scanned = 0;

  // Reader swap 2026-08-28: sweep now walks live rows, so a cron run
  // actually sees the milestones members created.
  const sweepRows = await milestoneReader.all();

  for (const row of sweepRows) {
    if (row.status === "completed") continue;
    scanned += 1;
    const dueMs = new Date(row.dueAt).getTime();
    const project = await getProjectById(row.projectId);
    if (!project) continue;

    // Overdue path — daily admin escalation until resolved.
    if (dueMs < now) {
      const last = row.lastOverdueNoticeAt
        ? new Date(row.lastOverdueNoticeAt).getTime()
        : 0;
      if (now - last < debounceMs) continue;
      const daysOver = Math.ceil((now - dueMs) / 86_400_000);
      await fanOut(await projectAdminUserIds(row.projectId), {
        kind: "milestone_overdue",
        title: `Overdue: ${row.title}`,
        body: `${project.title}. ${daysOver} day${daysOver === 1 ? "" : "s"} past due. Owner: ${ownerName(row.ownerUserId)}.`,
        href: `/admin/contracts/${row.projectId}/tracker`,
      });
      row.lastOverdueNoticeAt = new Date(now).toISOString();
      await db
        .update(projectMilestones)
        .set({ lastOverdueNoticeAt: row.lastOverdueNoticeAt })
        .where(eq(projectMilestones.id, row.id));
      row.updatedAt = row.lastOverdueNoticeAt;
      overduePings += 1;
      continue;
    }

    // Pre-due escalation path. Fires when the milestone enters a
    // more-urgent bucket than the last ping. Same bucket + inside
    // debounce = skip.
    const bucket = currentBucket(dueMs, now);
    if (!bucket) continue;

    const raw = row.lastDueSoonNoticeAt ?? "";
    const [lastIso, lastBucket] = raw.includes("|")
      ? raw.split("|")
      : [raw, ""];
    const lastMs = lastIso ? new Date(lastIso).getTime() : 0;
    const bucketIndex = BUCKET_ORDER.indexOf(bucket);
    const lastBucketIndex = lastBucket
      ? BUCKET_ORDER.indexOf(lastBucket as DueBucket)
      : -1;

    const escalated = bucketIndex > lastBucketIndex;
    const debounced = now - lastMs < debounceMs;
    if (!escalated && debounced) continue;

    const daysOut = Math.max(0, Math.ceil((dueMs - now) / 86_400_000));
    const timing =
      bucket === "day_of"
        ? "Due today"
        : bucket === "one_day"
          ? "Due tomorrow"
          : `Due in ${daysOut} day${daysOut === 1 ? "" : "s"}`;

    await pushNotification({
      userId: row.ownerUserId,
      kind: BUCKET_KIND[bucket],
      title: `${BUCKET_LABEL[bucket]}: ${row.title}`,
      body: `${project.title}. ${timing}.`,
      href: `/projects/${row.projectId}`,
    });
    row.lastDueSoonNoticeAt = `${new Date(now).toISOString()}|${bucket}`;
    await db
      .update(projectMilestones)
      .set({ lastDueSoonNoticeAt: row.lastDueSoonNoticeAt })
      .where(eq(projectMilestones.id, row.id));
    row.updatedAt = new Date(now).toISOString();
    preDuePings += 1;
  }

  return { preDuePings, overduePings, scanned };
}

/**
 * Weekly rollup — Monday project digest. For each active project,
 * emails/pings the assigned members + admins a summary of what's
 * due this week, what slipped last week, and next milestones. Runs
 * as part of the same cron entry point but only fires when today
 * is a Monday.
 */
export async function runWeeklyProjectRollup(): Promise<{
  digestsSent: number;
}> {
  const now = new Date();
  if (now.getUTCDay() !== 1) return { digestsSent: 0 }; // Monday = 1

  const nowMs = now.getTime();
  const weekFromNowMs = nowMs + 7 * 86_400_000;
  const weekAgoMs = nowMs - 7 * 86_400_000;
  let digestsSent = 0;

  const { projects: allProjects } = await getAllProjects();
  const allMilestones = await milestoneReader.all();

  for (const project of allProjects) {
    if (project.status !== "in_progress") continue;
    const milestones = allMilestones.filter(
      (m) => m.projectId === project.id,
    );
    if (milestones.length === 0) continue;

    const dueThisWeek = milestones.filter((m) => {
      if (m.status === "completed") return false;
      const d = new Date(m.dueAt).getTime();
      return d >= nowMs && d <= weekFromNowMs;
    });
    const slippedLastWeek = milestones.filter((m) => {
      if (m.status === "completed") return false;
      const d = new Date(m.dueAt).getTime();
      return d < nowMs && d >= weekAgoMs;
    });
    if (dueThisWeek.length === 0 && slippedLastWeek.length === 0) continue;

    const dueLine =
      dueThisWeek.length > 0
        ? `${dueThisWeek.length} due this week: ${dueThisWeek.map((m) => m.title).slice(0, 3).join(", ")}${dueThisWeek.length > 3 ? "…" : ""}.`
        : "";
    const slippedLine =
      slippedLastWeek.length > 0
        ? ` ${slippedLastWeek.length} slipped from last week.`
        : "";

    const recipients = [
      ...(project.assignedMemberIds ?? []),
      ...(await projectAdminUserIds(project.id)),
    ];
    await fanOut(recipients, {
      kind: "project_weekly_rollup",
      title: `Weekly rollup — ${project.title}`,
      body: `${dueLine}${slippedLine}`.trim(),
      href: `/projects/${project.id}`,
    });
    digestsSent += 1;
  }

  return { digestsSent };
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
        : `${project.title}. ${ownerName(user.id)} moved this from ${prev.replace("_", " ")} to ${next.replace("_", " ")}.`,
    href: `/projects/${row.projectId}`,
  });

  revalidatePath(`/admin/contracts/${row.projectId}/tracker`);
  revalidatePath(`/contracts/${row.projectId}`);
  revalidatePath(`/projects/${row.projectId}`);
}
