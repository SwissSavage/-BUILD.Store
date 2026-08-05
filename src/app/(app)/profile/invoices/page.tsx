/**
 * /profile/invoices — talent-side internal-invoice surface.
 *
 * Members cut invoices against projects they're assigned to. Each
 * invoice submits as "issued" and awaits admin approval before it
 * locks into the contributor pool at settlement.
 *
 * Shows the user's own invoice history + a composer for a new one.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_INVOICES } from "@/lib/mock-data/invoices";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { createInternalInvoice } from "@/lib/invoice-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function ProfileInvoicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/invoices");

  // Projects the user is on (as assigned member or admin) that they
  // could bill against. Includes past projects for retroactive
  // invoicing.
  const eligibleProjects = MOCK_PROJECTS.filter(
    (p) =>
      p.assignedMemberIds.includes(user.id) ||
      p.adminUserIds.includes(user.id),
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const myInvoices = MOCK_INVOICES.filter(
    (i) => i.direction === "talent_to_coop" && i.issuerId === user.id,
  ).sort((a, b) =>
    (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Profile · Invoices</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Bill the cooperative
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Cut an internal invoice against any project you&apos;re
            on. Once admin approves, your amount locks into the
            contributor pool at that project&apos;s settlement.
            Multiple invoices per project are fine — bill each
            contribution separately at your rate.
          </p>
        </div>
      </div>

      {/* Composer */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Cut an invoice</h2>
        {eligibleProjects.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              You aren&apos;t on any projects yet. Once you&apos;re
              assigned to a contract, you can bill against it here.
            </p>
          </Card>
        ) : (
          <form
            action={createInternalInvoice}
            className="mt-4 space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
          >
            <div>
              <label
                htmlFor="projectId"
                className="block text-[11px] uppercase tracking-wider text-ink-muted"
              >
                Project
              </label>
              <select
                id="projectId"
                name="projectId"
                required
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">Pick a project</option>
                {eligibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="block text-[11px] uppercase tracking-wider text-ink-muted">
                Line items
              </legend>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <input
                    name="lineDescription"
                    type="text"
                    placeholder="Description (e.g. 12 hours × $175/hr)"
                    required={i === 0}
                    className="flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  />
                  <input
                    name="lineAmount"
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"
                    required={i === 0}
                    className="w-32 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <p className="text-[11px] text-ink-faint">
                First row is required. Add up to three line items here;
                more can be added later.
              </p>
            </fieldset>

            <div>
              <label
                htmlFor="notes"
                className="block text-[11px] uppercase tracking-wider text-ink-muted"
              >
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Anything the admin should know before approving."
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-magenta px-4 py-2 text-sm font-medium text-brand-white hover:bg-brand-magenta/90"
              >
                Submit invoice
              </button>
            </div>
          </form>
        )}
      </section>

      {/* History */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">Your invoices</h2>
        {myInvoices.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              You haven&apos;t cut any invoices yet.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {myInvoices.map((inv) => {
              const project = MOCK_PROJECTS.find(
                (p) => p.id === inv.contractId,
              );
              return (
                <li key={inv.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {USD_FMT.format(Number(inv.total))}
                        </CardTitle>
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {inv.number} · {project?.title ?? inv.contractId} ·
                          status {inv.status}
                        </p>
                      </div>
                      {inv.issuedAt && (
                        <p className="font-mono text-[10px] text-ink-faint">
                          {inv.issuedAt.slice(0, 10)}
                        </p>
                      )}
                    </div>
                    {inv.lineItems.length > 0 && (
                      <ul className="mt-3 space-y-1 text-[11px] text-ink-muted">
                        {inv.lineItems.map((li) => (
                          <li key={li.id} className="flex justify-between">
                            <span>{li.description}</span>
                            <span>{USD_FMT.format(Number(li.amount))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
