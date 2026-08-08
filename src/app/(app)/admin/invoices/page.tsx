/**
 * /admin/invoices — invoice + receipt registry across all four flows.
 *
 * Sections:
 *   1. Awaiting approval — internal invoices that talent has submitted.
 *      Admin approves here to lock them into the contributor pool.
 *   2. Approved internal, ready to aggregate — internals grouped by
 *      project with a "Generate external invoice" affordance.
 *   3. External invoices — Coop → Client.
 *   4. Receipts — marketplace + retroactive.
 *
 * Payout gate lives elsewhere (`payout-gate.ts`) — settlement flows
 * throw if no valid document exists on the source. This surface is
 * where admins manage the documents themselves.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { invoices, projects, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  approveInternalInvoice,
  generateExternalInvoice,
  createRetroactiveReceipt,
} from "@/lib/invoice-actions";
import {
  INVOICE_DIRECTION_LABELS,
  publicName,
  type Invoice,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function byIssuedAtDesc(a: Invoice, b: Invoice) {
  return (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt);
}

export default async function AdminInvoicesPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/invoices");

  // Fetch everything up front, in parallel. Volume is small at Beta
  // scale (dozens of invoices), so a single unfiltered read + in-memory
  // filtering keeps this simple; add WHERE clauses if load ever grows.
  const [allInvoices, allUsers, allProjects] = await Promise.all([
    db.select().from(invoices),
    db.select().from(users),
    db.select().from(projects),
  ]);

  const userById = new Map(allUsers.map((u) => [u.id, u] as const));
  const projectById = new Map(allProjects.map((p) => [p.id, p] as const));

  const issuerLabel = (id: string): string => {
    const u = userById.get(id);
    return u ? publicName(u) : id;
  };
  const projectLabel = (id: string | null): string => {
    if (!id) return "(no project)";
    const p = projectById.get(id);
    return p?.title ?? id;
  };

  const invoiceRows = allInvoices as unknown as Invoice[];

  const awaitingApproval = invoiceRows
    .filter((i) => i.direction === "talent_to_coop" && i.status === "issued")
    .sort(byIssuedAtDesc);

  const approvedInternalByProject = new Map<string, Invoice[]>();
  for (const inv of invoiceRows) {
    if (
      inv.direction === "talent_to_coop" &&
      inv.status === "received" &&
      inv.contractId
    ) {
      const list = approvedInternalByProject.get(inv.contractId) ?? [];
      list.push(inv);
      approvedInternalByProject.set(inv.contractId, list);
    }
  }
  // Only show projects whose internals haven't been rolled into an
  // external invoice yet. (Any external referencing them → hide.)
  const externallyCoveredInternalIds = new Set<string>();
  for (const inv of invoiceRows) {
    if (inv.direction === "coop_to_client" && inv.sourceInvoiceIds) {
      for (const id of inv.sourceInvoiceIds) externallyCoveredInternalIds.add(id);
    }
  }
  const readyToAggregate = Array.from(approvedInternalByProject.entries())
    .map(([projectId, invs]) => ({
      projectId,
      internals: invs.filter((i) => !externallyCoveredInternalIds.has(i.id)),
    }))
    .filter((entry) => entry.internals.length > 0);

  const externals = invoiceRows
    .filter((i) => i.direction === "coop_to_client")
    .sort(byIssuedAtDesc);

  const receipts = invoiceRows
    .filter(
      (i) =>
        i.direction === "marketplace_receipt" ||
        i.direction === "retroactive_receipt",
    )
    .sort(byIssuedAtDesc);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Invoices + Receipts</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Documents ledger
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Every payout-authorizing document across the four flows —
            internal invoices from talent, external invoices to clients,
            marketplace receipts, and retroactive receipts for audit
            rectification. No settlement fires without one attached.
          </p>
        </div>
        <Link
          href="/admin/audit-log?resource=cooperative_quote"
          className="text-xs text-brand-magenta hover:underline"
        >
          Document audit trail →
        </Link>
      </div>

      {/* Awaiting approval */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Awaiting approval — Talent → Coop
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Internal invoices submitted by contributors. Approve to lock
          the amount into the contributor pool at settlement.
        </p>
        {awaitingApproval.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              Nothing waiting for approval.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {awaitingApproval.map((inv) => (
              <li key={inv.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {USD_FMT.format(Number(inv.total))} —{" "}
                        {issuerLabel(inv.issuerId)}
                      </CardTitle>
                      <p className="text-[11px] text-ink-faint">
                        {inv.number} · {projectLabel(inv.contractId)} ·
                        issued {(inv.issuedAt ?? "").slice(0, 10)}
                      </p>
                    </div>
                    <form action={approveInternalInvoice}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-brand-magenta px-4 py-1.5 text-xs font-medium text-brand-white hover:bg-brand-magenta/90"
                      >
                        Approve
                      </button>
                    </form>
                  </div>
                  {inv.notes && (
                    <p className="mt-2 text-[11px] italic text-ink-muted">
                      {inv.notes}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ready to aggregate → external */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Approved internal — ready for external invoice
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Projects with approved internal invoices that haven&apos;t
          been rolled into a client-facing external invoice yet.
          Generating grosses up by ÷ 0.85 so the 15% network fee lands
          on top of the contributor sum.
        </p>
        {readyToAggregate.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              Nothing ready to aggregate.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {readyToAggregate.map(({ projectId, internals }) => {
              const project = projectById.get(projectId);
              const internalSum = internals.reduce(
                (s, i) => s + Number(i.total),
                0,
              );
              const externalTotal = internalSum / 0.85;
              return (
                <li key={projectId}>
                  <Card>
                    <CardTitle className="text-base">
                      {project?.title ?? projectId}
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {internals.length} approved internal
                      {internals.length === 1 ? "" : "s"} totaling{" "}
                      {USD_FMT.format(internalSum)} → external{" "}
                      <strong>{USD_FMT.format(externalTotal)}</strong>{" "}
                      after 15% network fee.
                    </p>
                    <form
                      action={generateExternalInvoice}
                      className="mt-4 flex flex-wrap items-end gap-2"
                    >
                      <input
                        type="hidden"
                        name="projectId"
                        value={projectId}
                      />
                      <div className="flex-1 min-w-[220px]">
                        <label
                          htmlFor={`crid-${projectId}`}
                          className="block text-[11px] uppercase tracking-wider text-ink-muted"
                        >
                          Client recipient id / label
                        </label>
                        <input
                          id={`crid-${projectId}`}
                          name="clientRecipientId"
                          type="text"
                          required
                          placeholder={`client_${projectId}`}
                          defaultValue={`client_${projectId}`}
                          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-brand-white hover:bg-brand-magenta/90"
                      >
                        Generate external
                      </button>
                    </form>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* External invoices */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          External invoices — Coop → Client
        </h2>
        {externals.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No external invoices on record.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {externals.map((inv) => (
              <li key={inv.id}>
                <InvoiceRow
                  inv={inv}
                  projectLabel={projectLabel(inv.contractId)}
                  issuerLabelText={issuerLabel(inv.issuerId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Receipts */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">Receipts</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Marketplace receipts auto-generate on order fulfillment.
          Retroactive receipts close audit gaps where the invoice
          flow was skipped — admin-created with required rationale.
        </p>
        {receipts.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">No receipts on record.</p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {receipts.map((inv) => (
              <li key={inv.id}>
                <InvoiceRow
                  inv={inv}
                  projectLabel={projectLabel(inv.contractId)}
                  issuerLabelText={issuerLabel(inv.issuerId)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Retroactive receipt composer */}
        <Card className="mt-6">
          <CardEyebrow>Create retroactive receipt</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            Use to close an audit gap when the invoice flow was skipped.
            Rationale is required.
          </p>
          <form action={createRetroactiveReceipt} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="retro-project"
                  className="block text-[11px] uppercase tracking-wider text-ink-muted"
                >
                  Project id
                </label>
                <input
                  id="retro-project"
                  name="projectId"
                  type="text"
                  placeholder="p_XXX"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="retro-amount"
                  className="block text-[11px] uppercase tracking-wider text-ink-muted"
                >
                  Amount
                </label>
                <input
                  id="retro-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 3500"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="retro-recipient"
                  className="block text-[11px] uppercase tracking-wider text-ink-muted"
                >
                  Recipient id / label
                </label>
                <input
                  id="retro-recipient"
                  name="recipientId"
                  type="text"
                  required
                  placeholder="user id or client label"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="retro-desc"
                  className="block text-[11px] uppercase tracking-wider text-ink-muted"
                >
                  Description
                </label>
                <input
                  id="retro-desc"
                  name="description"
                  type="text"
                  required
                  placeholder="What this documents"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="retro-rationale"
                className="block text-[11px] uppercase tracking-wider text-ink-muted"
              >
                Rationale (required for audit trail)
              </label>
              <textarea
                id="retro-rationale"
                name="rationale"
                required
                rows={3}
                placeholder="Why the invoice flow was skipped + what this receipt closes."
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-brand-white hover:bg-brand-magenta/90"
              >
                Create retroactive receipt
              </button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}

function InvoiceRow({
  inv,
  projectLabel,
  issuerLabelText,
}: {
  inv: Invoice;
  projectLabel: string;
  issuerLabelText: string;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardTitle className="text-base">
            {USD_FMT.format(Number(inv.total))} — {inv.number}
          </CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            <span className="uppercase tracking-wider">
              {INVOICE_DIRECTION_LABELS[inv.direction]}
            </span>
            {" · status "}
            {inv.status}
            {" · "}
            {projectLabel}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            Issuer: {issuerLabelText} · Recipient:{" "}
            <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
              {inv.recipientId}
            </code>
          </p>
        </div>
        {inv.issuedAt && (
          <p
            className="font-mono text-[10px] text-ink-faint"
            title={inv.issuedAt}
          >
            {inv.issuedAt.slice(0, 10)}
          </p>
        )}
      </div>
      {inv.sourceInvoiceIds && inv.sourceInvoiceIds.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-faint">
          Aggregates {inv.sourceInvoiceIds.length} internal invoice
          {inv.sourceInvoiceIds.length === 1 ? "" : "s"}
        </p>
      )}
      {inv.sourceRefId && (
        <p className="mt-1 text-[11px] text-ink-faint">
          Ref:{" "}
          <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
            {inv.sourceRefId}
          </code>
        </p>
      )}
      {inv.notes && (
        <p className="mt-2 text-[11px] italic text-ink-muted">{inv.notes}</p>
      )}
    </Card>
  );
}

