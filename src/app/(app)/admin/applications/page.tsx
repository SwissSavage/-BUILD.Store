/**
 * Admin: pending membership applications. Approve / reject.
 *
 * Sandbox mutates MOCK_APPLICATIONS + MOCK_USERS in-memory.
 * REPLACE WITH Drizzle UPDATE on membership_applications + users table.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { membershipApplications, users as usersTable } from "@/db/schema";
import { membershipApplicationReader, safely } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import { TIER_LABELS } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

async function decide(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "approved" | "rejected";
  const reviewerId = String(formData.get("reviewerId"));

  const app = await membershipApplicationReader.byId(id);
  if (!app) return;

  const now = new Date().toISOString();

  // Writer swap 2026-08-29: both of these were in-memory mutations.
  // An admin approving a tier promotion watched the member's tier
  // change and then silently revert on the next deploy — the decision
  // was never recorded and the promotion never happened.
  //
  // Application status and the tier grant move together in one
  // transaction. A half-applied promotion (application marked
  // approved, tier never granted) is worse than neither.
  await db.transaction(async (tx) => {
    await tx
      .update(membershipApplications)
      .set({ status: decision, reviewedBy: reviewerId, reviewedAt: now })
      .where(eq(membershipApplications.id, id));

    if (decision === "approved") {
      await tx
        .update(usersTable)
        .set({ membershipTier: app.requestedTier, updatedAt: now })
        .where(eq(usersTable.id, app.userId));
    }
  });

  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  revalidatePath("/admin/members");
}

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage() {
  const me = await requireAdmin();
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
                    {String((app.applicationData as { why?: string }).why ?? "")}
                  </p>
                  <p className="mt-3 text-xs text-ink-faint">
                    Submitted {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <form action={decide}>
                      <input type="hidden" name="id" value={app.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <input type="hidden" name="reviewerId" value={me.id} />
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
                      <input type="hidden" name="reviewerId" value={me.id} />
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
