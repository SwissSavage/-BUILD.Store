/**
 * Notifications inbox (Phase 2.4 sandbox).
 *
 * One screen, two lanes:
 *   - Unread (top) — anything still flagged readAt: null
 *   - Earlier (bottom) — already-acknowledged entries, kept around so
 *     a member can re-find a deep link they followed last week
 *
 * Each row is its own form so clicking the title both marks the entry
 * read AND redirects the user to the underlying surface (order detail,
 * admin queue, etc.). Mark-all-read is a single button at the top.
 *
 * REPLACE WITH: a Drizzle query on the `notifications` table filtered
 * to the current user, ordered by createdAt desc. Server actions stay
 * the same shape.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  notificationsForUser,
  unreadNotificationCount,
} from "@/lib/mock-data/notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notification-actions";
import { NOTIFICATION_KIND_LABELS, type NotificationKind } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";

const KIND_ACCENT: Record<NotificationKind, string> = {
  order_status: "#5070F0",
  order_tracking: "#5070F0",
  split_distributed: "#007048",
  contract_stage: "#5070F0",
  invoice_received: "#007048",
  rfp_status: "#D828A0",
  membership_decision: "#D828A0",
  seller_application: "#D828A0",
  whitelist_decision: "#007048",
  direct_message: "#D828A0",
  project_application: "#5070F0",
  project_application_decision: "#D828A0",
  prospective_contribution: "#007048",
  peer_review_requested: "#5070F0",
  customer_feedback_received: "#D828A0",
  customer_review_optin: "#5070F0",
  testimonial_published: "#007048",
  epk_submitted: "#5070F0",
  epk_published: "#007048",
  epk_revision_requested: "#D828A0",
  booking_request_received: "#5070F0",
  booking_request_approved: "#007048",
  booking_request_declined: "#D828A0",
  booking_confirmed: "#007048",
  milestone_due_soon: "#5070F0",
  milestone_overdue: "#D828A0",
  milestone_status_changed: "#5070F0",
  milestone_blocked: "#D828A0",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/notifications");

  const all = notificationsForUser(user.id);
  const unread = all.filter((n) => n.readAt === null);
  const earlier = all.filter((n) => n.readAt !== null);
  const unreadCount = unreadNotificationCount(user.id);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Inbox</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Notifications
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Order transitions, RFP status changes, payouts, and admin
            messages routed to you. The same fan-out runs in production —
            this is the sandbox-shape.
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magenta"
            >
              Mark all read ({unreadCount})
            </button>
          </form>
        )}
      </div>

      {all.length === 0 ? (
        <Card className="mt-10">
          <p className="text-sm text-ink-muted">
            Nothing in the inbox yet. As soon as anything moves on a
            contract, order, or application that touches you, it lands
            here.{" "}
            <Link href="/dashboard" className="text-brand-magenta hover:underline">
              Back to dashboard →
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-wider text-ink-muted">
              Unread ({unread.length})
            </h2>
            {unread.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">
                All caught up.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {unread.map((n) => (
                  <NotificationRow key={n.id} n={n} unread />
                ))}
              </div>
            )}
          </section>

          {earlier.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xs uppercase tracking-wider text-ink-muted">
                Earlier ({earlier.length})
              </h2>
              <div className="mt-3 space-y-2">
                {earlier.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  unread = false,
}: {
  n: ReturnType<typeof notificationsForUser>[number];
  unread?: boolean;
}) {
  const accent = KIND_ACCENT[n.kind];
  return (
    <form action={markNotificationRead}>
      <input type="hidden" name="id" value={n.id} />
      <input type="hidden" name="next" value={n.href} />
      <button
        type="submit"
        className={`block w-full rounded-2xl border px-5 py-4 text-left transition-colors ${
          unread
            ? "border-brand-magenta/40 bg-[var(--surface-elevated)] hover:border-brand-magenta"
            : "border-[var(--surface-border)] bg-[var(--surface)] hover:border-brand-magenta/40"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span style={{ color: accent }}>
                {NOTIFICATION_KIND_LABELS[n.kind]}
              </span>
              {unread && (
                <span className="ml-1 rounded-full bg-brand-magenta px-1.5 py-0.5 text-[9px] font-medium text-white">
                  NEW
                </span>
              )}
            </div>
            <div className="mt-1 font-medium text-ink">{n.title}</div>
            <p className="mt-1 text-sm text-ink-muted">{n.body}</p>
          </div>
          <div className="shrink-0 text-right text-[11px] text-ink-faint">
            {formatTime(n.createdAt)}
          </div>
        </div>
      </button>
    </form>
  );
}
