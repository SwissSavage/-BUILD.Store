import type { NotificationKind } from "@/lib/types";

/** Notification kinds that belong to a member-facing navigation area. */
export const CONTEXTUAL_NOTIFICATION_KINDS = {
  projects: [
    "project_application_decision",
    "milestone_due_soon",
    "milestone_due_important",
    "milestone_due_urgent",
    "milestone_overdue",
    "milestone_status_changed",
    "milestone_blocked",
    "project_weekly_rollup",
  ],
  orders: ["order_status", "order_tracking"],
  wallet: ["split_distributed", "invoice_received"],
  community: ["direct_message", "community_message"],
} satisfies Record<string, NotificationKind[]>;

export type ContextualNotificationArea = keyof typeof CONTEXTUAL_NOTIFICATION_KINDS;
