/**
 * Surface-level notification strip.
 *
 * Drop at the top of pages like /projects, /orders, /wallet so a member
 * sees the kind-relevant unread items without having to context-switch
 * to /notifications. Tap-through goes to /notifications where the
 * existing mark-read flow handles acknowledgement.
 *
 * Renders nothing if there are no unread items in the configured
 * kinds — this keeps the strip from cluttering pages on quiet days.
 */
import Link from "next/link";
import { unreadByKind } from "@/lib/mock-data/notifications";
import {
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
} from "@/lib/types";

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
  quote_approved: "#007048",
  quote_declined: "#D828A0",
};

export function NotificationStrip({
  userId,
  kinds,
  surfaceLabel,
}: {
  userId: string;
  kinds: NotificationKind[];
  /** Friendly label for the surface (e.g. "Projects"). Used in copy. */
  surfaceLabel: string;
}) {
  const unread = unreadByKind(userId, kinds);
  if (unread.length === 0) return null;

  // Show the most recent 3 inline; rest hide behind the count.
  const preview = unread.slice(0, 3);
  const extra = unread.length - preview.length;

  return (
    <div
      className="mt-6 rounded-2xl border px-5 py-4"
      style={{
        borderColor: "rgba(216, 40, 160, 0.35)",
        backgroundColor: "rgba(216, 40, 160, 0.06)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
          {unread.length} new in {surfaceLabel}
        </p>
        <Link
          href="/notifications"
          className="text-[11px] text-brand-magenta hover:underline"
        >
          Open inbox →
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {preview.map((n) => {
          const accent = KIND_ACCENT[n.kind];
          return (
            <li key={n.id} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="min-w-0">
                <span
                  className="text-[10px] uppercase tracking-wider mr-2"
                  style={{ color: accent }}
                >
                  {NOTIFICATION_KIND_LABELS[n.kind]}
                </span>
                <span className="text-ink">{n.title}</span>
              </span>
            </li>
          );
        })}
        {extra > 0 && (
          <li className="text-xs italic text-ink-muted">
            …and {extra} more.
          </li>
        )}
      </ul>
    </div>
  );
}
