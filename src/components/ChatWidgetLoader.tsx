"use client";

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
    <button
      type="button"
      onClick={() => setOpened(true)}
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand-magenta px-4 py-3 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/25 transition-colors hover:bg-brand-magenta/90"
      aria-label="Open chat"
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full bg-brand-white"
      />
      Chat with us
    </button>
  );
}
