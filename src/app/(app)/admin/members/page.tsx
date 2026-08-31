/**
 * Admin: member list with view switcher.
 *
 * View dropdown (`?view=...`) rearranges the list:
 *   - table    → default flat table, all members
 *   - pillar   → grouped by primary pillar (STEM / Creative / Prof Svcs)
 *   - tier     → grouped by membership tier (viewer → member)
 *   - admins   → admins only, compact
 *   - sellers  → members approved to sell on the marketplace
 *
 * Reads the live Postgres users table (2026-08-28 swap). Seed profiles
 * and real signups both come back — the July seed wrote its rows into
 * the same table, so there's nothing to merge.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";

/**
 * Never statically render this page. Without it Next.js bakes the
 * member list at build time and new signups never appear — which
 * looks identical to the DB read being broken. Real-time visibility
 * of who has joined is the entire point of the page.
 */
export const dynamic = "force-dynamic";
import { sellerApplicationReader, safely } from "@/lib/readers";
import {
  INDUSTRY_LABELS,
  TIER_LABELS,
  adminName,
  userPillars,
  type Industry,
  type MembershipTier,
  type User,
} from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { sendDirectMessage } from "@/lib/dm-actions";
import {
  setMembershipTier,
  toggleAdminFlag,
} from "@/lib/member-management-actions";

const TIERS: MembershipTier[] = ["viewer", "partner", "member"];

type ViewMode = "table" | "pillar" | "tier" | "admins" | "sellers";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "table", label: "All members — flat table" },
  { value: "pillar", label: "Group by pillar" },
  { value: "tier", label: "Group by membership tier" },
  { value: "admins", label: "Admins only" },
  { value: "sellers", label: "Approved marketplace sellers" },
];

