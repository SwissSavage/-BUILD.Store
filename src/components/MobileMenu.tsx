"use client";

/**
 * Mobile menu for the marketing (public) nav.
 *
 * Visible only on mobile (via `md:hidden` on the wrapper in PublicNav).
 * Renders a hamburger button; tapping it opens a full-screen drawer
 * with the links stacked vertically + primary CTA fixed at the bottom.
 *
 * Escape hatches: X close button in the drawer header, backdrop click
 * (the whole drawer is opaque so backdrop-click isn't relevant here —
 * user closes via X or by tapping a link, which navigates away).
 *
 * Client component because it holds `open` state. Kept small — no
 * external deps, no animation library, just useState + inline SVG.
 */

import { useState } from "react";
import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/store", label: "Store" },
  { href: "/showcase", label: "Showcase" },
  { href: "/cohort", label: "Cohort" },
  { href: "/articles", label: "Articles" },
  { href: "/partners", label: "Partners" },
  { href: "/whitelist", label: "Whitelist" },
];

const authLinks = [
  { href: "/signup/join", label: "Join as talent" },
  { href: "/signin", label: "Sign in" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-md p-2 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Drawer header — logo + close button */}
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight"
              aria-label="Future Modern home"
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
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-md p-2 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6l12 12M6 18L18 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable link list */}
          <nav className="flex-1 overflow-y-auto px-6 py-8">
            <ul className="space-y-1 text-lg">
              {links.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-4 py-3 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="my-6 border-t border-[var(--surface-border)]" />

            <ul className="space-y-1 text-lg">
              {authLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-4 py-3 text-ink-muted transition-colors hover:bg-[var(--surface-elevated)] hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Primary CTA pinned to bottom — this is the money button, it
              gets the loudest treatment even on mobile. */}
          <div className="border-t border-[var(--surface-border)] px-6 py-4">
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="block rounded-full bg-brand-magenta px-5 py-3 text-center text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              $BUILD a team
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
