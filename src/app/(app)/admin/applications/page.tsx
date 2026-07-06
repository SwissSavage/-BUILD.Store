/**
 * Admin: pending membership applications. Approve / reject.
 *
 * Sandbox mutates MOCK_APPLICATIONS + MOCK_USERS in-memory.
 * REPLACE WITH Drizzle UPDATE on membership_applications + users table.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_APPLICATIONS } from "@/lib/mock-data/applications";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { TIER_LABELS } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

async function decide(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as "approved" | "rejected";
  const reviewerId = String(formData.get("reviewerId"));

  const app = MOCK_APPLICATIONS.find((a) => a.id === id);
  if (!app) return;
  app.status = decision;
  app.reviewedBy = reviewerId;
  app.reviewedAt = new Date().toISOString();

  if (decision === "approved") {
    const u = MOCK_USERS.find((x) => x.id === app.userId);
    if (u) {
      u.membershipTier = app.requestedTier;
      u.updatedAt = new Date().toISOString();
    }
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  revalidatePath("/admin/members");
}

export default async function AdminApplicationsPage() {
  const me = await requireAdmin();
  const pending = MOCK_APPLICATIONS.filter((a) => a.status === "pending");
  const reviewed = MOCK_APPLICATIONS.filter((a) => a.status !== "pending");

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
              const user = MOCK_USERS.find((u) => u.id === app.userId);
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
                  const user = MOCK_USERS.find((u) => u.id === app.userId);
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
