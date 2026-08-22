/**
 * ProfileMenu — avatar-triggered dropdown consolidating every
 * personal-scope surface (Rob beta note #2, task #60).
 *
 * Groups these behind the user's avatar so the top nav row stays
 * focused on discovery + platform-wide surfaces:
 *   - Profile (edit)
 *   - Notifications (bell — was called "Inbox" in the old flat nav)
 *   - Locker
 *   - Wallet
 *   - Signed agreements (anchor to /profile#agreements)
 *   - Open agreements — pending signature (Documenso in-flight)
 *   - Current jobs / Completed jobs (/projects filtered)
 *   - Sign out
 *
 * Native <details>/<summary> for progressive enhancement — matches
 * StoreDropdown / JobsDropdown so we don't need client JS for the
 * open/close behavior.
 */
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";
import type { User } from "@/lib/types";

interface ProfileMenuProps {
  user: User;
  unreadNotificationCount: number;
}

interface MenuItem {
  href: string;
  label: string;
  blurb?: string;
  icon?: string; // simple emoji/glyph — Rob asked for a bell on notifications
  badge?: number;
}

export function ProfileMenu({
  user,
  unreadNotificationCount,
}: ProfileMenuProps) {
  const items: MenuItem[] = [
    {
      href: "/profile",
      label: "Profile",
      blurb: "Edit your name, tagline, skills, portfolio.",
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: "🔔",
      blurb: "Activity, mentions, and system pings.",
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
    },
    {
      href: "/locker",
      label: "Locker",
      blurb: "Your media assets, uploads, and in-review submissions.",
    },
    {
      href: "/wallet",
      label: "Wallet",
      blurb: "$BUILD balance, payout method, transaction ledger.",
    },
    {
      href: "/profile#agreements",
      label: "Signed agreements",
      blurb: "Every LOI, Agreement, and receipt you've signed.",
    },
    {
      href: "/profile#open-agreements",
      label: "Open agreements",
      blurb: "Pending your signature — complete in-app or download.",
    },
    {
      href: "/projects?status=active",
      label: "Current jobs",
      blurb: "Contracts and projects in flight.",
    },
    {
      href: "/projects?status=completed",
      label: "Completed jobs",
      blurb: "Wrapped work and case studies.",
    },
  ];

  return (
    <details className="relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 select-none",
          "rounded-full transition-opacity hover:opacity-80",
        )}
        aria-label="Open your account menu"
      >
        <span className="relative inline-block">
          <Avatar user={user} size="sm" />
          {unreadNotificationCount > 0 && (
            // Red dot on the avatar corner — a subtle unread cue that
            // matches Rob's "notifications live under the profile"
            // model. Keeps the top nav row uncluttered.
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-brand-magenta"
            />
          )}
        </span>
        <span aria-hidden="true" className="text-[10px] text-ink-muted">
          ▾
        </span>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2 text-sm shadow-lg">
        {/* Small header so the user knows who they're signed in as —
            useful especially during admin view-as. */}
        <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-[var(--surface-inset)] px-3 py-2">
          <Avatar user={user} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {user.firstName ?? user.handle}
              {user.lastName && ` ${user.lastName[0]}.`}
            </div>
            <div className="truncate text-[11px] text-ink-faint">
              @{user.handle}
            </div>
          </div>
        </div>

        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
          >
            <span className="flex items-center gap-2 font-medium">
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-magenta px-1.5 text-[10px] font-medium leading-4 text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </span>
            {item.blurb && (
              <span className="mt-0.5 block text-[11px] text-ink-faint">
                {item.blurb}
              </span>
            )}
          </Link>
        ))}

        <div className="my-1 border-t border-[var(--surface-border)]" />

        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-muted hover:bg-[var(--surface-inset)] hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
