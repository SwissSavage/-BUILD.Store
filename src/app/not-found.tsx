/**
 * Root not-found handler.
 *
 * Catches unmatched routes app-wide. Server Component — no interactive
 * bits needed.
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-8">
        <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          This route isn&apos;t in the cooperative
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          Might have been renamed, or was never there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
          >
            Home
          </Link>
          <Link
            href="/showcase"
            className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
          >
            Showcase
          </Link>
        </div>
      </div>
    </div>
  );
}
