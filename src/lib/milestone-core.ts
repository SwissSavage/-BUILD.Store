/**
 * Milestone sweeps and the helpers they share — deliberately NOT a
 * "use server" module.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-16)
 *
 * These four functions used to live in milestone-actions.ts, which
 * carries a module-level "use server". That made every one of them a
 * public POST endpoint with a content-hashed id, so anyone holding an
 * action id could fire every pending milestone ping and weekly digest,
 * repeatedly, at whatever rate they liked.
 *
 * The first fix (2026-10-07) added a CRON_SECRET check inside each
 * sweep. It closed the hole and opened a smaller one: `sweepDeadlines`
 * checks requireAdmin() and then calls `runMilestoneSweep()` with no
 * argument, so the guard saw an undefined secret and threw. The admin
 * "Run sweep" button had not worked since. Jamar found it by clicking
 * it.
 *
 * A runtime check was the wrong tool. The exposure came from the file
 * these functions were sitting in, so the fix is to move them out of
 * it. Nothing here is reachable by POST. Authorisation belongs to the
 * callers, each of which already has a real credential:
 *
 *   /api/cron/sweep-milestones  — constant-time CRON_SECRET bearer
 *   sweepDeadlines()            — requireAdmin()
 *
 * This is the shape agreement-renewal-actions, fraud-scan and
 * writers/mvp-score were already in; the milestone sweeps were the
 * odd ones out. Same split as inbound-reconcile.ts.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMilestones } from "@/db/schema";
import { notify, notifyMany } from "@/lib/writers/notifications";
import { getAllProjects, getProjectById } from "@/lib/readers/projects";
import { getMilestonesForProject, milestoneReader } from "@/lib/readers";
import { getUserById } from "@/lib/readers/users";
import {
  MILESTONE_DUE_SOON_DAYS,
  type Notification,
  type NotificationKind,
  type ProjectMilestone,
} from "@/lib/types";

export async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was an in-memory push, so these notifications never survived a
  // deploy and the bell icon was effectively decorative.
  await notify(partial);
}

export async function fanOut(
  userIds: string[],
  partial: Omit<Notification, "id" | "createdAt" | "readAt" | "userId">,
): Promise<void> {
  // Batched insert rather than N round-trips.
  await notifyMany(Array.from(new Set(userIds)), partial);
}

export function parseDueAt(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "").trim();
  if (!v) throw new Error("Due date is required");
  // Accept YYYY-MM-DD or ISO. Normalize to UTC noon ISO.
  const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) throw new Error("Due date is invalid");
  return d.toISOString();
}

export async function nextSequence(projectId: string): Promise<number> {
  const existing = await getMilestonesForProject(projectId);
  if (existing.length === 0) return 10;
  return Math.max(...existing.map((m) => m.sequence)) + 10;
}

export function newId(): string {
  return `ms_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export async function projectAdminUserIds(projectId: string): Promise<string[]> {
  const project = await getProjectById(projectId);
  if (!project) return [];
  return [...project.adminUserIds];
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


export async function ownerName(userId: string): Promise<string> {
  const u = await getUserById(userId);
  if (!u) return userId;
  return u.firstName ?? u.handle;
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
        body: `${project.title}. ${daysOver} day${daysOver === 1 ? "" : "s"} past due. Owner: ${await ownerName(row.ownerUserId)}.`,
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

