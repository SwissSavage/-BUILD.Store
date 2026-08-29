/**
 * Notification readers — live Postgres, seed array as fallback.
 *
 * Pairs with src/lib/writers/notifications.ts. Reads use the
 * (user_id, created_at DESC) index added in drizzle/0012, which is
 * what makes the unread-count query on every page render cheap.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications as notificationsTable } from "@/db/schema";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import type { Notification } from "@/lib/types";

/** A user's notifications, newest first. */
export async function getNotificationsForUser(
  userId: string,
  limit = 50,
): Promise<Notification[]> {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    return rows as unknown as Notification[];
  } catch {
    return MOCK_NOTIFICATIONS.filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

/**
 * Unread count for the bell badge. Runs on essentially every
 * authenticated page render, so it selects a single column and leans
 * on the composite index rather than pulling rows.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const rows = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt),
        ),
      );
    return rows.length;
  } catch {
    return MOCK_NOTIFICATIONS.filter(
      (n) => n.userId === userId && !n.readAt,
    ).length;
  }
}

/**
 * Drop-in replacements for the mock-data helpers of the same name, so
 * surfaces swap with a one-line import change.
 *
 * These are async where the originals were synchronous — a real query
 * replaces an array filter. Server components await them; the one
 * synchronous consumer (NotificationStrip) takes its rows as a prop
 * from an async parent instead.
 */

/** All of a user's notifications, newest first. */
export async function notificationsForUser(
  userId: string,
): Promise<Notification[]> {
  return getNotificationsForUser(userId);
}

/** Count unread for the nav badge. Runs on every authenticated render. */
export async function unreadNotificationCount(
  userId: string,
): Promise<number> {
  return getUnreadCount(userId);
}

/**
 * Unread notifications narrowed to specific kinds — powers the
 * contextual strips that sit above a surface ("2 bids waiting on you"
 * at the top of the RFP page).
 */
export async function unreadByKind(
  userId: string,
  kinds: Notification["kind"][],
): Promise<Notification[]> {
  const set = new Set(kinds);
  const rows = await getNotificationsForUser(userId, 200);
  return rows.filter((n) => n.readAt === null && set.has(n.kind));
}
