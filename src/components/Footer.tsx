import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--surface-border)] bg-[var(--surface-inset)]">
      <div className="mx-auto grid max-w-app gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="font-display text-lg font-semibold">
            $BUILD<span className="text-brand-magenta">.</span>Store
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            A Future Modern Builderberg LLC cooperative.
          </p>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wider text-ink-muted">Platform</h4>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/" className="hover:text-brand-magenta">Home</Link></li>
            <li><Link href="/about" className="hover:text-brand-magenta">About</Link></li>
            <li><Link href="/showcase" className="hover:text-brand-magenta">Showcase</Link></li>
            <li><Link href="/partners" className="hover:text-brand-magenta">Partners</Link></li>
            <li><Link href="/store" className="hover:text-brand-magenta">Store</Link></li>
            <li><Link href="/jobs" className="hover:text-brand-magenta">Jobs</Link></li>
            <li><Link href="/contracts" className="hover:text-brand-magenta">Open RFPs</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wider text-ink-muted">Pillars</h4>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li>
              <Link
                href="/showcase?pillar=stem"
                className="hover:text-brand-magenta"
              >
                STEM
              </Link>
            </li>
            <li>
              <Link
                href="/showcase?pillar=creative-media"
                className="hover:text-brand-magenta"
              >
                Creative Media
              </Link>
            </li>
            <li>
              <Link
                href="/showcase?pillar=professional-services"
                className="hover:text-brand-magenta"
              >
                Professional Services
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wider text-ink-muted">Connect</h4>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li>
              <a
                href="https://calendly.com/properpreparationism"
                className="hover:text-brand-magenta"
                target="_blank"
                rel="noreferrer"
              >
                Schedule a call
              </a>
            </li>
            <li>
              <Link href="/signup" className="hover:text-brand-magenta">Get started</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--surface-border)]">
        <div className="mx-auto flex max-w-app flex-col items-center gap-3 px-6 py-4 text-xs text-ink-faint sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} Future Modern Builderberg LLC. Sandbox build.</span>
            <Link href="/data-use-policy" className="hover:text-brand-magenta">
              Data Use Policy
            </Link>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wordmark.png"
            alt="Future Modern"
            className="h-6 w-auto opacity-80"
          />
        </div>
      </div>
    </footer>
  );
}
