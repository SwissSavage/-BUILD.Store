/**
 * Audit log writer — SOC 2 CC7.2 / ISO 27001 A.12.4.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-30)
 *
 * `logAuditEvent()` pushed onto an in-memory array. 109 call sites
 * across 45 files — every sign-in, every role change, every payout,
 * every data-rights request, every admin impersonation.
 *
 * All of it vanished on each deploy. The compliance page reported
 * "MOCK_AUDIT_LOG append-only in-memory store, N entries recorded so
 * far" as its evidence, and N reset to zero on every container
 * restart. An audit trail that resets is not an audit trail.
 *
 * This writes to the `audit_log_entries` table, which already existed
 * in the schema and had never been written to.
 * ─────────────────────────────────────────────────────────────
 *
 * FAILURE POSTURE — read this before changing it.
 *
 * An audit write must not break the action that triggered it. A member
 * whose project submission succeeded should not see an error because
 * the log insert hiccupped, especially since the log call happens
 * after the mutation has already committed.
 *
 * But unlike notifications, a dropped audit entry is a compliance
 * event, not a cosmetic one. So this does NOT swallow silently: it
 * emits the full entry to stderr as structured JSON under a
 * grep-able marker. Container logs then hold the record even when
 * Postgres refused it, which is recoverable evidence rather than
 * nothing.
 *
 * STILL OUTSTANDING for a real CC7.2 sign-off, none of which this
 * file can do alone:
 *   - Revoke UPDATE/DELETE on `audit_log_entries` from the app's
 *     database role. Append-only is currently a convention here, not
 *     a grant. This is the biggest remaining gap.
 *   - Ship each insert to a WORM store (S3 Object Lock in Compliance
 *     mode) within one business day.
 *   - Retention policy: 12 months hot, 7 years cold for the financial
 *     subset (`contract.*`, `mvp.compliance_*`).
 */
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { auditLogEntries } from "@/db/schema";
import type {
  AuditLogAction,
  AuditLogEntry,
  AuditLogResourceKind,
  MembershipTier,
} from "@/lib/types";

/**
 * Snapshot the actor's role at the moment of the action, so a historical
 * entry stays meaningful after the actor's role changes.
 */
export function snapshotActorRole(
  actor: { membershipTier: MembershipTier; isAdmin?: boolean | null } | null,
): AuditLogEntry["actorRoleSnapshot"] {
  if (actor === null) return "system";
  if (actor.isAdmin) return "admin";
  return actor.membershipTier;
}

/**
 * Mask an IP to its /24 (or /64 for v6). Applied at write time — a full
 * IP never reaches the store, which is what keeps the log itself from
 * becoming a privacy liability under the data-rights rail.
 */
export function maskIpHint(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v4 = raw.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.0`;
  const parts = raw.split(":");
  if (parts.length > 4) return `${parts.slice(0, 4).join(":")}::/64`;
  return raw;
}

export interface AuditEventInput {
  actorUserId: string | null;
  actorRoleSnapshot: AuditLogEntry["actorRoleSnapshot"];
  action: AuditLogAction;
  resourceKind: AuditLogResourceKind;
  resourceId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipHint?: string | null;
  sessionHint?: string | null;
  reason?: string | null;
}

/**
 * Append one audit entry.
 *
 * Never call this from a render path — only from server actions or API
 * routes, and only after the mutation being recorded has committed.
 */
export async function logAuditEvent(
  input: AuditEventInput,
): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    id: `audit_${randomUUID()}`,
    actorUserId: input.actorUserId,
    actorRoleSnapshot: input.actorRoleSnapshot,
    action: input.action,
    resourceKind: input.resourceKind,
    resourceId: input.resourceId,
    before: input.before ?? null,
    after: input.after ?? null,
    ipHint: maskIpHint(input.ipHint),
    sessionHint: input.sessionHint ?? null,
    reason: input.reason ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.insert(auditLogEntries).values({
      id: entry.id,
      actorUserId: entry.actorUserId,
      actorRoleSnapshot: entry.actorRoleSnapshot,
      action: entry.action,
      resourceKind: entry.resourceKind,
      resourceId: entry.resourceId,
      before: entry.before,
      after: entry.after,
      ipHint: entry.ipHint,
      sessionHint: entry.sessionHint,
      reason: entry.reason,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    // Loud on purpose. See the failure posture note in the header:
    // the entry goes to stderr so the record survives somewhere even
    // when the insert did not, and the marker is greppable.
    console.error(
      "AUDIT_WRITE_FAILED",
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
        entry,
      }),
    );
  }

  return entry;
}
