/**
 * Admin team management (sandbox).
 *
 * Lists the current admin cohort and every non-admin member who could
 * plausibly be promoted, with server actions to grant/revoke the flag.
 * Closes the "who on the Future Modern side has admin access at launch"
 * open question from ROADMAP.md without committing real users yet. The
 * surface is ready for when the cooperative-owned production swap lands
 * (auth, domains, backend per the launch-prep checklist).
 *
 * Grant and revoke update `users.is_admin` and write an audit entry.
 * Both were in-memory until 2026-08-30, which meant promoting someone
 * to admin appeared to work and reverted on the next deploy — and the
 * second revoke path, on /admin/access-review, had the same problem
 * while logging the revocation as though it had taken effect.
 *
 * Still to come: an email to the promoted user.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getAllUsers, getUserById } from "@/lib/readers/users";
import { safely } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { INDUSTRY_LABELS, adminName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

async function grantAdmin(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");
  const userId = String(formData.get("userId") ?? "");
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  await db
    .update(users)
    .set({ isAdmin: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.admin_flag_changed",
    resourceKind: "user",
    resourceId: userId,
    before: { isAdmin: false },
    after: { isAdmin: true },
    reason: "Granted from /admin/team.",
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin");
}

async function revokeAdmin(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) {
    throw new Error(
      "Self-revoke disabled — another admin must remove you to prevent locking the platform out.",
    );
  }
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  await db
    .update(users)
    .set({ isAdmin: false, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.admin_flag_changed",
    resourceKind: "user",
    resourceId: userId,
    before: { isAdmin: true },
    after: { isAdmin: false },
    reason: "Revoked from /admin/team.",
  });

  revalidatePath("/admin/team");
  revalidatePath("/admin");
}

export default async function AdminTeamPage() {
  const current = await getCurrentUser();
  if (!current || !current.isAdmin) redirect("/dashboard");

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  const admins = roster.filter((u) => u.isAdmin);
  const promotable = roster.filter(
    (u) =>
      !u.isAdmin &&
      (u.membershipTier === "member" || u.membershipTier === "partner"),
  ).sort((a, b) => adminName(a).localeCompare(adminName(b)));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Team</h1>
      <p className="mt-2 text-ink-muted">
        Who can access admin surfaces and run ops on behalf of the
        cooperative. Grant sparingly — every admin can log attribution,
        approve quote sheets, issue invoices, and trigger payouts.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Active admins ({admins.length})
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {admins.map((u) => (
            <Card key={u.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardEyebrow>
                    {u.primaryIndustry
                      ? INDUSTRY_LABELS[u.primaryIndustry]
                      : "No pillar set"}
                  </CardEyebrow>
                  <CardTitle className="mt-1">{adminName(u)}</CardTitle>
                  <p className="mt-1 text-xs text-ink-faint">
                    @{u.handle} · {u.email}
                  </p>
                </div>
                {u.id === current.id && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: "rgba(0, 112, 72, 0.15)",
                      color: "var(--fm-green-text)",
                    }}
                  >
                    You
                  </span>
                )}
              </div>
              {u.bio && (
                <p className="mt-3 text-sm text-ink-muted">{u.bio}</p>
              )}
              <form action={revokeAdmin} className="mt-4">
                <input type="hidden" name="userId" value={u.id} />
                <button
                  type="submit"
                  disabled={u.id === current.id}
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)] disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    u.id === current.id
                      ? "Self-revoke disabled. Ask another admin."
                      : "Revoke admin access"
                  }
                >
                  Revoke admin
                </button>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Promotable members ({promotable.length})
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Every member or partner who isn&apos;t already an admin. Use the
          filter in the URL bar if this list gets long.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="p-4 text-left">Member</th>
                <th className="p-4 text-left">Pillar</th>
                <th className="p-4 text-left">Tier</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {promotable.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-[var(--surface-border)]"
                >
                  <td className="p-4">
                    <div className="font-medium">{adminName(u)}</div>
                    <div className="text-xs text-ink-faint">
                      @{u.handle} · {u.email}
                    </div>
                  </td>
                  <td className="p-4 text-ink-muted">
                    {u.primaryIndustry
                      ? INDUSTRY_LABELS[u.primaryIndustry]
                      : "—"}
                  </td>
                  <td className="p-4 capitalize text-ink-muted">
                    {u.membershipTier}
                  </td>
                  <td className="p-4 text-right">
                    <form action={grantAdmin}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        className="fm-btn-primary rounded-full px-3 py-1.5 text-xs font-medium"
                      >
                        Grant admin
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Card className="mt-10">
        <CardEyebrow>Launch guardrails</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          At launch, only Jamar has admin. The roadmap&apos;s open
          question #3 asks who else should have it on day one — add them
          here once decided. Self-revoke is disabled so a single admin
          can&apos;t accidentally lock everyone out.
        </p>
      </Card>
    </div>
  );
}
