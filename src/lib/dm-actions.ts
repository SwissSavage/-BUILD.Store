/**
 * Direct-message server action (Phase 2.6 sandbox, opened 2026-04-27).
 *
 * Posture: any cooperative member (membershipTier === "member") or admin
 * can send a DM to ANY user, regardless of the recipient's tier.
 * Viewers, prospects, and partners can receive (and read from
 * /notifications) but cannot themselves compose. The compose surface
 * never renders for non-members — see `canSendDirectMessage` in
 * `lib/types.ts` for the canonical predicate.
 *
 * The action fires a `direct_message` notification scoped to the
 * recipient. Recipient sees the body in their /notifications inbox;
 * click-through lands them on /notifications (no separate thread
 * surface yet — replies are deferred until we add a `dm_threads` rail).
 *
 * REPLACE WITH: a `direct_messages` Drizzle table + a thread surface,
 * OR keep the notifications-as-DM rail and add a reply server action
 * that fans a `direct_message` back to the original sender.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import { adminName, canSendDirectMessage } from "@/lib/types";
import type { Notification } from "@/lib/types";

function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_dm_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

export async function sendDirectMessage(formData: FormData) {
  const sender = await getCurrentUser();
  if (!sender) throw new Error("Sign in required");
  if (!canSendDirectMessage(sender)) {
    throw new Error(
      "Only cooperative members and admins can send direct messages.",
    );
  }

  const recipientId = String(formData.get("recipientId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  const recipient = MOCK_USERS.find((u) => u.id === recipientId);
  if (!recipient) throw new Error("Recipient not found");
  if (recipient.id === sender.id) {
    throw new Error("You can't DM yourself.");
  }
  if (subject.length === 0 || body.length === 0) {
    throw new Error("Subject and body are required");
  }

  pushNotification({
    userId: recipient.id,
    kind: "direct_message",
    title: `${subject} — from ${adminName(sender)}`,
    body,
    href: "/notifications",
  });

  revalidatePath("/admin/members");
  revalidatePath("/notifications");
  revalidatePath(`/u/${recipient.handle}`);
}
