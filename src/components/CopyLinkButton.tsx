"use client";

/**
 * The link, in full, one click from the clipboard.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-07)
 *
 * The client magic-link was rendered as the bare path
 * "/quotes/q_dd365d68-..." in a code block. Nothing to click, no
 * origin, and an admin about to send a proposal had to know to
 * prepend the site's domain by hand. The one place in the product
 * where a URL is the deliverable was the one place it was not a URL.
 *
 * Uses the Web Share sheet where the browser has one, which on a phone
 * is how a link actually reaches someone, and falls back to copying.
 * Both paths are wrapped: a denied clipboard permission or a cancelled
 * share sheet must not look like a failure.
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from "react";

export function CopyLinkButton({
  url,
  label = "Copy link",
  shareTitle,
}: {
  url: string;
  label?: string;
  shareTitle?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function handle() {
    // The share sheet, when there is one. A cancelled share throws
    // AbortError, which is a decision rather than a failure, so it
    // falls through to copy rather than reporting a problem.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 4000);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handle}
        className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] font-medium hover:border-brand-magenta hover:text-brand-magentaText"
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Select it below" : label}
      </button>
      {state === "failed" && (
        <span className="text-[10px] text-ink-faint">
          The browser blocked the clipboard. The full link is below.
        </span>
      )}
    </div>
  );
}
