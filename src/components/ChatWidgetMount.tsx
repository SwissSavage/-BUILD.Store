/**
 * Server-side mount gate for the floating ChatWidget.
 *
 * Only renders the client widget for logged-out visitors. Logged-in
 * members + admins have richer rails (Member↔Member direct messages
 * via dm-actions.ts, notifications, project applications, peer review,
 * etc.) and don't need a public-facing chat surface. The visitor-admin
 * chat lane stays separate from the Member-to-Member peer messaging
 * unlocked 2026-06-29 — different audiences, different rails.
 *
 * Perf posture: the actual widget is client-side (SSE subscription,
 * form state, cookie hydration) and 370+ LOC. We defer its bundle via
 * `next/dynamic` with `ssr: false` — the first paint ships the tiny
 * `ChatWidgetLoader` (a floating button) instead. The real widget
 * hydrates lazily; visitors who never open chat never pay the cost.
 */
import { getCurrentUser } from "@/lib/auth-stub";
import { ChatWidgetLoader } from "@/components/ChatWidgetLoader";

export async function ChatWidgetMount() {
  const user = await getCurrentUser();
  if (user) return null;
  return <ChatWidgetLoader />;
}
