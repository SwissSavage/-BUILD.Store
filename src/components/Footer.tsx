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
      className="relative mt-16 bg-[var(--surface-inset)]"
      style={{
        background:
          "radial-gradient(ellipse at 0% 100%, rgba(255,255,255,0.05), transparent 40%), var(--surface-inset)",
      }}
    >
      <div className="relative overflow-hidden">
        {/* Decorative watermark: intentionally absent on compact screens. */}
        <img
          aria-hidden="true"
          src="/brand/footer-turtle-watermark.png"
          alt=""
          className="pointer-events-none absolute -left-[34rem] top-[26rem] hidden h-[42rem] w-auto origin-bottom-left rotate-[12deg] select-none md:block"
        />

        <div className="relative z-10 mx-auto grid w-full gap-x-10 gap-y-12 px-[7%] py-16 md:min-h-[52rem] md:grid-cols-[1.65fr_1fr_1fr_1fr] md:pb-32 md:pt-48">
          <div className="md:pr-12">
            <Link href="/" className="font-display text-5xl font-semibold tracking-tight hover:text-brand-magentaText">
            $BUILD<span className="text-brand-magentaText">.</span>Store
            </Link>
            <p className="mt-5 max-w-xs text-lg leading-relaxed text-ink-muted">
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
              <ul className="mt-6 space-y-5 text-lg text-ink-muted">
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
      </div>

      <div className="mx-[3.5%] border-t border-[var(--surface-border)]">
        <div className="flex flex-col gap-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} $BUILD.Store · A creative technology cooperative. All rights reserved.</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/policies/privacy" className={linkClassName}>
              Privacy
            </Link>
            <Link href="/policies" className={linkClassName}>
              Terms
            </Link>
            <Link href="/policies/covenant" className={linkClassName}>
              Code of conduct
            </Link>
            <span aria-hidden="true" className="h-5 border-l border-[var(--surface-border)]" />
            <a
              href="https://github.com/SwissSavage/-BUILD.Store"
              aria-label="$BUILD.Store on GitHub"
              className={`${linkClassName} text-ink`}
              target="_blank"
              rel="noreferrer"
            >
              <Github aria-hidden="true" size={22} strokeWidth={1.75} />
            </a>
            <a
              href="https://www.facebook.com/afuturemodern/"
              aria-label="Future Modern on Facebook"
              className={`${linkClassName} text-ink`}
              target="_blank"
              rel="noreferrer"
            >
              <Facebook aria-hidden="true" size={22} strokeWidth={1.75} />
            </a>
            <a
              href="https://www.linkedin.com/company/future-modern"
              aria-label="Future Modern on LinkedIn"
              className={`${linkClassName} text-ink`}
              target="_blank"
              rel="noreferrer"
            >
              <Linkedin aria-hidden="true" size={22} strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
