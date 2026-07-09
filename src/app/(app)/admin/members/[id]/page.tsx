/**
 * /admin/members/[id] — per-user admin drill-down.
 *
 * Everything an admin needs to do to one user, in one place:
 *   - View profile summary + tier + admin flag + visibility state
 *   - Change tier (audit: user.membership_tier_changed)
 *   - Toggle profile visibility (audit: user.profile_public_toggled)
 *   - Revoke admin flag (audit: user.admin_flag_changed)
 *   - Suspend / reactivate account (audit: user.suspended / user.reactivated)
 *   - Cross-link to per-user audit-log filter
 *
 * All mutations flow through member-management-actions.ts which fires
 * the corresponding audit verb. The surface is admin-only via
 * requireAdmin at page level.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { readAuditLog } from "@/lib/mock-data/audit-log";
import { MOCK_MVP_SCORES, MOCK_MVP_PENALTIES } from "@/lib/mock-data/mvp-scores";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_ATTRIBUTION } from "@/lib/mock-data/attribution";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data/tokens";
import { MOCK_FUTURE_MODERNIST_RECOGNITIONS } from "@/lib/mock-data/future-modernist-recognitions";
import { MOCK_CANONIZATIONS } from "@/lib/mock-data/canonizations";
import {
  reactivateUser,
  setMembershipTier,
  suspendUser,
  toggleAdminFlag,
  toggleProfilePublic,
} from "@/lib/member-management-actions";
import {
  TIER_LABELS,
  adminName,
  publicName,
  type MembershipTier,
} from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";

const TIERS: MembershipTier[] = ["viewer", "prospect", "partner", "member"];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MemberDrillDown({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = MOCK_USERS.find((u) => u.id === id);
  if (!user) notFound();

  // Everything about this user, one query per store.
  const snapshot = MOCK_MVP_SCORES.find((s) => s.userId === user.id) ?? null;
  const penalties = MOCK_MVP_PENALTIES.filter((p) => p.userId === user.id);
  const activePenalties = penalties.filter(
    (p) => new Date(p.expiresAt).getTime() > Date.now(),
  );
  const assignedProjects = MOCK_PROJECTS.filter((p) =>
    p.assignedMemberIds.includes(user.id),
  );
  const attributions = MOCK_ATTRIBUTION.filter(
    (a: { userId: string }) => a.userId === user.id,
  );
  const transactions = MOCK_TRANSACTIONS.filter(
    (t) => t.userId === user.id,
  );
  const buildBalance = transactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0,
  );
  const recognitions = MOCK_FUTURE_MODERNIST_RECOGNITIONS.filter(
    (r) => r.userId === user.id,
  );
  const canonizations = MOCK_CANONIZATIONS.filter(
    (c) => c.userId === user.id,
  );
  const auditEntries = readAuditLog({
    resourceKind: "user",
    resourceId: user.id,
    limit: 30,
  });

  const isSelf = admin.id === user.id;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link
        href="/admin/members"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← All members
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <Avatar user={user} size="lg" />
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {adminName(user)}
            </h1>
            <p className="text-sm text-ink-muted">
              <code>@{user.handle}</code> · {user.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TierBadge tier={user.membershipTier} />
              {user.isAdmin && (
                <span className="rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-magenta">
                  Admin
                </span>
              )}
              {user.suspendedAt && (
                <span className="rounded-full border border-brand-magenta/40 bg-brand-magenta/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-magenta">
                  Suspended
                </span>
              )}
              {!user.profilePublic && (
                <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  Not discoverable
                </span>
              )}
              {snapshot?.isProvisional && (
                <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                  Provisional MVP
                </span>
              )}
            </div>
            {user.discipline && (
              <p className="mt-2 text-sm text-ink-muted">{user.discipline}</p>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              Account created {formatDate(user.createdAt)} · last updated{" "}
              {formatDate(user.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <Link
            href={`/u/${user.handle}`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            View public profile →
          </Link>
          <Link
            href={`/admin/audit-log?resource=user&actor=${user.id}`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            Full audit trail →
          </Link>
          {snapshot && (
            <Link
              href={`/admin/mvp/${user.id}`}
              className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
            >
              MVP score detail →
            </Link>
          )}
        </div>
      </div>

      {/* Suspension banner if suspended */}
      {user.suspendedAt && (
        <div className="mt-6 rounded-2xl border border-brand-magenta/40 bg-brand-magenta/5 px-5 py-4">
          <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
            Suspended
          </p>
          <p className="mt-1 text-sm text-ink">
            Suspended {formatDate(user.suspendedAt)}.{" "}
            {user.suspensionReason && (
              <span className="italic">
                Reason: &ldquo;{user.suspensionReason}&rdquo;
              </span>
            )}
          </p>
          <form action={reactivateUser} className="mt-3 space-y-2">
            <input type="hidden" name="uid" value={user.id} />
            <label className="block text-xs text-ink-muted">
              Reactivation note (optional)
              <input
                type="text"
                name="note"
                className="mt-1 block w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-ink"
                placeholder="Circumstances resolved / issue addressed / …"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-4 py-1.5 text-xs text-white hover:opacity-90"
            >
              Reactivate account
            </button>
          </form>
        </div>
      )}

      {/* Signal summary */}
      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <Card>
          <CardEyebrow>MVP OVR</CardEyebrow>
          <CardTitle className="mt-1 text-3xl">
            {snapshot?.isProvisional
              ? "—"
              : snapshot?.ovr?.toString() ?? "—"}
          </CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            {activePenalties.length > 0
              ? `${activePenalties.length} active penalty`
              : "No active penalties"}
          </p>
        </Card>
        <Card>
          <CardEyebrow>Projects</CardEyebrow>
          <CardTitle className="mt-1 text-3xl">
            {assignedProjects.length}
          </CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            {attributions.length} attribution{" "}
            {attributions.length === 1 ? "entry" : "entries"}
          </p>
        </Card>
        <Card>
          <CardEyebrow>$BUILD balance</CardEyebrow>
          <CardTitle className="mt-1 text-3xl">
            {buildBalance.toLocaleString()}
          </CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            Across {transactions.length} ledger entries
          </p>
        </Card>
        <Card>
          <CardEyebrow>Recognition</CardEyebrow>
          <CardTitle className="mt-1 text-3xl">
            {recognitions.length + canonizations.length}
          </CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            {recognitions.length} recognition · {canonizations.length}{" "}
            canonization
          </p>
        </Card>
      </section>

      {/* Access controls */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Access controls
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Every change here writes an audit-log entry with actor +
          before/after snapshot.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {/* Tier transition */}
          <Card>
            <CardEyebrow>Membership tier</CardEyebrow>
            <CardTitle className="mt-1 text-lg">
              Current: {TIER_LABELS[user.membershipTier]}
            </CardTitle>
            <form
              action={setMembershipTier}
              className="mt-3 flex items-center gap-2"
            >
              <input type="hidden" name="uid" value={user.id} />
              <select
                name="tier"
                defaultValue={user.membershipTier}
                className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-ink"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-full border border-brand-magenta/40 px-3 py-1 text-xs text-brand-magenta hover:border-brand-magenta"
              >
                Change tier
              </button>
            </form>
          </Card>

          {/* Profile visibility */}
          <Card>
            <CardEyebrow>Profile visibility</CardEyebrow>
            <CardTitle className="mt-1 text-lg">
              {user.profilePublic ? "Discoverable" : "Not discoverable"}
            </CardTitle>
            <p className="mt-2 text-xs text-ink-muted">
              Independent of tier. When off, profile is excluded from
              discovery surfaces + search indexes; direct-link URL still
              resolves.
            </p>
            <form action={toggleProfilePublic} className="mt-3">
              <input type="hidden" name="uid" value={user.id} />
              <button
                type="submit"
                className="rounded-full border border-brand-magenta/40 px-3 py-1 text-xs text-brand-magenta hover:border-brand-magenta"
              >
                {user.profilePublic
                  ? "Hide from discovery"
                  : "Restore to discovery"}
              </button>
            </form>
          </Card>

          {/* Admin flag */}
          <Card>
            <CardEyebrow>Admin flag</CardEyebrow>
            <CardTitle className="mt-1 text-lg">
              {user.isAdmin ? "Active admin" : "Not admin"}
            </CardTitle>
            <p className="mt-2 text-xs text-ink-muted">
              Self-toggle is blocked to prevent lockout. Use{" "}
              <Link
                href="/admin/access-review"
                className="text-brand-magenta hover:underline"
              >
                access review
              </Link>{" "}
              for the quarterly ritual view.
            </p>
            {!isSelf && (
              <form action={toggleAdminFlag} className="mt-3">
                <input type="hidden" name="uid" value={user.id} />
                <button
                  type="submit"
                  className="rounded-full border border-brand-magenta/40 px-3 py-1 text-xs text-brand-magenta hover:border-brand-magenta"
                >
                  {user.isAdmin ? "Revoke admin" : "Grant admin"}
                </button>
              </form>
            )}
          </Card>

          {/* Suspend */}
          {!user.suspendedAt && !isSelf && !user.isAdmin && (
            <Card>
              <CardEyebrow>Suspension</CardEyebrow>
              <CardTitle className="mt-1 text-lg">
                Suspend account
              </CardTitle>
              <p className="mt-2 text-xs text-ink-muted">
                Blocks sign-in + hides public profile. Suspension record
                retained per business-records policy. Revoke admin flag
                first if the user is an admin.
              </p>
              <form action={suspendUser} className="mt-3 space-y-2">
                <input type="hidden" name="uid" value={user.id} />
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  rows={2}
                  className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-ink"
                  placeholder="Reason (≥ 10 chars, recorded)"
                />
                <button
                  type="submit"
                  className="rounded-full bg-brand-magenta px-3 py-1 text-xs text-white hover:opacity-90"
                >
                  Suspend
                </button>
              </form>
            </Card>
          )}
        </div>
      </section>

      {/* Recent audit entries */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Recent activity
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Last 30 audit entries scoped to this user. Full trail on{" "}
          <Link
            href={`/admin/audit-log?resource=user&actor=${user.id}`}
            className="text-brand-magenta hover:underline"
          >
            /admin/audit-log
          </Link>
          .
        </p>

        {auditEntries.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No audit entries touch this user yet.
            </p>
          </Card>
        ) : (
          <ol className="mt-4 space-y-2">
            {auditEntries.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-xs"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-brand-magenta">{e.action}</span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-ink-muted">
                  {publicName(
                    MOCK_USERS.find((u) => u.id === e.actorUserId) ?? null,
                  )}{" "}
                  ({e.actorRoleSnapshot})
                  {e.reason && (
                    <span className="ml-2 italic text-ink-faint">
                      &ldquo;{e.reason.slice(0, 200)}
                      {e.reason.length > 200 ? "…" : ""}&rdquo;
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
