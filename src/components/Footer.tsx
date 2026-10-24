import Link from "next/link";
import { PUBLIC_BOOKING_CTA, PUBLIC_BOOKING_URL } from "@/lib/public-booking";

const FOOTER_GROUPS = [
  {
    title: "Explore",
    links: [
      { href: "/about", label: "About" },
      { href: "/portfolio", label: "Portfolio" },
      { href: "/cohort", label: "Cohort" },
      { href: "/articles", label: "Articles" },
      { href: "/partners", label: "Partners" },
    ],
  },
  {
    title: "Work with us",
    links: [
      { href: "/contracts", label: "Open RFPs" },
      { href: "/jobs", label: "Jobs" },
      { href: "/store", label: "Store" },
      { href: "/signup", label: "Get started" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Cooperative",
    links: [
      { href: "/portfolio?pillar=stem", label: "STEM" },
      { href: "/portfolio?pillar=creative-media", label: "Creative Media" },
      { href: "/portfolio?pillar=professional-services", label: "Professional Services" },
      { href: "/trust", label: "Trust & security" },
      { href: "/governance", label: "Governance" },
    ],
  },
] as const;

const linkClassName = "hover:text-brand-magentaText";

export function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-[var(--surface-border)] bg-[var(--surface-inset)]">
      {/* Decorative watermark: intentionally absent on compact screens. */}
      <img
        aria-hidden="true"
        src="/brand/footer-turtle-watermark.png"
        alt=""
        className="pointer-events-none absolute -bottom-56 -left-44 hidden h-[42rem] w-auto select-none md:block"
      />

      <div className="relative z-10 mx-auto grid max-w-app gap-x-8 gap-y-10 px-6 py-20 md:grid-cols-5 md:py-24">
        <div className="md:col-span-2 md:pr-12">
          <Link href="/" className="font-display text-3xl font-semibold tracking-tight hover:text-brand-magentaText">
            $BUILD<span className="text-brand-magentaText">.</span>Store
          </Link>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
            A Future Modern Builderberg LLC cooperative.
          </p>
          <a
            href={PUBLIC_BOOKING_URL}
            className="mt-6 inline-block text-base font-medium text-brand-blueText hover:text-brand-magentaText"
            target="_blank"
            rel="noreferrer"
          >
            {PUBLIC_BOOKING_CTA} →
          </a>
        </div>

        {FOOTER_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{group.title}</h2>
            <ul className="mt-4 space-y-3 text-base">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative z-10 border-t border-[var(--surface-border)]">
        <div className="mx-auto flex max-w-app flex-col items-center gap-3 px-6 py-4 text-xs text-ink-faint sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} Future Modern Builderberg LLC. Sandbox build.</span>
            <Link href="/data-use-policy" className={linkClassName}>
              Data use
            </Link>
            <Link href="/policies" className={linkClassName}>
              Policies
            </Link>
            <Link href="/policies/privacy" className={linkClassName}>
              Privacy
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
