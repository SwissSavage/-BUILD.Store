import Link from "next/link";
import { Facebook, Github, Linkedin } from "lucide-react";
import { PUBLIC_BOOKING_CTA, PUBLIC_BOOKING_URL } from "@/lib/public-booking";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

type FooterGroup = {
  title: string;
  links: FooterLink[];
};

const FOOTER_GROUPS: FooterGroup[] = [
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
      { href: PUBLIC_BOOKING_URL, label: PUBLIC_BOOKING_CTA, external: true },
      { href: "/jobs", label: "Jobs" },
      { href: "/store", label: "Store" },
      { href: "/signup", label: "Get started" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Future Modern",
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
    <footer
      className="relative mt-32 overflow-hidden border-t border-[var(--surface-border)] bg-[var(--surface-inset)]"
      style={{
        background:
          "radial-gradient(ellipse at 0% 100%, rgba(255,255,255,0.035), transparent 38%), var(--surface-inset)",
      }}
    >
      {/* Decorative watermark: intentionally absent on compact screens. */}
      <img
        aria-hidden="true"
        src="/brand/footer-turtle-watermark.png"
        alt=""
        className="pointer-events-none absolute -bottom-[25rem] -left-44 hidden h-[42rem] w-auto origin-bottom-left rotate-[12deg] select-none md:block"
      />

      <div className="relative z-10 mx-auto grid max-w-[1500px] gap-x-10 gap-y-12 px-6 py-20 md:grid-cols-5 md:pb-28 md:pt-40">
        <div className="md:col-span-2 md:pr-12">
          <Link href="/" className="font-display text-5xl font-semibold tracking-tight hover:text-brand-magentaText">
            $BUILD<span className="text-brand-magentaText">.</span>Store
          </Link>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
            $BUILD.Store is where Future Modern organizes, staffs, and
            delivers work.
          </p>
          <Link
            href="/portfolio"
            className="mt-7 inline-block text-lg font-medium text-brand-blueText hover:text-brand-magentaText"
          >
            Explore our work →
          </Link>
        </div>

        {FOOTER_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{group.title}</h2>
            <ul className="mt-6 space-y-4 text-lg text-ink-muted">
              {group.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      className={linkClassName}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClassName}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px] px-6">
        <div className="flex flex-col items-center gap-5 border-t border-[var(--surface-border)] py-6 text-sm text-ink-muted sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>© {new Date().getFullYear()} $BUILD.Store · Future Modern Builderberg LLC. All rights reserved.</span>
            <Link href="/data-use-policy" className={linkClassName}>
              Data use
            </Link>
            <Link href="/policies" className={linkClassName}>
              Policies
            </Link>
            <Link href="/policies/privacy" className={linkClassName}>
              Privacy
            </Link>
            <Link href="/policies/covenant" className={linkClassName}>
              Covenant
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/SwissSavage/-BUILD.Store"
              aria-label="$BUILD.Store on GitHub"
              className={linkClassName}
              target="_blank"
              rel="noreferrer"
            >
              <Github aria-hidden="true" size={20} strokeWidth={1.75} />
            </a>
            <a
              href="https://www.facebook.com/afuturemodern/"
              aria-label="Future Modern on Facebook"
              className={linkClassName}
              target="_blank"
              rel="noreferrer"
            >
              <Facebook aria-hidden="true" size={20} strokeWidth={1.75} />
            </a>
            <a
              href="https://www.linkedin.com/company/future-modern"
              aria-label="Future Modern on LinkedIn"
              className={linkClassName}
              target="_blank"
              rel="noreferrer"
            >
              <Linkedin aria-hidden="true" size={20} strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
