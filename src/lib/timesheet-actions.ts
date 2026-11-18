"use server";

/**
 * Logging time, and issuing the sheet that goes to the client.
 *
 * ─────────────────────────────────────────────────────────────
 * WHO CAN WRITE WHAT (2026-11-18)
 *
 * A Builder logs their OWN hours against an engagement they are on.
 * They never name the user the entry belongs to and never type a
 * rate: the recipient is whoever is signed in, and the rate comes off
 * projects.engagementRate, which is documented "Client-facing rate or
 * total. Never shown to the Builder."
 *
 * This is the same shape of bug the membership tier application had,
 * where applicant and current tier came from hidden form fields and
 * anyone holding the action id could file in somebody else's name.
 * Hours become money, so it matters more here.
 *
 * An admin can log on a Builder's behalf, because in practice a
 * Builder reports their hours by text and somebody enters them. That
 * path records loggedByUserId so the two are distinguishable
 * afterwards.
 *
 * Only an admin issues. Issuing is what turns a working total into a
 * document a client is shown.
 *
 * WHY ISSUING SNAPSHOTS RATHER THAN REFERENCES
 *
 * See src/lib/timesheet.ts. A document that recomputes from current
 * state is not evidence.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { projects, timeEntries, timesheets } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import {
  computeTotals,
  num,
  reconcile,
  shortDate,
  sortLines,
  type TimesheetExclusion,
  type TimesheetLine,
  type TimePrecision,
} from "@/lib/timesheet";

export interface TimeEntryResult {
  ok: boolean;
  message: string;
}

const PRECISIONS: TimePrecision[] = ["exact", "estimated", "provisional"];

/** YYYY-MM-DD, and a real date rather than whatever was typed. */
function validDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Log hours. Returns its outcome rather than throwing, for the reason
 * written on ApplyToJobForm: Next strips server-action error messages
 * in production, so "hours must be greater than zero" would reach the
 * Builder as "An error occurred in the Server Components render."
 */
export async function logTimeEntry(
  formData: FormData,
): Promise<TimeEntryResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to log time." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const workDate = String(formData.get("workDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rawHours = String(formData.get("hours") ?? "").trim();
  const precisionRaw = String(formData.get("precision") ?? "exact").trim();
  const billable = String(formData.get("billable") ?? "on") === "on";
  const exclusionReason =
    String(formData.get("exclusionReason") ?? "").trim() || null;

  if (!projectId) return { ok: false, message: "Missing engagement." };
  if (!validDate(workDate)) {
    return { ok: false, message: "Pick the date the work was done." };
  }
  if (!description) {
    return {
      ok: false,
      message:
        "Say what you did. This line goes to the client exactly as written.",
    };
  }

  const hours = Number(rawHours);
  if (!Number.isFinite(hours) || hours <= 0) {
    return { ok: false, message: "Hours must be greater than zero." };
  }
  if (hours > 24) {
    return { ok: false, message: "More than 24 hours in one day." };
  }
  // Quarter-hour granularity, which is what the engagements are
  // billed at. Rejecting rather than silently rounding: a Builder who
  // meant 0.3 should be told, not quietly paid for 0.25.
  if (Math.abs(hours * 4 - Math.round(hours * 4)) > 1e-9) {
    return {
      ok: false,
      message: "Round to the nearest quarter hour (0.25, 0.50, 0.75).",
    };
  }

  const precision = (
    PRECISIONS.includes(precisionRaw as TimePrecision)
      ? precisionRaw
      : "exact"
  ) as TimePrecision;

  if (!billable && !exclusionReason) {
    return {
      ok: false,
      message: "Say why this one is not being charged.",
    };
  }

  // Whose hours these are. A Builder can only log their own; an admin
  // may log for somebody else, and the form field is honoured ONLY in
  // that case.
  const requestedUserId = String(formData.get("userId") ?? "").trim();
  const subjectId =
    user.isAdmin && requestedUserId ? requestedUserId : user.id;

  const [project] = await db
    .select({ id: projects.id, assigned: projects.assignedMemberIds })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };

  // On the crew, or an admin. Otherwise anyone signed in could bill
  // hours against any engagement in the app.
  const onCrew = (project.assigned ?? []).includes(subjectId);
  if (!onCrew && !user.isAdmin) {
    return {
      ok: false,
      message: "You are not on this engagement.",
    };
  }

  const id = `te_${randomUUID()}`;
  await db.insert(timeEntries).values({
    id,
    projectId,
    userId: subjectId,
    loggedByUserId: user.id === subjectId ? null : user.id,
    workDate,
    hours: hours.toFixed(2),
    description,
    precision,
    billable,
    exclusionReason: billable ? null : exclusionReason,
  });

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "timesheet.entry_logged",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    after: {
      entryId: id,
      userId: subjectId,
      workDate,
      hours: hours.toFixed(2),
      billable,
    },
  });

  revalidatePath(`/admin/contracts/${projectId}`);
  revalidatePath(`/projects/${projectId}`);

  return {
    ok: true,
    message: `Logged ${hours.toFixed(2)}h on ${shortDate(workDate)}.`,
  };
}

