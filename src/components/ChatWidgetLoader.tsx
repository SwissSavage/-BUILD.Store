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
 * The button styling matches the collapsed state of the full widget so
 * there's no visual pop when the real component hydrates in.
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
