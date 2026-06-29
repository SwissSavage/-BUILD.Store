/**
 * Admin: member list with view switcher.
 *
 * View dropdown (`?view=...`) rearranges the list:
 *   - table    → default flat table, all members
 *   - pillar   → grouped by primary pillar (STEM / Creative / Prof Svcs)
 *   - tier     → grouped by membership tier (viewer → member)
 *   - admins   → admins only, compact
 *   - sellers  → members approved to sell on the marketplace
 *   - prospect → prospect tier only (pipeline view)
 *
 * Sandbox mutates MOCK_USERS in-memory; REPLACE WITH Drizzle UPDATE.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_SELLER_APPLICATIONS } from "@/lib/mock-data/seller-applications";
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

async function toggleAdmin(formData: FormData) {
  "use server";
  const uid = String(formData.get("uid"));
  const u = MOCK_USERS.find((x) => x.id === uid);
  if (u) u.isAdmin = !u.isAdmin;
  revalidatePath("/admin/members");
}

async function setTier(formData: FormData) {
  "use server";
  const uid = String(formData.get("uid"));
  const tier = String(formData.get("tier")) as MembershipTier;
  const u = MOCK_USERS.find((x) => x.id === uid);
  if (u) {
    u.membershipTier = tier;
    u.updatedAt = new Date().toISOString();
  }
  revalidatePath("/admin/members");
  revalidatePath("/admin");
}

const TIERS: MembershipTier[] = ["viewer", "prospect", "partner", "member"];

type ViewMode = "table" | "pillar" | "tier" | "admins" | "sellers" | "prospect";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "table", label: "All members — flat table" },
  { value: "pillar", label: "Group by pillar" },
  { value: "tier", label: "Group by membership tier" },
  { value: "admins", label: "Admins only" },
  { value: "sellers", label: "Approved marketplace sellers" },
  { value: "prospect", label: "Prospects (pipeline)" },
];

function normalizeView(value: string | undefined): ViewMode {
  const allowed: ViewMode[] = [
    "table",
    "pillar",
    "tier",
    "admins",
    "sellers",
    "prospect",
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

  // Derive seller-approved user ids for the sellers view.
  const approvedSellerIds = new Set(
    MOCK_SELLER_APPLICATIONS.filter((a) => a.status === "approved").map(
      (a) => a.userId,
    ),
  );

  // Figure out which set of users the current view cares about.
  let rows: User[] = MOCK_USERS;
  if (view === "admins") rows = rows.filter((u) => u.isAdmin);
  if (view === "sellers") rows = rows.filter((u) => approvedSellerIds.has(u.id));
  if (view === "prospect") rows = rows.filter((u) => u.membershipTier === "prospect");

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
                    <form action={toggleAdmin}>
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
                  <form action={setTier} className="flex items-center gap-2">
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
 * Inline DM composer. Recipients can be any tier — viewers, prospects,
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
