/**
 * Admin: whitelist ops (Phase 2.3 sandbox).
 *
 * Workers' cooperative posture: ACCESS IS NOT FOR SALE. The Whitelist
 * surface hosts donations + consultation requests, NOT access tiers.
 * This admin page mirrors that:
 *
 *   1. Tiers — donation lanes + consultation lane. Active toggle.
 *   2. Donations — cash + crypto, lifecycle (initiated → paid →
 *      split_distributed). Admin can force forward flips while real
 *      Stripe webhooks + chain listeners are offline. The split that
 *      runs here is the donation split (50/50 Treasury + LP, NO ops cut, NO
 *      individual payout).
 *   3. Consultation requests — external custom-build queue. Assign,
 *      set status, write toward a quote sheet.
 *
 * REPLACE WITH: Stripe webhook + chain-event listeners write `paid` +
 * `splitDistributedAt`; consultation triage becomes a real CRM
 * pipeline. Manual state transitions stick around as ops overrides.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_WHITELIST_TIERS,
  MOCK_WHITELIST_PURCHASES,
  MOCK_CONSULTATION_REQUESTS,
} from "@/lib/mock-data/whitelist";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  CONSULTATION_STATUS_LABELS,
  INDUSTRY_LABELS,
  WHITELIST_PURCHASE_STATUS_LABELS,
  WHITELIST_RAIL_LABELS,
  adminName,
  type ConsultationStatus,
  type WhitelistPurchaseStatus,
} from "@/lib/types";
import { previewDonationSplit } from "@/lib/whitelist-splits";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

async function markPurchasePaid(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const purchase = MOCK_WHITELIST_PURCHASES.find((p) => p.id === id);
  if (!purchase) return;
  if (purchase.status === "initiated") {
    purchase.status = "paid";
    purchase.paidAt = new Date().toISOString();
    // Increment donation count on the tier (tracks lifetime donations,
    // not "seats" — there are no access seats to claim).
    const tier = MOCK_WHITELIST_TIERS.find((t) => t.id === purchase.tierId);
    if (tier) tier.seatsClaimed += 1;
  }
  revalidatePath("/admin/whitelist");
}

async function distributeSplit(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const purchase = MOCK_WHITELIST_PURCHASES.find((p) => p.id === id);
  if (!purchase) return;
  if (purchase.status === "paid") {
    purchase.status = "split_distributed";
    purchase.splitDistributedAt = new Date().toISOString();
  }
  revalidatePath("/admin/whitelist");
}

async function refundPurchase(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const purchase = MOCK_WHITELIST_PURCHASES.find((p) => p.id === id);
  if (!purchase) return;
  const wasPaid = purchase.status === "paid" || purchase.status === "split_distributed";
  purchase.status = "refunded";
  if (wasPaid) {
    const tier = MOCK_WHITELIST_TIERS.find((t) => t.id === purchase.tierId);
    if (tier && tier.seatsClaimed > 0) tier.seatsClaimed -= 1;
  }
  revalidatePath("/admin/whitelist");
}

async function toggleTierActive(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const tier = MOCK_WHITELIST_TIERS.find((t) => t.id === id);
  if (tier) tier.active = !tier.active;
  revalidatePath("/admin/whitelist");
  revalidatePath("/whitelist");
}

async function setConsultationStatus(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as ConsultationStatus;
  const assigned = String(formData.get("assignedTo") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const r = MOCK_CONSULTATION_REQUESTS.find((x) => x.id === id);
  if (!r) return;
  r.status = status;
  r.assignedTo = assigned;
  r.adminNote = note;
  revalidatePath("/admin/whitelist");
}

const PURCHASE_STATUS_ORDER: WhitelistPurchaseStatus[] = [
  "initiated",
  "paid",
  "split_distributed",
  "refunded",
  "failed",
];

const CONSULT_ORDER: ConsultationStatus[] = [
  "new",
  "scheduled",
  "quoted",
  "won",
  "declined",
];

function tierLane(t: { isDonation: boolean; isConsultation: boolean }): string {
  if (t.isDonation) return "Donation";
  if (t.isConsultation) return "Consultation";
  return "Other";
}

export default async function AdminWhitelistPage() {
  await requireAdmin();

  const purchases = [...MOCK_WHITELIST_PURCHASES].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
  const requests = [...MOCK_CONSULTATION_REQUESTS].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
  const admins = MOCK_USERS.filter((u) => u.isAdmin);

  const totalDonated = MOCK_WHITELIST_PURCHASES.filter(
    (p) => p.status === "paid" || p.status === "split_distributed",
  ).reduce((sum, p) => sum + Number(p.amountUsd), 0);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Whitelist</h1>
      <p className="mt-2 max-w-3xl text-ink-muted">
        Workers&apos; cooperative — access is not for sale. This queue
        tracks two things only: voluntary donations (cash + crypto) and
        external consultation requests for custom builds. Donations
        route 100% to Treasury + Liquidity Pool (50/50); no ops cut and
        no individual payout is ever dispatched. War-chest mode until
        the cooperative starts paying salaries.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card>
          <CardEyebrow>Donations received</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            ${Math.round(totalDonated).toLocaleString()}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            Cumulative cash + crypto, paid + distributed
          </p>
        </Card>
        <Card>
          <CardEyebrow>Open donations</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            {
              purchases.filter(
                (p) => p.status === "initiated" || p.status === "paid",
              ).length
            }
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            Need webhook confirm or split run
          </p>
        </Card>
        <Card>
          <CardEyebrow>Consult queue</CardEyebrow>
          <CardTitle className="mt-2 text-3xl">
            {requests.filter((r) => r.status === "new").length}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            New scoping requests to triage
          </p>
        </Card>
      </div>

      {/* Tiers */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Lanes</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="p-4 text-left">Lane</th>
                <th className="p-4 text-right">Suggested amount</th>
                <th className="p-4 text-right">Donations / requests</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {MOCK_WHITELIST_TIERS.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-[var(--surface-border)]"
                >
                  <td className="p-4">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-ink-muted">{tierLane(t)}</div>
                  </td>
                  <td className="p-4 text-right">
                    {t.isConsultation
                      ? "—"
                      : `$${Number(t.priceUsd).toLocaleString()}`}
                  </td>
                  <td className="p-4 text-right">{t.seatsClaimed}</td>
                  <td className="p-4 capitalize">
                    {t.active ? "Active" : "Paused"}
                  </td>
                  <td className="p-4 text-right">
                    <form action={toggleTierActive}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs hover:border-brand-magenta"
                      >
                        {t.active ? "Pause" : "Resume"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Donations */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Donations</h2>
        {PURCHASE_STATUS_ORDER.filter((s) =>
          purchases.some((p) => p.status === s),
        ).map((status) => {
          const rows = purchases.filter((p) => p.status === status);
          return (
            <div key={status} className="mt-6">
              <h3 className="text-xs uppercase tracking-wider text-ink-muted">
                {WHITELIST_PURCHASE_STATUS_LABELS[status]} ({rows.length})
              </h3>
              <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="p-4 text-left">Donor</th>
                      <th className="p-4 text-left">Lane</th>
                      <th className="p-4 text-left">Rail</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4 text-left">
                        Routing (Treasury / LP)
                      </th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const tier = MOCK_WHITELIST_TIERS.find(
                        (t) => t.id === p.tierId,
                      );
                      const split = previewDonationSplit(Number(p.amountUsd));
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-[var(--surface-border)]"
                        >
                          <td className="p-4">
                            <div className="font-medium">{p.buyerName}</div>
                            <div className="text-xs text-ink-muted">
                              {p.buyerEmail}
                            </div>
                          </td>
                          <td className="p-4 text-ink-muted">
                            {tier?.name ?? "—"}
                          </td>
                          <td className="p-4 text-ink-muted">
                            {WHITELIST_RAIL_LABELS[p.rail]}
                          </td>
                          <td className="p-4 text-right">
                            ${Number(p.amountUsd).toLocaleString()}
                          </td>
                          <td className="p-4 text-xs text-ink-muted">
                            ${split.treasury.toLocaleString()} /{" "}
                            ${split.liquidityPool.toLocaleString()}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {p.status === "initiated" && (
                                <form action={markPurchasePaid}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full bg-brand-green px-3 py-1 text-[11px] font-medium text-brand-white hover:opacity-90"
                                  >
                                    Mark paid
                                  </button>
                                </form>
                              )}
                              {p.status === "paid" && (
                                <form action={distributeSplit}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                                    style={{ backgroundColor: "#D828A0" }}
                                  >
                                    Run split
                                  </button>
                                </form>
                              )}
                              {(p.status === "paid" ||
                                p.status === "split_distributed") && (
                                <form action={refundPurchase}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta"
                                  >
                                    Refund
                                  </button>
                                </form>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      {/* Consultation requests */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Consultation requests
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardEyebrow>
                {r.scopeBuckets.length > 0
                  ? r.scopeBuckets.map((s) => INDUSTRY_LABELS[s]).join(" + ")
                  : "No scope tags"}
              </CardEyebrow>
              <CardTitle className="mt-2">{r.contactName}</CardTitle>
              <p className="mt-1 text-xs text-ink-faint">
                {r.contactEmail}
                {r.company ? ` · ${r.company}` : ""}
              </p>
              <p className="mt-3 text-sm text-ink-muted">{r.briefing}</p>
              {r.budgetHint && (
                <p className="mt-2 text-xs text-ink-muted">
                  Budget hint: {r.budgetHint}
                </p>
              )}
              <form action={setConsultationStatus} className="mt-4 space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    name="status"
                    defaultValue={r.status}
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                  >
                    {CONSULT_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {CONSULTATION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    name="assignedTo"
                    defaultValue={r.assignedTo ?? ""}
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {adminName(a)}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={r.adminNote ?? ""}
                  placeholder="Admin note (internal)"
                  className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs hover:border-brand-magenta"
                >
                  Save
                </button>
              </form>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
