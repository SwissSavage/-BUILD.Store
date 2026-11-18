/**
 * Time entries and issued timesheets, read from Postgres.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-18)
 *
 * Two different kinds of read live here and they are not
 * interchangeable.
 *
 * Entries are the live record: editable, and whatever they say today
 * is the truth about what was worked.
 *
 * An issued timesheet is frozen. getTimesheetByToken returns the
 * snapshot and never joins back to entries, because a client holding
 * a sheet that says 14.25 hours must still see 14.25 hours next year
 * after somebody fixes a typo in a description. Same rule the
 * remittance readers carry, and worth repeating here rather than
 * leaving somebody to infer it: the first time this file enriches a
 * document from current state, the document stops being evidence.
 *
 * No seed fallback, as everywhere else in this directory. An invented
 * billing document is worse than an empty page.
 * ─────────────────────────────────────────────────────────────
 */
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { timeEntries, timesheets } from "@/db/schema";
import type { TimeEntry, Timesheet } from "@/lib/types";

/** Every entry on an engagement, oldest first: document order. */
export async function getTimeEntriesForProject(
  projectId: string,
): Promise<TimeEntry[]> {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId))
    .orderBy(asc(timeEntries.workDate), asc(timeEntries.createdAt));
  return rows as unknown as TimeEntry[];
}

/** One Builder's own entries on an engagement. */
export async function getTimeEntriesForUserOnProject(
  projectId: string,
  userId: string,
): Promise<TimeEntry[]> {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.projectId, projectId),
        eq(timeEntries.userId, userId),
      ),
    )
    .orderBy(asc(timeEntries.workDate), asc(timeEntries.createdAt));
  return rows as unknown as TimeEntry[];
}

/** Drafts and issued sheets, newest period first. */
export async function getTimesheetsForProject(
  projectId: string,
): Promise<Timesheet[]> {
  const rows = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.projectId, projectId))
    .orderBy(desc(timesheets.periodEnd), desc(timesheets.createdAt));
  return rows as unknown as Timesheet[];
}

/**
 * The current issued sheet on an engagement, which is the one a new
 * revision supersedes and the one the reconciliation is computed
 * against.
 */
export async function getLatestIssuedTimesheet(
  projectId: string,
): Promise<Timesheet | null> {
  const [row] = await db
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
  return (row as unknown as Timesheet) ?? null;
}

export async function getTimesheetById(
  id: string,
): Promise<Timesheet | null> {
  const [row] = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.id, id))
    .limit(1);
  return (row as unknown as Timesheet) ?? null;
}

/**
 * The client-facing lookup. The token IS the credential, same pattern
 * as /invoices/[token] and /receipts/[token].
 *
 * Unissued sheets are excluded deliberately. A draft token would let
 * a client see figures still being worked out, and a timesheet is a
 * billing document: the first version somebody outside sees should be
 * the one we stand behind.
 */
export async function getTimesheetByToken(
  token: string,
): Promise<Timesheet | null> {
  const clean = token.trim();
  if (!clean) return null;
  const [row] = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.clientToken, clean),
        isNotNull(timesheets.issuedAt),
      ),
    )
    .limit(1);
  return (row as unknown as Timesheet) ?? null;
}
