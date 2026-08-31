/**
 * Audit log reader.
 *
 * Filters go into the WHERE clause and the cap goes into LIMIT, rather
 * than loading the table and filtering in JavaScript. That distinction
 * matters more here than anywhere else in the app: the audit log is the
 * one table designed to grow forever and never be pruned, so a page
 * that reads it all would get slower every single day it runs.
 *
 * `/admin/members/[id]` and `/profile/data-rights` also read this
 * scoped to one person. Scoping in SQL means one member's page load
 * never causes a read of another member's entries.
 */
import { and, count, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogEntries } from "@/db/schema";
import type {
  AuditLogAction,
  AuditLogEntry,
  AuditLogResourceKind,
} from "@/lib/types";

export interface AuditLogQuery {
  actorUserId?: string;
  action?: AuditLogAction;
  /** Match any of these actions. Combined with `action` as an AND. */
  actions?: AuditLogAction[];
  resourceKind?: AuditLogResourceKind;
  resourceId?: string;
  /** ISO timestamp; entries at or after this instant. */
  since?: string;
  limit?: number;
}

/**
 * Read audit entries, most recent first.
 *
 * Admin-only at the caller. Nothing here checks authorization — every
 * call site sits behind `requireAdmin()` or a self-scoped query.
 */
export async function readAuditLog(
  options: AuditLogQuery = {},
): Promise<AuditLogEntry[]> {
  const clauses: SQL[] = [];

  if (options.actorUserId) {
    clauses.push(eq(auditLogEntries.actorUserId, options.actorUserId));
  }
  if (options.action) {
    clauses.push(eq(auditLogEntries.action, options.action));
  }
  if (options.actions && options.actions.length > 0) {
    clauses.push(inArray(auditLogEntries.action, options.actions));
  }
  if (options.resourceKind) {
    clauses.push(eq(auditLogEntries.resourceKind, options.resourceKind));
  }
  if (options.resourceId) {
    clauses.push(eq(auditLogEntries.resourceId, options.resourceId));
  }
  if (options.since) {
    clauses.push(gte(auditLogEntries.createdAt, options.since));
  }

  const base = db.select().from(auditLogEntries);
  const filtered =
    clauses.length > 0 ? base.where(and(...clauses)) : base;
  const ordered = filtered.orderBy(desc(auditLogEntries.createdAt));

  const rows =
    options.limit && options.limit > 0
      ? await ordered.limit(options.limit)
      : await ordered;

  return rows as unknown as AuditLogEntry[];
}

/**
 * Total entries recorded. Used by the compliance evidence line and the
 * admin tile. COUNT in SQL — the whole point of this table is that it
 * never stops growing, so it must never be materialized to be counted.
 */
export async function countAuditEntries(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(auditLogEntries);
  return Number(row?.n ?? 0);
}

/**
 * Distinct actors who appear in the log, for the filter dropdown on
 * /admin/audit-log. SELECT DISTINCT rather than reading every row and
 * building a Set — same reason as the count above.
 */
export async function distinctAuditActors(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ actorUserId: auditLogEntries.actorUserId })
    .from(auditLogEntries);
  return rows
    .map((r) => r.actorUserId)
    .filter((id): id is string => Boolean(id));
}
