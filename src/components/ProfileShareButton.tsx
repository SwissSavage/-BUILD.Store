"use client";

/**
 * Small "copy shareable link" affordance on public profiles.
 *
 * Useful for Partners specifically — their profile is private-by-
 * default (no discovery, noindex on direct link), so the way they
 * put it in front of clients is by sharing the URL themselves.
 * Members can use it too; nothing tier-gates this affordance.
 *
 * Copy uses navigator.clipboard when available, falls back to a
 * dummy textarea + document.execCommand for older / restricted
 * environments.
 */
import { useCallback, useState } from "react";

interface ProfileShareButtonProps {
  handle: string;
  className?: string;
}

export function ProfileShareButton({ handle, className }: ProfileShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = `${window.location.origin}/u/${handle}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers / restricted contexts.
        const el = document.createElement("textarea");
        el.value = url;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent failure — the fallback is just leaving the user with the URL visible.
    }
  }, [handle]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
      }
      aria-live="polite"
    >
      {copied ? "✓ Link copied" : "Copy shareable link"}
    </button>
  );
}
