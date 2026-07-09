/**
 * Top navigation. Server component — reads session from auth-stub.
 *
 * Shape:
 *   - logged-out: home link + signup CTA
 *   - logged-in (member): dashboard, projects, wallet, showcase, profile
 *   - admin flag adds: an Admin dropdown with quick links + a
 *     "View site as" picker (Viewer / one user per membership tier /
 *     other admins). Picks land via the `viewAsUser` server action;
 *     the persistent ViewingAsBanner lives above this header and lets
 *     the admin flip back.
 *
 * Marquee banner stays as a Future Modern signature.
 */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";
import { signOut, viewAsUser } from "@/lib/auth-actions";
import { cn } from "@/lib/cn";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { unreadNotificationCount } from "@/lib/mock-data/notifications";
import {
  TIER_LABELS,
  adminName,
  type MembershipTier,
  type User,
} from "@/lib/types";
import { StoreDropdown } from "@/components/StoreDropdown";

const VIEW_AS_TIER_ORDER: MembershipTier[] = [
  "prospect",
  "partner",
  "member",
];

/**
 * Pick one representative mock user per membership tier (skipping the
 * admin themselves). Sorted by id so the same user surfaces every time
 * the dropdown renders, even as MOCK_USERS grows.
 */
function pickViewAsTargets(self: User): {
  byTier: Array<{ tier: MembershipTier; user: User }>;
  otherAdmins: User[];
} {
  const sorted = [...MOCK_USERS].sort((a, b) => a.id.localeCompare(b.id));
  const byTier = VIEW_AS_TIER_ORDER.flatMap((tier) => {
    const u = sorted.find(
      (x) => x.id !== self.id && x.membershipTier === tier && !x.isAdmin,
    );
    return u ? [{ tier, user: u }] : [];
  });
  const otherAdmins = sorted.filter((u) => u.isAdmin && u.id !== self.id);
  return { byTier, otherAdmins };
}

export async function Nav() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const unread = isLoggedIn ? unreadNotificationCount(user!.id) : 0;

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
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className={navLink}>Dashboard</Link>
              <Link href="/jobs" className={navLink}>Jobs</Link>
              <Link href="/contracts" className={navLink}>Contracts</Link>
              <Link href="/projects" className={navLink}>Projects</Link>
              <Link href="/wallet" className={navLink}>Wallet</Link>
              <StoreDropdown />
              <Link href="/orders" className={navLink}>Orders</Link>
              <Link href="/showcase" className={navLink}>Showcase</Link>
              <Link href="/locker" className={navLink}>Locker</Link>
              <Link
                href="/notifications"
                className={cn(navLink, "relative inline-flex items-center")}
                aria-label={
                  unread > 0
                    ? `Notifications — ${unread} unread`
                    : "Notifications"
                }
              >
                Inbox
                {unread > 0 && (
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-magenta px-1.5 text-[10px] font-medium leading-4 text-white"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              {/* Non-admin members keep Profile in the row. For admins,
                  Profile lives as the first item inside the Admin
                  dropdown to keep the row scannable. Artists (profileMode
                  "epk") get a dedicated EPK editor link. */}
              {!user!.isAdmin && (
                <Link href="/profile" className={navLink}>Profile</Link>
              )}
              {!user!.isAdmin && user!.profileMode === "epk" && (
                <Link href="/profile/epk" className={navLink}>EPK</Link>
              )}
              {user!.isAdmin && <AdminDropdown self={user!} />}
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-elevated)]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/about" className={navLink}>About</Link>
              <StoreDropdown />
              <Link href="/showcase" className={navLink}>Showcase</Link>
              <Link href="/partners" className={navLink}>Partners</Link>
              <Link href="/whitelist" className={navLink}>Whitelist</Link>
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
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

const navLink = "text-ink-muted hover:text-ink transition-colors";

/**
 * Admin nav button + view-as dropdown. Uses native <details>/<summary>
 * so it works without client JS. Submitting a "View as" button posts
 * to `viewAsUser`, which sets the session cookie to the chosen target
 * and redirects to /. The persistent ViewingAsBanner (above this nav)
 * handles the flip-back affordance.
 */
function AdminDropdown({ self }: { self: User }) {
  const { byTier, otherAdmins } = pickViewAsTargets(self);

  return (
    <details className="relative">
      <summary
        className={cn(
          navLink,
          "flex cursor-pointer list-none items-center gap-1 select-none hover:opacity-80",
        )}
        style={{ color: "#D828A0" }}
      >
        Admin
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </summary>
      <div
        className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-2 text-sm shadow-lg"
      >
        {/* Personal — admins land here for their own profile.
            Pulled out of the main nav row so the row stays scannable. */}
        <Link
          href="/profile"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Profile
        </Link>
        <div className="my-2 border-t border-[var(--surface-border)]" />
        <Link
          href="/admin"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Admin home
        </Link>
        <Link
          href="/admin/team"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Team
        </Link>
        <Link
          href="/admin/members"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Members
        </Link>
        <Link
          href="/admin/projects"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          All projects
        </Link>
        <Link
          href="/admin/projects/applications"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Project applications
        </Link>
        <Link
          href="/admin/projects/contributions"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Outside contributors
        </Link>
        <Link
          href="/admin/chat"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Live chat
        </Link>
        <Link
          href="/admin/cohort"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Cohort spotlights
        </Link>
        <Link
          href="/admin/cooperative-quotes"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Cooperative quotes
        </Link>
        <Link
          href="/admin/receipts"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Cooperative receipts
        </Link>
        <Link
          href="/admin/feedback"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Beta feedback
        </Link>
        <Link
          href="/admin/testimonials"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Customer testimonials
        </Link>
        <Link
          href="/admin/epk"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          EPK approvals
        </Link>
        <Link
          href="/admin/categories"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Store categories
        </Link>
        <Link
          href="/admin/locker"
          className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-inset)]"
        >
          Locker moderation
        </Link>

        <div className="my-2 border-t border-[var(--surface-border)]" />
        <p className="px-3 pt-1 text-[10px] uppercase tracking-wider text-ink-muted">
          View site as
        </p>
        <form action={viewAsUser} className="mt-1 space-y-0.5">
          <ViewAsButton target="viewer" label="Viewer (signed out)" />
          {byTier.map(({ tier, user }) => (
            <ViewAsButton
              key={user.id}
              target={user.id}
              label={`${adminName(user)} — ${TIER_LABELS[tier]}`}
            />
          ))}
          {otherAdmins.length > 0 && (
            <>
              <p className="px-3 pt-2 text-[10px] uppercase tracking-wider text-ink-muted">
                Other admins
              </p>
              {otherAdmins.map((u) => (
                <ViewAsButton
                  key={u.id}
                  target={u.id}
                  label={`${adminName(u)} — Admin`}
                />
              ))}
            </>
          )}
        </form>
        <p className="mt-2 px-3 pb-1 text-[10px] text-ink-faint">
          Sandbox preview only. A pink banner stays at the top until
          you flip back.
        </p>
      </div>
    </details>
  );
}

function ViewAsButton({ target, label }: { target: string; label: string }) {
  return (
    <button
      type="submit"
      name="target"
      value={target}
      className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-[var(--surface-inset)]"
    >
      {label}
    </button>
  );
}
