/**
 * /admin/audit-log — reverse-chronological audit log viewer.
 *
 * Every security/financial/compliance-adjacent action writes here via
 * `logAuditEvent()`. Sandbox reads from MOCK_AUDIT_LOG; production reads
 * from a Drizzle `audit_log` table where the app role has been stripped
 * of UPDATE and DELETE grants.
 *
 * Admin-only. Read-only — this surface intentionally does not expose any
 * mutation controls (SOC 2 CC7.2 evidence: log integrity is enforced at
 * the persistence layer, and viewing must not admit an edit path).
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_AUDIT_LOG,
  readAuditLog,
} from "@/lib/mock-data/audit-log";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  AUDIT_LOG_ACTION_LABELS,
  publicName,
  type AuditLogAction,
  type AuditLogResourceKind,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const RESOURCE_KINDS: AuditLogResourceKind[] = [
  "user",
  "mvp_score",
  "mvp_penalty",
  "recognition",
  "canonization",
  "project",
  "milestone",
  "booking",
  "notification_rule",
  "config",
];

function actorLabel(userId: string | null): string {
  if (userId === null) return "System";
  const user = MOCK_USERS.find((u) => u.id === userId);
  return user ? publicName(user) : userId.slice(0, 12);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function safeAction(raw: string | undefined): AuditLogAction | undefined {
  if (!raw) return undefined;
  return (raw in AUDIT_LOG_ACTION_LABELS ? (raw as AuditLogAction) : undefined);
}

function safeResourceKind(
  raw: string | undefined,
): AuditLogResourceKind | undefined {
  if (!raw) return undefined;
  return RESOURCE_KINDS.includes(raw as AuditLogResourceKind)
    ? (raw as AuditLogResourceKind)
    : undefined;
}

interface AuditLogPageSearchParams {
  actor?: string;
  action?: string;
  resource?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogPageSearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const actorFilter = params.actor?.trim() || undefined;
  const actionFilter = safeAction(params.action?.trim());
  const resourceFilter = safeResourceKind(params.resource?.trim());

  const entries = readAuditLog({
    actorUserId: actorFilter,
    action: actionFilter,
    resourceKind: resourceFilter,
    limit: 500,
  });

  const uniqueActors = Array.from(
    new Set(MOCK_AUDIT_LOG.map((e) => e.actorUserId).filter(Boolean)),
  ) as string[];
  const actions = Object.keys(AUDIT_LOG_ACTION_LABELS) as AuditLogAction[];

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <CardEyebrow>Compliance</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">Audit log</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Append-only record of every security, financial, and
        compliance-adjacent action. SOC 2 CC7.2 / ISO 27001 A.12.4
        evidence. Sandbox stores entries in-memory; production stores in
        a Drizzle table with UPDATE and DELETE grants revoked at the
        database role level.
      </p>

      <Card className="mt-6">
        <CardEyebrow>Filters</CardEyebrow>
        <form method="get" className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-ink-muted">
            Actor
            <select
              name="actor"
              defaultValue={actorFilter ?? ""}
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
            >
              <option value="">All actors</option>
              {uniqueActors.map((uid) => (
                <option key={uid} value={uid}>
                  {actorLabel(uid)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Action
            <select
              name="action"
              defaultValue={actionFilter ?? ""}
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {AUDIT_LOG_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Resource
            <select
              name="resource"
              defaultValue={resourceFilter ?? ""}
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
            >
              <option value="">All resources</option>
              {RESOURCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-4 py-2 text-xs text-white hover:opacity-90"
            >
              Apply
            </button>
            <Link
              href="/admin/audit-log"
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
            >
              Clear
            </Link>
          </div>
        </form>
      </Card>

      <p className="mt-6 text-xs text-ink-muted">
        {entries.length.toLocaleString()} entries
        {actorFilter || actionFilter || resourceFilter ? " matching filter" : ""}
        {" · showing most recent 500"}
      </p>

      {entries.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-ink-muted">
            No entries match. Actions taken through the admin surfaces
            write here as they land; the log stays empty until real
            mutations flow through.
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <CardEyebrow>{AUDIT_LOG_ACTION_LABELS[e.action]}</CardEyebrow>
                <span className="font-mono text-[10px] text-ink-faint">
                  {formatTime(e.createdAt)}
                </span>
              </div>
              <CardTitle className="mt-1 text-sm">
                {actorLabel(e.actorUserId)}{" "}
                <span className="text-ink-muted">
                  ({e.actorRoleSnapshot})
                </span>{" "}
                <span className="text-ink-faint">
                  → {e.resourceKind}
                  {e.resourceId ? `/${e.resourceId}` : ""}
                </span>
              </CardTitle>
              {e.reason && (
                <p className="mt-2 text-xs italic text-ink-muted">
                  {e.reason.length > 300
                    ? `${e.reason.slice(0, 300)}…`
                    : e.reason}
                </p>
              )}
              {(e.before || e.after) && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {e.before && (
                    <pre className="overflow-x-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-[10px] text-ink-muted">
                      <span className="text-brand-magenta">before:</span>{"\n"}
                      {JSON.stringify(e.before, null, 2)}
                    </pre>
                  )}
                  {e.after && (
                    <pre className="overflow-x-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-[10px] text-ink-muted">
                      <span className="text-brand-magenta">after:</span>{"\n"}
                      {JSON.stringify(e.after, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-faint">
                <span>entry: <code>{e.id}</code></span>
                {e.ipHint && <span>ip: <code>{e.ipHint}</code></span>}
                {e.sessionHint && (
                  <span>session: <code>{e.sessionHint.slice(0, 12)}…</code></span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
