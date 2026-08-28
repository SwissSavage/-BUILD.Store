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
