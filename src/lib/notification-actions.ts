/**
 * Notification server actions.
 *
 * Writer swap 2026-08-28: these mutated MOCK_NOTIFICATIONS in memory,
 * so "mark read" un-marked itself on the next deploy and the unread
 * badge never actually went down for good.
 *
 * userId comes from the session, never the form, so a member can't
 * acknowledge someone else's inbox by hand-crafting a POST. The
 * ownership check is part of the WHERE clause rather than a separate
 * read-then-write, which closes the race where two requests both pass
 * the check before either writes.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  CONTEXTUAL_NOTIFICATION_KINDS,
  type ContextualNotificationArea,
} from "@/lib/contextual-notifications";

export async function markNotificationRead(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "/notifications");

  if (id) {
    await db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.id, id),
          // Ownership enforced in the query. A notification belonging
          // to someone else simply matches zero rows.
          eq(notifications.userId, user.id),
          isNull(notifications.readAt),
        ),
      );
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");

  if (next && next !== "/notifications") {
    redirect(next);
  }
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
      ),
    );

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

/** Mark only the category a member has just opened as read. */
export async function markContextualNotificationsRead(
  area: ContextualNotificationArea,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");

  const kinds = CONTEXTUAL_NOTIFICATION_KINDS[area];
  if (!kinds) throw new Error("Unknown notification area");

  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
        inArray(notifications.kind, kinds),
      ),
    );

  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}
