/**
 * Server-side mount gate for the floating ChatWidget.
 *
 * Only renders the client widget for logged-out visitors. Logged-in
 * members + admins have richer rails (notifications, project
 * applications, peer review, etc.) and don't need a public-facing
 * chat surface; opening this lane to members would also cross-cut the
 * messaging-posture rule (no peer-to-peer messaging by design).
 */
import { getCurrentUser } from "@/lib/auth-stub";
import { ChatWidget } from "@/components/ChatWidget";

export async function ChatWidgetMount() {
  const user = await getCurrentUser();
  if (user) return null;
  return <ChatWidget />;
}
