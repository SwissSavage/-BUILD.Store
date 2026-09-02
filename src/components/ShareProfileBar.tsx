"use client";

/**
 * View + share your own public profile.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * /u/[handle] is the profile clients and the cooperative actually see,
 * and nothing in the app linked to it. A member had no way to look at
 * their own public presence, let alone send it to anyone, unless they
 * happened to guess the URL. Jamar: "I don't think there's any other
 * way for other users to see theirs" and "members need to be able to
 * share their profiles."
 *
 * Direct-link access is unconditional in the visibility matrix, for
 * every tier including Partners outside a recognition window. So
 * sharing this link needs no policy change: it is the one surface that
 * was always meant to be handed out.
 * ─────────────────────────────────────────────────────────────
 */
import { useState } from "react";

export function ShareProfileBar({ handle }: { handle: string }) {
  const path = `/u/${handle}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Built here rather than at render time: window is not available
    // during SSR, and hardcoding the host would break on preview
    // deploys and on localhost.
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, permissions, older
      // browser). Select the text instead of failing silently.
      window.prompt("Copy your profile link:", url);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <a
        href={path}
        className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        View my public profile
      </a>
      <button
        type="button"
        onClick={copy}
        className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm hover:border-brand-magenta hover:text-brand-magenta"
      >
        {copied ? "Link copied" : "Copy share link"}
      </button>
      <span className="text-xs text-ink-faint">
        This is what clients see. Safe to share anywhere.
      </span>
    </div>
  );
}
