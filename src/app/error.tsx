/**
 * Route-level error boundary.
 *
 * Required by Next.js App Router — catches errors thrown from any
 * route segment beneath the app root. Must be a Client Component and
 * must expose a `reset` handler so the user can retry without
 * navigating away.
 *
 * Kept minimal: FM brand-aligned but no attempt to recover the
 * underlying route. Production adds a "report incident" trigger that
 * writes to the audit log (planned per compliance CC7.3).
 */
"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side error digest surfaces in the terminal + production logs.
    // Client-side console captures the local trace.
    // eslint-disable-next-line no-console
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-8">
        <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
          Something broke
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          The route hit an error
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The cooperative didn&apos;t serve this one. Retry the request
          or head back home.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-faint">
            Digest: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
          >
            Retry
          </button>
          <Link
            href="/"
            className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
