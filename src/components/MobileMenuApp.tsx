"use client";

/**
 * Mobile menu for the auth-side (app) nav.
 *
 * The auth Nav has two branches (logged-in with 10+ links + admin
 * dropdown, or logged-out with the marketing link set). This mobile
 * counterpart renders the same information as a stacked drawer,
 * gated by auth props passed from the server Nav.
 *
 * Auth data arrives as serialized props (isLoggedIn / isAdmin / isEpk
 * / unread) so the server Nav stays server-rendered while the drawer
 * stays interactive. Admin dropdown items get flattened into a labeled
 * section — mobile users don't get the view-as picker (that's a
 * desktop-only admin power tool). Sign-out uses the same server action
 * as the desktop button.
 *
 * Client component because it holds `open` state + the sign-out form.
 */

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";

interface MobileMenuAppProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  isEpk: boolean;
  unread: number;
}

const memberLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/contracts", label: "Contracts" },
  { href: "/projects", label: "Projects" },
  { href: "/wallet", label: "Wallet" },
  { href: "/store", label: "Store" },
  { href: "/orders", label: "Orders" },
  { href: "/showcase", label: "Showcase" },
  { href: "/locker", label: "Locker" },
];

const publicLinks = [
  { href: "/about", label: "About" },
  { href: "/store", label: "Store" },
  { href: "/showcase", label: "Showcase" },
  { href: "/cohort", label: "Cohort" },
  { href: "/articles", label: "Articles" },
  { href: "/partners", label: "Partners" },
  { href: "/whitelist", label: "Whitelist" },
];

const publicAuthLinks = [
  { href: "/signup/join", label: "Join as talent" },
  { href: "/signin", label: "Sign in" },
];

const adminLinks = [
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Admin home" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/projects", label: "All projects" },
  { href: "/admin/projects/applications", label: "Project applications" },
  { href: "/admin/projects/contributions", label: "Outside contributors" },
  { href: "/admin/chat", label: "Live chat" },
  { href: "/admin/cohort", label: "Cohort spotlights" },
  { href: "/admin/cooperative-quotes", label: "Cooperative quotes" },
  { href: "/admin/receipts", label: "Cooperative receipts" },
  { href: "/admin/feedback", label: "Beta feedback" },
  { href: "/admin/testimonials", label: "Customer testimonials" },
  { href: "/admin/epk", label: "EPK approvals" },
  { href: "/admin/categories", label: "Store categories" },
  { href: "/admin/locker", label: "Locker moderation" },
];

export function MobileMenuApp({
  isLoggedIn,
  isAdmin,
  isEpk,
  unread,
}: MobileMenuAppProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
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
        {/* Notification dot on the hamburger so unread state is visible
            before the user opens the menu. Only shows for logged-in
            users with unread notifications. */}
        {isLoggedIn && unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 inline-block h-2 w-2 rounded-full bg-brand-magenta"
          />
        )}
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

          <div className="flex-1 overflow-y-auto px-6 py-8">
            {isLoggedIn ? (
              <>
                {/* Member section */}
                <ul className="space-y-1 text-lg">
                  {memberLinks.map((item) => (
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
                  <li>
                    <Link
                      href="/notifications"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg px-4 py-3 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      <span>Inbox</span>
                      {unread > 0 && (
                        <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand-magenta px-2 text-xs font-medium text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Link>
                  </li>
                  {!isAdmin && (
                    <li>
                      <Link
                        href="/profile"
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-4 py-3 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        Profile
                      </Link>
                    </li>
                  )}
                  {!isAdmin && isEpk && (
                    <li>
                      <Link
                        href="/profile/epk"
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-4 py-3 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        EPK
                      </Link>
                    </li>
                  )}
                </ul>

                {/* Admin section — flat list, not a nested dropdown */}
                {isAdmin && (
                  <>
                    <div className="my-6 border-t border-[var(--surface-border)]" />
                    <p className="px-4 pb-2 text-[11px] uppercase tracking-wider text-brand-magenta">
                      Admin
                    </p>
                    <ul className="space-y-1 text-base">
                      {adminLinks.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="block rounded-lg px-4 py-2.5 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 px-4 text-[10px] text-ink-faint">
                      &ldquo;View site as&rdquo; picker is desktop-only.
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Public section */}
                <ul className="space-y-1 text-lg">
                  {publicLinks.map((item) => (
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
                  {publicAuthLinks.map((item) => (
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
              </>
            )}
          </div>

          {/* Bottom action — sign out for logged-in, $BUILD a team CTA
              for logged-out. Money button gets the loudest treatment
              regardless of stage. */}
          <div className="border-t border-[var(--surface-border)] px-6 py-4">
            {isLoggedIn ? (
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-full border border-[var(--surface-border)] px-5 py-3 text-center text-sm font-medium text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="block rounded-full bg-brand-magenta px-5 py-3 text-center text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
              >
                $BUILD a team
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
