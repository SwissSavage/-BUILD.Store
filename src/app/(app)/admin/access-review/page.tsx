/**
 * /admin/access-review — quarterly admin access review surface.
 *
 * SOC 2 CC5.3 (least privilege) + ISO 27001 A.9.2 (user access
 * management) evidence path. The workflow:
 *   1. Reviewer sees every user carrying the admin flag with role
 *      snapshot + last-active-hint.
 *   2. For anyone whose access shouldn't persist, reviewer revokes
 *      with a reason (recorded as user.admin_flag_changed audit).
 *   3. When the walk-through is complete, reviewer records the
 *      review completion (recorded as config.access_reviewed audit).
 *
 * The last-review-date drives the compliance-dashboard status —
 * reviews older than 90 days flip the row to "overdue."
 */
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { readAuditLog } from "@/lib/mock-data/audit-log";
import {
  recordAccessReview,
  revokeAdminFlag,
} from "@/lib/access-review-actions";
import { adminName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daysSince(iso: string | null | undefined): string {
  if (!iso) return "never";
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function AccessReviewPage() {
  const reviewer = await requireAdmin();

  const admins = MOCK_USERS.filter((u) => u.isAdmin);

  // Prior review completions from the audit log.
  const priorReviews = readAuditLog({
    action: "config.access_reviewed",
    limit: 20,
  });
  const lastReview = priorReviews[0] ?? null;
  const daysSinceLastReview = lastReview
    ? Math.floor(
        (Date.now() - new Date(lastReview.createdAt).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;
  const overdue = daysSinceLastReview === null || daysSinceLastReview > 90;

  // Prior revocations from the audit log — surface for this session's
  // walk-through so the reviewer can see who's already been touched.
  const priorRevocations = readAuditLog({
    action: "user.admin_flag_changed",
    limit: 30,
  }).filter((e) => {
    const after = e.after as { isAdmin?: boolean } | null;
    return after?.isAdmin === false;
  });

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <CardEyebrow>Compliance · CC5.3 / A.9.2</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Admin access review
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Quarterly walk-through of every admin-flagged user. Confirm each
        row or revoke with a reason. Record completion when done —
        that entry is what the Type II auditor asks for.
      </p>

      {/* Cadence status */}
      <Card
        className="mt-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <CardEyebrow>Cadence</CardEyebrow>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
            style={{
              color: overdue ? "#D828A0" : "#007048",
              borderColor: overdue ? "#D828A0" : "#007048",
              borderWidth: 1,
              borderStyle: "solid",
            }}
          >
            {overdue ? "Overdue" : "Within cadence"}
          </span>
        </div>
        {lastReview ? (
          <p className="mt-2 text-sm text-ink-muted">
            Last review completed {daysSince(lastReview.createdAt)} by{" "}
            <span className="text-ink">
              {adminName(
                MOCK_USERS.find((u) => u.id === lastReview.actorUserId) ??
                  null,
              )}
            </span>
            . Standing cadence is 90 days; next review due{" "}
            {formatDate(
              new Date(
                new Date(lastReview.createdAt).getTime() + NINETY_DAYS_MS,
              ).toISOString(),
            )}
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            No prior review on record. Complete the first walk-through to
            set the cadence baseline.
          </p>
        )}
      </Card>

      {/* Admin roster */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Current admins ({admins.length})
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Ask for each: does this person still need this access? If
          not, revoke.
        </p>

        <div className="mt-4 space-y-3">
          {admins.map((admin) => {
            const isSelf = admin.id === reviewer.id;
            return (
              <Card key={admin.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {adminName(admin)}
                    </CardTitle>
                    <p className="text-xs text-ink-muted">
                      <code>@{admin.handle}</code> · {admin.email}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      Account created {daysSince(admin.createdAt)} · tier{" "}
                      {admin.membershipTier}
                    </p>
                  </div>
                  {isSelf ? (
                    <span className="rounded-full border border-[var(--surface-border)] px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      You (reviewer)
                    </span>
                  ) : (
                    <details className="w-full max-w-xs">
                      <summary className="cursor-pointer rounded-full border border-brand-magenta/40 px-4 py-2 text-xs text-brand-magenta hover:border-brand-magenta">
                        Revoke access
                      </summary>
                      <form
                        action={revokeAdminFlag}
                        className="mt-3 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="targetId"
                          value={admin.id}
                        />
                        <label className="block text-xs text-ink-muted">
                          Reason (≥ 10 chars, recorded)
                          <textarea
                            name="reason"
                            required
                            minLength={10}
                            rows={2}
                            className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1.5 text-xs text-ink"
                            placeholder="Left the cooperative / role changed / never actioned / …"
                          />
                        </label>
                        <button
                          type="submit"
                          className="w-full rounded-full bg-brand-magenta px-4 py-2 text-xs text-white hover:opacity-90"
                        >
                          Revoke admin flag
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Record review completion */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Record review completion
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          When done with the list, record completion. Cadence clock
          resets, auditor gets a pointer.
        </p>

        <form action={recordAccessReview} className="mt-4 space-y-3">
          <label className="block text-xs text-ink-muted">
            Optional summary
            <textarea
              name="summary"
              rows={3}
              maxLength={600}
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
              placeholder="e.g. 'Confirmed all 3 admin flags in place. Revoked X's access following role transition to Partner.'"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
          >
            Record review complete
          </button>
        </form>
      </section>

      {/* Prior activity */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Prior activity</h2>

        <div className="mt-4 space-y-3">
          <Card>
            <CardEyebrow>Prior reviews</CardEyebrow>
            {priorReviews.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No prior review entries on record.
              </p>
            ) : (
              <ol className="mt-2 space-y-1.5 text-sm">
                {priorReviews.slice(0, 10).map((e) => (
                  <li key={e.id} className="text-ink-muted">
                    <span className="font-mono text-[10px] text-ink-faint">
                      {formatDate(e.createdAt)}
                    </span>{" "}
                    ·{" "}
                    {adminName(
                      MOCK_USERS.find((u) => u.id === e.actorUserId) ??
                        null,
                    )}
                    {e.reason && (
                      <span className="ml-2 italic">
                        &ldquo;{e.reason.slice(0, 140)}
                        {e.reason.length > 140 ? "…" : ""}&rdquo;
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardEyebrow>Prior revocations</CardEyebrow>
            {priorRevocations.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No prior admin-flag revocations on record.
              </p>
            ) : (
              <ol className="mt-2 space-y-1.5 text-sm">
                {priorRevocations.slice(0, 10).map((e) => (
                  <li key={e.id} className="text-ink-muted">
                    <span className="font-mono text-[10px] text-ink-faint">
                      {formatDate(e.createdAt)}
                    </span>{" "}
                    ·{" "}
                    {adminName(
                      MOCK_USERS.find((u) => u.id === e.actorUserId) ??
                        null,
                    )}{" "}
                    revoked{" "}
                    <code>{e.resourceId}</code>
                    {e.reason && (
                      <span className="ml-1 italic">
                        &ldquo;{e.reason.slice(0, 140)}
                        {e.reason.length > 140 ? "…" : ""}&rdquo;
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
