"use client";
import { Button } from "@/components/Button";

/**
 * ChatWidgetLoader — lazy shell for the visitor chat widget.
 *
 * Perf posture:
 *   - First paint ships only this component (small — floating button +
 *     one useState).
 *   - The real ChatWidget (~370 LOC + SSE hook + form state) is
 *     imported via `next/dynamic` with `ssr: false` and only when the
 *     visitor clicks the button.
 *   - Result: public landing page carries no chat-JS until the visitor
 *     actually wants chat. Since >99% of visitors never open it, this
 *     is a straight bundle-size win on first paint.
 *
 * Route-group posture:
 *   - Rendered by (public)/layout.tsx only. Marketing surfaces are the
 *     only place a floating visitor chat makes sense — inside (app),
 *     Members already have DM, notifications, and admin channels.
 *   - A logged-in Member wandering into /about will see the button.
 *     Acceptable: those pages exist for external audiences, and the
 *     Member can ignore it. Route-group split intentionally trades a
 *     rare edge case for edge-static rendering.
 */
import { useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";

const ChatWidget = dynamic(
  () => import("@/components/ChatWidget").then((mod) => ({ default: mod.ChatWidget })),
  {
    ssr: false,
    loading: () => null,
  },
);

export function ChatWidgetLoader() {
  const [opened, setOpened] = useState(false);

  if (opened) {
    return <ChatWidget />;
  }

  return (
    <Button
      type="button"
      onClick={() => setOpened(true)}
      className="fm-btn-primary fm-chat-launcher fixed bottom-6 right-0 z-40 size-12 p-0 shadow-lg shadow-brand-magenta/25"
      aria-label="Open chat with the cooperative"
    >
      <MessageCircle aria-hidden="true" size={21} strokeWidth={1.8} />
    </Button>
  );
}