/** Remove an entry. Own entries, or any entry if admin. */
export async function deleteTimeEntry(
  formData: FormData,
): Promise<TimeEntryResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const id = String(formData.get("entryId") ?? "").trim();
  if (!id) return { ok: false, message: "Missing entry." };

  const [row] = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.id, id))
    .limit(1);
  if (!row) return { ok: false, message: "Entry not found." };
  if (row.userId !== user.id && !user.isAdmin) {
    return { ok: false, message: "That is not your entry." };
  }

  await db.delete(timeEntries).where(eq(timeEntries.id, id));
  revalidatePath(`/admin/contracts/${row.projectId}`);
  revalidatePath(`/projects/${row.projectId}`);
  return { ok: true, message: "Removed." };
}

export interface IssueTimesheetResult {
  ok: boolean;
  message: string;
  timesheetId?: string;
  clientToken?: string;
}

/**
 * Freeze the current entries into a document and mint its client
 * token.
 *
 * The reconciliation against the previous issued sheet is computed
 * here rather than typed by an admin, because "previously reported
 * 8.25 hours plus 6.00 additional, earlier hours counted once" is the
 * sentence that stops the same morning being billed twice, and a
 * human retyping it each month is exactly the failure it guards
 * against.
 */
export async function issueTimesheet(
  formData: FormData,
): Promise<IssueTimesheetResult> {
  const admin = await requireAdmin();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const methodNote =
    String(formData.get("methodNote") ?? "").trim() ||
    "Eastern Time · nearest quarter-hour";
  const kindLabel =
    String(formData.get("kindLabel") ?? "").trim() || "Combined timesheet";

  if (!projectId) return { ok: false, message: "Missing engagement." };

  const [project] = await db
    .select({
      id: projects.id,
      title: projects.title,
      rate: projects.engagementRate,
      basis: projects.engagementBasis,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, message: "Engagement not found." };

  const rate = num(project.rate);
  if (rate <= 0) {
    return {
      ok: false,
      message:
        "This engagement has no hourly rate set, so there is nothing to bill against. Set it on the engagement terms first.",
    };
  }
  if (project.basis !== "hourly") {
    return {
      ok: false,
      message:
        "This engagement is not hourly. A timesheet would not match how it is billed.",
    };
  }

  const entries = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId));

  const billable = entries.filter((e) => e.billable);
  if (billable.length === 0) {
    return { ok: false, message: "No billable hours logged yet." };
  }

  const lines: TimesheetLine[] = sortLines(
    billable.map((e) => ({
      workDate: e.workDate,
      description: e.description,
      hours: num(e.hours),
      precision: e.precision as TimePrecision,
    })),
  );

  const excluded: TimesheetExclusion[] = entries
    .filter((e) => !e.billable)
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((e) => ({
      workDate: e.workDate,
      description: e.description,
      reason: e.exclusionReason ?? "No-charge",
    }));

  // The sheet this one supersedes, and the hours it already
  // reported. Most recently ISSUED, not oldest and not a draft: a
  // draft was never shown to anyone so there is nothing to reconcile
  // against, and reconciling against the first sheet instead of the
  // last would re-bill everything in between.
  const [priorIssued] = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.projectId, projectId),
        isNotNull(timesheets.issuedAt),
      ),
    )
    .orderBy(desc(timesheets.issuedAt))
    .limit(1);

  const priorLines: TimesheetLine[] = priorIssued
    ? ((priorIssued.lines as TimesheetLine[]) ?? [])
    : [];

  const recon = reconcile(lines, priorLines, shortDate);
  const totals = computeTotals(lines, rate);

  const id = `ts_${randomUUID()}`;
  const clientToken = randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();

  await db.insert(timesheets).values({
    id,
    projectId,
    issuedAt: now,
    supersedesId: priorIssued?.id ?? null,
    title: project.title,
    periodStart: lines[0].workDate,
    periodEnd: lines[lines.length - 1].workDate,
    hourlyRate: rate.toFixed(2),
    lines,
    excluded,
    totalHours: totals.hours.toFixed(2),
    totalAmount: totals.amount.toFixed(2),
    priorHours: recon.priorHours.toFixed(2),
    methodNote,
    clientToken,
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "timesheet.issued",
    resourceKind: "project",
    resourceId: projectId,
    before: priorIssued
      ? { timesheetId: priorIssued.id, totalHours: priorIssued.totalHours }
      : null,
    after: {
      timesheetId: id,
      totalHours: totals.hours.toFixed(2),
      totalAmount: totals.amount.toFixed(2),
      priorHours: recon.priorHours.toFixed(2),
      additionalHours: recon.additionalHours.toFixed(2),
      rate: rate.toFixed(2),
    },
    reason: `${kindLabel} for ${project.title}.`,
  });

  revalidatePath(`/admin/contracts/${projectId}`);

  return {
    ok: true,
    message: `Issued: ${totals.hours.toFixed(2)}h, ${totals.amount.toFixed(2)}.`,
    timesheetId: id,
    clientToken,
  };
}
