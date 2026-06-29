/**
 * Notification server actions (Phase 2.4 sandbox).
 *
 * Mark-read mutations on MOCK_NOTIFICATIONS. Same shape the production
 * Drizzle-backed handlers will take — userId comes from the session,
 * not the form, so a member can't ack someone else's inbox.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";

export async function markNotificationRead(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "/notifications");
  const entry = MOCK_NOTIFICATIONS.find(
    (n) => n.id === id && n.userId === user.id,
  );
  if (entry && entry.readAt === null) {
    entry.readAt = new Date().toISOString();
  }
  revalidatePath("/notifications");
  if (next && next !== "/notifications") {
    redirect(next);
  }
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const now = new Date().toISOString();
  for (const n of MOCK_NOTIFICATIONS) {
    if (n.userId === user.id && n.readAt === null) {
      n.readAt = now;
    }
  }
  revalidatePath("/notifications");
}
