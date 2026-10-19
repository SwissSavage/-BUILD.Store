/**
 * Deployment-context notice.
 *
 * This is deliberately server-gated: a production visitor never receives the
 * markup unless the deployment explicitly sets DEV_BUILD=true.
 */
export function DevelopmentBuildBanner() {
  if (process.env.DEV_BUILD?.trim().toLowerCase() !== "true") {
    return null;
  }

  const notice = "Development build — not production";

  return (
    <div
      className="sticky top-0 z-50 h-7 overflow-hidden border-b border-brand-magenta/60 bg-[var(--surface-elevated)] text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--fm-magenta-text)]"
      role="status"
      aria-label={notice}
    >
      <span className="sr-only">{notice}</span>
      <div className="fm-development-build-marquee" aria-hidden="true">
        <span className="fm-development-build-marquee-copy">
          {notice} <span className="mx-8 text-ink-faint">•</span>
          Test data may change <span className="mx-8 text-ink-faint">•</span>
        </span>
        <span className="fm-development-build-marquee-copy">
          {notice} <span className="mx-8 text-ink-faint">•</span>
          Test data may change <span className="mx-8 text-ink-faint">•</span>
        </span>
      </div>
    </div>
  );
}
