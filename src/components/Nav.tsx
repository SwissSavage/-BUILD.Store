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
import { viewAsUser } from "@/lib/auth-actions";
import { cn } from "@/lib/cn";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { unreadNotificationCount } from "@/lib/readers/notifications";
import {
  TIER_LABELS,
  adminName,
  type MembershipTier,
  type User,
} from "@/lib/types";
import { StoreDropdown } from "@/components/StoreDropdown";
import { JobsDropdown } from "@/components/JobsDropdown";
import { ProfileMenu } from "@/components/ProfileMenu";
import { MobileMenuApp } from "@/components/MobileMenuApp";

const VIEW_AS_TIER_ORDER: MembershipTier[] = [
  "partner", "member",
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
  const unread = isLoggedIn ? await unreadNotificationCount(user!.id) : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--surface-border)] bg-[var(--surface)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-app items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          aria-label="Future Modern home"
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

        {/* Desktop nav — hidden on mobile so 10+ auth links don't wrap
            into a mess. Mobile users get the MobileMenuApp drawer
            rendered further down. */}
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className={navLink}>Dashboard</Link>
              <JobsDropdown />
              <StoreDropdown />
              <Link href="/orders" className={navLink}>Orders</Link>
              <Link href="/showcase" className={navLink}>Showcase</Link>
              <Link href="/community" className={navLink}>Community</Link>
              {/* Artists (profileMode "epk") get a dedicated EPK editor
                  link — separate from the profile dropdown because EPK
                  is a distinct authoring surface, not a personal-scope
                  utility. */}
              {!user!.isAdmin && user!.profileMode === "epk" && (
                <Link href="/profile/epk" className={navLink}>EPK</Link>
              )}
              {user!.isAdmin && <AdminDropdown self={user!} />}
              {/* Personal-scope surfaces (profile, notifications, locker,
                  wallet, agreements, jobs status, sign out) live inside
                  the avatar dropdown per Rob's beta note #2 / task #60.
                  Keeps the top nav focused on discovery + platform-wide
                  surfaces. */}
              <ProfileMenu user={user!} unreadNotificationCount={unread} />
            </>
          ) : (
            <>
              <Link href="/about" className={navLink}>About</Link>
              <StoreDropdown />
              <JobsDropdown />
              <Link href="/showcase" className={navLink}>Showcase</Link>
              <Link href="/community" className={navLink}>Community</Link>
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

        {/* Mobile hamburger — visible only on mobile. Opens a full-
            screen drawer with the same links stacked vertically, plus
            an Admin section (flattened, no view-as picker) when the
            user is an admin. */}
        <div className="md:hidden">
          <MobileMenuApp
            isLoggedIn={isLoggedIn}
            isAdmin={!!user?.isAdmin}
            isEpk={user?.profileMode === "epk"}
            unread={unread}
          />
        </div>
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

        {/* Sections consolidate 20+ admin links so the dropdown stays
            scannable. Native <details> per section — same progressive-
            enhancement pattern as JobsDropdown/StoreDropdown. Each
            summary shows the count of items inside so admin can tell
            what's under the fold. */}
        <AdminSection label="People">
          <AdminLink href="/admin/team">Team</AdminLink>
          <AdminLink href="/admin/members">Members</AdminLink>
          <AdminLink href="/admin/projects/applications">
            Project applications
          </AdminLink>
          <AdminLink href="/admin/jobs/applications">
            Job applications
          </AdminLink>
          <AdminLink href="/admin/projects/contributions">
            Outside contributors
          </AdminLink>
          <AdminLink href="/admin/epk">EPK approvals</AdminLink>
        </AdminSection>

        <AdminSection label="Deals & projects">
          <AdminLink href="/admin/projects">All projects</AdminLink>
          <AdminLink href="/admin/cooperative-quotes">
            Cooperative quotes
          </AdminLink>
          <AdminLink href="/admin/clients">Client patterns</AdminLink>
          <AdminLink href="/admin/referrals">Partner referrals</AdminLink>
        </AdminSection>

        <AdminSection label="Money & agreements">
          <AdminLink href="/admin/agreements">Agreements</AdminLink>
          <AdminLink href="/admin/receipts">Cooperative receipts</AdminLink>
          <AdminLink href="/admin/invoices">Invoices + receipts</AdminLink>
          <AdminLink href="/admin/reserve">Contract reserves</AdminLink>
          <AdminLink href="/admin/vouchers">$BUILD vouchers</AdminLink>
          <AdminLink href="/admin/pools">Structural pools</AdminLink>
        </AdminSection>

        <AdminSection label="Content & moderation">
          <AdminLink href="/admin/chat">Live chat</AdminLink>
          <AdminLink href="/admin/cohort">Cohort spotlights</AdminLink>
          <AdminLink href="/admin/testimonials">
            Customer testimonials
          </AdminLink>
          <AdminLink href="/admin/feedback">Beta feedback</AdminLink>
          <AdminLink href="/admin/categories">Store categories</AdminLink>
          <AdminLink href="/admin/locker">Locker moderation</AdminLink>
        </AdminSection>

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
              label={`${adminName(user)} · ${TIER_LABELS[tier]}`}
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
                  label={`${adminName(u)} · Admin`}
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

/**
 * Collapsible section inside the admin dropdown. Native <details> so
 * it works without client JS. Summary shows the section label and a
 * small item-count badge so admin can see what's under the fold
 * without opening it.
 */
function AdminSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : 1;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-[11px] uppercase tracking-wider text-ink-muted hover:bg-[var(--surface-inset)]">
        <span>{label}</span>
        <span className="text-[10px] text-ink-faint">
          {count}
          <span className="ml-1 group-open:hidden">▸</span>
          <span className="ml-1 hidden group-open:inline">▾</span>
        </span>
      </summary>
      <div className="ml-2 border-l border-[var(--surface-border)] pl-1">
        {children}
      </div>
    </details>
  );
}

function AdminLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--surface-inset)]"
    >
      {children}
    </Link>
  );
}
