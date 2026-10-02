/**
 * Admin: pending membership applications. Approve / reject.
 *
 * Approve/reject writes membership_applications + users in one
 * transaction — a half-applied promotion is worse than neither.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { membershipApplications, users as usersTable } from "@/db/schema";
import { membershipApplicationReader, safely } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { notify } from "@/lib/writers/notifications";
import { TIER_LABELS, type MembershipTier } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const TIERS: readonly MembershipTier[] = ["viewer", "partner", "member"];

/**
 * Approve or reject a membership application.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-02)
 *
 * This action had no authorisation check. The page called
 * requireAdmin, the action did not, and a server action is a public
 * POST endpoint regardless of what gates the page that renders it.
 * Anyone holding the action id could grant themselves a membership
 * tier, and action ids are stable for a build and sit in rendered
 * HTML rather than being secret.
 *
 * The reviewer came from a hidden form field as well, so the record of
 * who approved a promotion was whatever the caller said it was.
 *
 * Three other things were missing and are added here. The decision was
 * not guarded on the application still being pending, so a replayed
 * request could re-decide a settled one and overwrite the timestamp.
 * There was no audit entry, which left a hole exactly where
 * promotions happen, while the same change made from the member page
 * writes user.membership_tier_changed. And nobody told the member.
 * ─────────────────────────────────────────────────────────────
 */
async function decide(formData: FormData) {
  "use server";
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "").trim();
  if (decisionRaw !== "approved" && decisionRaw !== "rejected") return;
  const decision: "approved" | "rejected" = decisionRaw;

  const app = await membershipApplicationReader.byId(id);
  if (!app) return;
  if (app.status !== "pending") return;

  // The requested tier is applied directly to the user row, so confirm
  // it is one of the three before it is written.
  if (decision === "approved" && !TIERS.includes(app.requestedTier)) return;

  const target = decision === "approved" ? await safely(
    () => getAllUsers().then((r) => r.users.find((u) => u.id === app.userId)),
    undefined,
  ) : undefined;
  const previousTier = target?.membershipTier ?? null;

  const now = new Date().toISOString();

  // Writer swap 2026-08-29: both of these were in-memory mutations.
  // An admin approving a tier promotion watched the member's tier
  // change and then silently revert on the next deploy — the decision
  // was never recorded and the promotion never happened.
  //
  // Application status and the tier grant move together in one
  // transaction. A half-applied promotion (application marked
  // approved, tier never granted) is worse than neither.
  //
  // The status update is guarded on the row still being pending, so a
  // double submit or a replayed request settles it once.
  const settled = await db.transaction(async (tx) => {
    const claimed = await tx
      .update(membershipApplications)
      .set({ status: decision, reviewedBy: admin.id, reviewedAt: now })
      .where(
        and(
          eq(membershipApplications.id, id),
          eq(membershipApplications.status, "pending"),
        )!,
      )
      .returning({ id: membershipApplications.id });

    if (claimed.length === 0) return false;

    if (decision === "approved") {
      await tx
        .update(usersTable)
        .set({ membershipTier: app.requestedTier, updatedAt: now })
        .where(eq(usersTable.id, app.userId));
    }
    return true;
  });

  if (!settled) return;

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "user.membership_tier_changed",
    resourceKind: "user",
    resourceId: app.userId,
    before: { membershipTier: previousTier, applicationStatus: "pending" },
    after: {
      membershipTier:
        decision === "approved" ? app.requestedTier : previousTier,
      applicationStatus: decision,
    },
  });

  await notify({
    userId: app.userId,
    kind: "direct_message",
    title:
      decision === "approved"
        ? `You are now a ${TIER_LABELS[app.requestedTier]}`
        : "Your membership application was not approved",
    body:
      decision === "approved"
        ? `Your application was approved and your account has been moved to ${TIER_LABELS[app.requestedTier]}.`
        : "Your application was reviewed and not approved this time. An admin can tell you what would change that.",
    href: "/profile",
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  revalidatePath("/admin/members");
}

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage() {
  // The page gate. The action does its own check, because a server
  // action is reachable without ever rendering this page.
  await requireAdmin();
  // Reader swap 2026-08-29: queue read a mock array.
  const [applications, { users: roster }] = await Promise.all([
    safely(() => membershipApplicationReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const userById = new Map(roster.map((u) => [u.id, u]));

  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Applications</h1>
      <p className="mt-2 text-ink-muted">Review tier promotion requests.</p>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">Pending</h2>
        {pending.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            No pending applications.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {pending.map((app) => {
              const user = userById.get(app.userId);
              return (
                <Card key={app.id}>
                  <CardEyebrow>
                    {TIER_LABELS[app.currentTier]} → {TIER_LABELS[app.requestedTier]}
                  </CardEyebrow>
                  <CardTitle className="mt-2">
                    {user?.firstName} {user?.lastName}
                  </CardTitle>
                  <p className="mt-2 text-xs text-ink-muted">{user?.email}</p>
                  <p className="mt-3 text-sm text-ink-muted">
                    {/* applicationData is jsonb. A row written before
                        the column had its default — or by any path
                        that skipped it — comes back null, and
                        dereferencing that crashes the whole page
                        render rather than one card. */}
                    {String(
                      (app.applicationData as { why?: string } | null)?.why ??
                        "",
                    )}
                  </p>
                  <p className="mt-3 text-xs text-ink-faint">
                    Submitted {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <form action={decide}>
                      <input type="hidden" name="id" value={app.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <button
                        type="submit"
                        className="rounded-full bg-brand-green px-4 py-1.5 text-xs font-medium text-brand-white hover:opacity-90"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={decide}>
                      <input type="hidden" name="id" value={app.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Reviewed</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Member</th>
                  <th className="p-4 text-left">Promotion</th>
                  <th className="p-4 text-left">Decision</th>
                  <th className="p-4 text-left">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((app) => {
                  const user = userById.get(app.userId);
                  return (
                    <tr key={app.id} className="border-t border-[var(--surface-border)]">
                      <td className="p-4">
                        {user?.firstName} {user?.lastName}
                      </td>
                      <td className="p-4 text-ink-muted">
                        {TIER_LABELS[app.currentTier]} → {TIER_LABELS[app.requestedTier]}
                      </td>
                      <td className="p-4 capitalize">{app.status}</td>
                      <td className="p-4 text-ink-muted">
                        {app.reviewedAt
                          ? new Date(app.reviewedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
