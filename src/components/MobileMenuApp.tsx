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

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, Menu, X } from "lucide-react";
import { adminNavGroups } from "@/lib/admin-nav";
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
  { href: "/store", label: "Store" },
  { href: "/orders", label: "Orders" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/community", label: "Community" },
];

const accountLinks = [
  { href: "/profile", label: "Profile" },
  { href: "/locker", label: "Locker" },
  { href: "/wallet", label: "Wallet" },
  { href: "/profile/edit/paperwork", label: "Signed agreements" },
  { href: "/profile/edit/paperwork", label: "Open agreements" },
];

const publicLinks = [
  { href: "/about", label: "About" },
  { href: "/store", label: "Store" },
  { href: "/jobs", label: "Jobs" },
  { href: "/contracts", label: "Contracts" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/community", label: "Community" },
  { href: "/cohort", label: "Cohort" },
  { href: "/articles", label: "Articles" },
  { href: "/partners", label: "Partners" },
  { href: "/whitelist", label: "Whitelist" },
];

const publicAuthLinks = [
  { href: "/signup/join", label: "Join as talent" },
  { href: "/signin", label: "Sign in" },
];

/**
 * Admin home plus every destination in ADMIN_NAV, grouped the same way
 * the desktop dropdown groups them. This used to be a fourth
 * hand-maintained list and had drifted to 23 of 49 destinations, with
 * /admin/inbound missing from it.
 */
const adminSections = adminNavGroups();

export function MobileMenuApp({
  isLoggedIn,
  isAdmin,
  isEpk,
  unread,
}: MobileMenuAppProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
      >
        <Menu aria-hidden="true" size={24} strokeWidth={1.6} />
        {/* Notification dot on the hamburger so unread state is visible
            before the user opens the menu. Only shows for logged-in
            users with unread notifications. */}
        {isLoggedIn && unread > 0 && (
          <span
            aria-hidden
            className="fm-btn-primary absolute right-1.5 top-1.5 inline-block h-2 w-2 rounded-full"
          />
        )}
      </button>

      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            onCancel={(event) => {
              event.preventDefault();
              closeMenu();
            }}
            onClose={closeMenu}
            aria-label="Navigation menu"
            className="fixed inset-0 m-0 flex h-[100dvh] w-screen max-h-none max-w-none flex-col overflow-hidden border-0 bg-[var(--surface)] p-0 text-ink outline-none"
          >
          {/* Native dialog puts the menu in the browser's top layer.
              The Nav header has backdrop-filter, which otherwise turns a
              fixed child into a header-sized overlay on mobile. */}
          {/* Drawer header — logo + close button */}
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
            <Link
              href="/"
              onClick={closeMenu}
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
                $BUILD<span style={{ color: "var(--fm-magenta-text)" }}>.</span>Store
              </span>
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              autoFocus
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-md p-2 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
            >
              <X aria-hidden="true" size={24} strokeWidth={1.6} />
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
                        onClick={closeMenu}
                        className="block rounded-lg px-4 py-3 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/notifications"
                      onClick={closeMenu}
                      className="flex items-center justify-between rounded-lg px-4 py-3 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Bell aria-hidden="true" size={18} strokeWidth={1.6} />
                        Notifications
                      </span>
                      {unread > 0 && (
                        <span className="fm-btn-primary inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-medium">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Link>
                  </li>
                </ul>

                <div className="my-6 border-t border-[var(--surface-border)]" />
                <h2 className="px-4 pb-2 text-sm font-medium text-ink-muted">
                  Account
                </h2>
                <ul className="space-y-1 text-base">
                  {accountLinks.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        className="block rounded-lg px-4 py-2.5 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  {isEpk && (
                    <li>
                      <Link
                        href="/profile/epk"
                        onClick={closeMenu}
                        className="block rounded-lg px-4 py-2.5 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
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
                    <h2 className="px-4 pb-2 text-sm font-medium text-ink-muted">
                      Admin
                    </h2>
                    <ul className="space-y-1 text-base">
                      <li>
                        <Link
                          href="/admin"
                          onClick={closeMenu}
                          className="block rounded-lg px-4 py-2.5 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                        >
                          Admin home
                        </Link>
                      </li>
                    </ul>
                    {adminSections.map((section) => (
                      <div key={section.group} className="mt-4">
                        <h3 className="px-4 pb-1 text-[11px] uppercase tracking-wider text-ink-faint">
                          {section.label}
                        </h3>
                        <ul className="space-y-1 text-base">
                          {section.entries.map((entry) => (
                            <li key={entry.href}>
                              <Link
                                href={entry.href}
                                onClick={closeMenu}
                                className="block rounded-lg px-4 py-2.5 text-ink transition-colors hover:bg-[var(--surface-elevated)]"
                              >
                                {entry.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
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
                        onClick={closeMenu}
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
                        onClick={closeMenu}
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
                onClick={closeMenu}
                className="fm-btn-primary block rounded-full px-5 py-3 text-center text-sm font-medium shadow-lg shadow-brand-magenta/20 transition-colors"
              >
                $BUILD a team
              </Link>
            )}
          </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
