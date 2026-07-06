/**
 * Marketing navigation. Static server component — no auth reads, no
 * cookie access, no dynamic dependencies. Renders identically for every
 * visitor.
 *
 * This is the (public) route group's counterpart to the auth-aware Nav
 * used inside (app). Splitting them lets the marketing surfaces render
 * statically at the edge instead of paying a Node-handler cost per
 * request to check "is this visitor signed in?" that they don't need.
 *
 * Design source is the logged-out branch of the original Nav — same
 * links, same marquee, same $BUILD.Store logo treatment.
 */
import Link from "next/link";
import { StoreDropdown } from "@/components/StoreDropdown";

const navLink = "text-ink-muted hover:text-ink transition-colors";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--surface-border)] bg-[var(--surface)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-app items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          aria-label="Future Modern — home"
          className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/turtle.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 object-contain"
          />
          <span>
            $BUILD<span style={{ color: "#D828A0" }}>.</span>Store
          </span>
        </Link>

        <div className="hidden flex-1 overflow-hidden md:block">
          <div className="marquee whitespace-nowrap text-xs text-ink-muted">
            <span className="px-8">world-$BUILDing people+products.</span>
            <span className="px-8">world-$BUILDing people+products.</span>
            <span className="px-8">world-$BUILDing people+products.</span>
            <span className="px-8">world-$BUILDing people+products.</span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/about" className={navLink}>
            About
          </Link>
          <StoreDropdown />
          <Link href="/showcase" className={navLink}>
            Showcase
          </Link>
          <Link href="/articles" className={navLink}>
            Articles
          </Link>
          <Link href="/partners" className={navLink}>
            Partners
          </Link>
          <Link href="/whitelist" className={navLink}>
            Whitelist
          </Link>
          {/* Talent application is a quiet text link — the contributor
              path is real but earned-by-vouch by default; the loud CTA
              stays on the client side ($BUILD a team) where the
              revenue is. */}
          <Link href="/signup/join" className={navLink}>
            Join as talent
          </Link>
          <Link href="/signin" className={navLink}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white"
          >
            $BUILD a team
          </Link>
        </nav>
      </div>
    </header>
  );
}