function normalizeView(value: string | undefined): ViewMode {
  const allowed: ViewMode[] = [
    "table",
    "pillar",
    "tier",
    "admins",
    "sellers",
  ];
  return (allowed as string[]).includes(value ?? "")
    ? (value as ViewMode)
    : "table";
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireAdmin();
  const { view: rawView } = await searchParams;
  const view = normalizeView(rawView);

  // Derive seller-approved user ids for the sellers view. Reads the
  // live applications — approvals granted through /admin/marketplace
  // were invisible here.
  const sellerApps = await safely(() => sellerApplicationReader.all(), []);
  const approvedSellerIds = new Set(
    sellerApps.filter((a) => a.status === "approved").map((a) => a.userId),
  );

  // Reader swap (2026-08-28): was a fixture array, so real signups were
  // invisible here. Reads the live table now — seed profiles and real
  // members both come back, since the seed rows live in Postgres too.
  const { users: allUsers, source: readSource } = await getAllUsers();
  let rows: User[] = allUsers;

  if (view === "admins") rows = rows.filter((u) => u.isAdmin);
  if (view === "sellers") rows = rows.filter((u) => approvedSellerIds.has(u.id));

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Members</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {rows.length} {rows.length === 1 ? "member" : "members"} in this
            view
          </p>
          {readSource === "seed-fallback" && (
            <p
              className="mt-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: "#FDF0D5", color: "#8A5A00" }}
            >
              <strong>Showing seed data.</strong> The database didn&apos;t
              answer, so this is the built-in sample roster, not your real
              members. Check that DATABASE_URL is set and Postgres is
              reachable.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <Link
              href="/admin/members/invite"
              className="rounded-full bg-brand-magenta px-3 py-1 text-white hover:opacity-90"
            >
              + Invite new member
            </Link>
            <Link
              href="/admin/access-review"
              className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
            >
              Access review →
            </Link>
            <Link
              href="/admin/audit-log?resource=user"
              className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
            >
              User audit log →
            </Link>
          </div>
        </div>
        <form method="get" className="flex items-center gap-2">
          <label
            htmlFor="view"
            className="text-xs uppercase tracking-wider text-ink-muted"
          >
            View
          </label>
          <select
            id="view"
            name="view"
            defaultValue={view}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          >
            {VIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta"
          >
            Apply
          </button>
        </form>
      </div>

      {view === "pillar" ? (
        <GroupedByPillar rows={rows} />
      ) : view === "tier" ? (
        <GroupedByTier rows={rows} />
      ) : (
        <FlatTable rows={rows} showAdminFlag />
      )}
    </div>
  );
}

function GroupedByPillar({ rows }: { rows: User[] }) {
  const PILLARS: Industry[] = ["stem", "creative-media", "professional-services"];
  return (
    <div className="mt-8 space-y-10">
      {PILLARS.map((p) => {
        const group = rows.filter((u) => u.primaryIndustry === p);
        if (group.length === 0) return null;
        return (
          <section key={p}>
            <h2 className="font-display text-2xl font-semibold">
              {INDUSTRY_LABELS[p]} ({group.length})
            </h2>
            <div className="mt-3">
              <FlatTable rows={group} showAdminFlag />
            </div>
          </section>
        );
      })}
      {(() => {
        const none = rows.filter((u) => !u.primaryIndustry);
        if (none.length === 0) return null;
        return (
          <section>
            <h2 className="font-display text-2xl font-semibold">
              No primary pillar set ({none.length})
            </h2>
            <div className="mt-3">
              <FlatTable rows={none} showAdminFlag />
            </div>
          </section>
        );
      })()}
    </div>
  );
}

function GroupedByTier({ rows }: { rows: User[] }) {
  return (
    <div className="mt-8 space-y-10">
      {TIERS.map((t) => {
        const group = rows.filter((u) => u.membershipTier === t);
        if (group.length === 0) return null;
        return (
          <section key={t}>
            <h2 className="font-display text-2xl font-semibold">
              {TIER_LABELS[t]} ({group.length})
            </h2>
            <div className="mt-3">
              <FlatTable rows={group} showAdminFlag />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FlatTable({
  rows,
  showAdminFlag,
}: {
  rows: User[];
  showAdminFlag: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="p-4 text-left">Member</th>
            <th className="p-4 text-left">Pillars</th>
            <th className="p-4 text-left">Tier</th>
            {showAdminFlag && <th className="p-4 text-left">Admin</th>}
            <th className="p-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const pillars = userPillars(u);
            return (
              <tr
                key={u.id}
                className="border-t border-[var(--surface-border)]"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar user={u} size="md" />
                    <div>
                      <div className="font-medium">{adminName(u)}</div>
                      <div className="text-xs text-ink-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  {pillars.length === 0 ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {pillars.map((p, idx) => (
                        <span
                          key={p}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            idx === 0
                              ? "bg-[var(--surface-inset)] text-ink"
                              : "border border-[var(--surface-border)] text-ink-muted"
                          }`}
                          title={idx === 0 ? "Primary" : "Secondary"}
                        >
                          {INDUSTRY_LABELS[p]}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <TierBadge tier={u.membershipTier} />
                </td>
                {showAdminFlag && (
                  <td className="p-4">
                    <form action={toggleAdminFlag}>
                      <input type="hidden" name="uid" value={u.id} />
                      <button
                        type="submit"
                        className="text-xs text-brand-magenta hover:underline"
                      >
                        {u.isAdmin ? "Revoke" : "Grant"}
                      </button>
                    </form>
                  </td>
                )}
                <td className="p-4">
                  <form
                    action={setMembershipTier}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="uid" value={u.id} />
                    <select
                      name="tier"
                      defaultValue={u.membershipTier}
                      className="rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {TIER_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--surface-border)] px-2 py-1 text-xs hover:border-brand-magenta"
                    >
                      Set
                    </button>
                  </form>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <Link
                      href={`/admin/members/${u.id}`}
                      className="text-brand-magenta hover:underline"
                    >
                      Manage →
                    </Link>
                    {u.suspendedAt && (
                      <span className="rounded-full border border-brand-magenta/40 px-2 py-0.5 text-brand-magenta">
                        Suspended
                      </span>
                    )}
                    {!u.profilePublic && (
                      <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                        Not discoverable
                      </span>
                    )}
                  </div>
                  <DmCompose user={u} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Inline DM composer. Recipients can be any tier — viewers,
 * partners, members, or other admins all receive the message in their
 * /notifications inbox. Send-side gating lives on the action itself
 * (`canSendDirectMessage` in lib/types.ts) — admins always pass that
 * check, so the form is always rendered here. Uses native
 * <details>/<summary> so the page stays server-rendered.
 */
function DmCompose({ user }: { user: User }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-brand-magenta hover:underline">
        Send DM →
      </summary>
      <form
        action={sendDirectMessage}
        className="mt-2 space-y-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3"
      >
        <input type="hidden" name="recipientId" value={user.id} />
        <input
          name="subject"
          type="text"
          required
          maxLength={80}
          placeholder="Subject (e.g. Beta kickoff)"
          className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs"
        />
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Lands in their /notifications inbox."
          className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs"
        />
        <button
          type="submit"
          className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Send
        </button>
      </form>
    </details>
  );
}
