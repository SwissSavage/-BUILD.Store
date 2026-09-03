/**
 * /admin/referrals — partner referral attribution ledger surface.
 *
 * Every referral from an FM member to a SaaS Partner or Product
 * Affiliate lands here. Admin sees pending referrals to chase +
 * converted revshare + declined attribution history. Log-new form
 * embedded at the top for admin-initiated captures.
 *
 * Gated to admin.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { partnerReferralReader, safely } from "@/lib/readers";
import {
  ecosystemPartnerReader,
  productAffiliateReader,
} from "@/lib/readers";
import {
  logReferral,
  markReferralConverted,
  markReferralDeclined,
} from "@/lib/partner-referral-actions";
import {
  PARTNER_REFERRAL_KIND_LABELS,
  PARTNER_REFERRAL_STATUS_LABELS,
  publicName,
  type PartnerReferral,
  type User,
} from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/referrals");

  // Reader swap 2026-08-29: was MOCK_USERS.
  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  // Partner directories read live. Both start empty — a seeded
  // partner is a public claim FM hasn't made.
  const [ecosystem, affiliates] = await Promise.all([
    safely(() => ecosystemPartnerReader.all(), []),
    safely(() => productAffiliateReader.all(), []),
  ]);
  const partnerNameById = new Map<string, string>([
    ...ecosystem.map((p) => [p.id, p.name] as const),
    ...affiliates.map((p) => [p.id, p.name] as const),
  ]);
  const userById = new Map(roster.map((u) => [u.id, u]));
  const allRows = await safely(() => partnerReferralReader.all(), []);


  const rows = allRows.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pending = rows.filter((r) => r.status === "pending");
  const converted = rows.filter((r) => r.status === "converted");
  const closedOut = rows.filter(
    (r) => r.status === "declined" || r.status === "expired",
  );

  const totalRevshare = converted.reduce(
    (sum, r) => sum + Number(r.revshareEarnedUsd ?? 0),
    0,
  );

  const members = [...roster].sort((a, b) =>
    publicName(a).localeCompare(publicName(b), "en", { sensitivity: "base" }),
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Partner referrals</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Referral attribution ledger
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Every referral from a coop member to a SaaS Partner or
            Product Affiliate. When a referral converts, the
            referring member is due their kick per the standard
            contract-intake referral split (85 / 12 / 1.5 / 1.5).
          </p>
        </div>
        <div className="text-right text-xs text-ink-faint">
          <p>
            <span className="font-mono text-sm text-ink">{pending.length}</span>{" "}
            pending
          </p>
          <p>
            <span className="font-mono text-sm text-ink">
              {converted.length}
            </span>{" "}
            converted · revshare {USD_FMT.format(totalRevshare)}
          </p>
        </div>
      </div>

      {/* Log-new form */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Log a referral
        </h2>
        <form
          action={logReferral}
          className="mt-4 space-y-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px]">
              Partner kind
              <select
                name="partnerKind"
                required
                defaultValue="saas_partner"
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="saas_partner">SaaS Partner</option>
                <option value="product_affiliate">Product Affiliate</option>
              </select>
            </label>
            <label className="text-[11px]">
              Partner
              <select
                name="partnerId"
                required
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="">Pick a partner</option>
                <optgroup label="SaaS Partners">
                  {ecosystem.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Product Affiliates">
                  {affiliates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="text-[11px]">
              Referring member
              <select
                name="referrerUserId"
                required
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="">Pick a member</option>
                {members.map((u) => (
                  <option key={u.id} value={u.id}>
                    {publicName(u)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px]">
              Lead company (optional)
              <input
                name="leadCompany"
                type="text"
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
            <label className="text-[11px]">
              Lead contact name
              <input
                name="leadContactName"
                type="text"
                required
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
            <label className="text-[11px]">
              Lead contact email
              <input
                name="leadContactEmail"
                type="email"
                required
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
          </div>
          <label className="block text-[11px]">
            Notes (optional)
            <textarea
              name="notes"
              rows={2}
              placeholder="Context on the lead — how the intro happened, what they need."
              className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              className="fm-btn-primary rounded-full px-4 py-2 text-xs font-medium"
            >
              Log referral
            </button>
          </div>
        </form>
      </section>

      {/* Pending */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Pending</h2>
        {pending.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">No pending referrals.</p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((r) => (
              <li key={r.id}>
                <ReferralCard
                  r={r}
                  userById={userById}
                  partnerNameById={partnerNameById}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Converted */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Converted</h2>
        {converted.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No converted referrals yet.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {converted.map((r) => (
              <li key={r.id}>
                <ReferralCard
                  r={r}
                  userById={userById}
                  partnerNameById={partnerNameById}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Closed out (declined + expired) */}
      {closedOut.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">
            Closed out
          </h2>
          <ul className="mt-4 space-y-3">
            {closedOut.map((r) => (
              <li key={r.id}>
                <ReferralCard
                  r={r}
                  userById={userById}
                  partnerNameById={partnerNameById}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function partnerNameFor(
  names: Map<string, string>,
  r: PartnerReferral,
): string {
  return names.get(r.partnerId) ?? r.partnerId;
}

function ReferralCard({
  r,
  userById,
  partnerNameById,
}: {
  r: PartnerReferral;
  userById: Map<string, User>;
  partnerNameById: Map<string, string>;
}) {
  const referrer = userById.get(r.referrerUserId);
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardTitle className="text-lg">
            {r.leadContactName}
            {r.leadCompany && (
              <span className="ml-1 text-sm font-normal text-ink-faint">
                · {r.leadCompany}
              </span>
            )}
          </CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            To{" "}
            <span className="text-ink">{partnerNameFor(partnerNameById, r)}</span>{" "}
            ({PARTNER_REFERRAL_KIND_LABELS[r.partnerKind]}) · referred by{" "}
            {referrer ? (
              <span className="text-ink">{publicName(referrer)}</span>
            ) : (
              r.referrerUserId
            )}{" "}
            · {r.leadContactEmail}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider ${
            r.status === "converted"
              ? "bg-[#007048]/15 text-[#007048]"
              : r.status === "declined" || r.status === "expired"
                ? "bg-ink/10 text-ink-faint"
                : "bg-brand-magenta/15 text-brand-magentaText"
          }`}
        >
          {PARTNER_REFERRAL_STATUS_LABELS[r.status].split(" — ")[0]}
        </span>
      </div>

      {r.notes && (
        <p className="mt-2 text-[11px] italic text-ink-muted">
          {r.notes}
        </p>
      )}

      {r.status === "converted" && (
        <div className="mt-3 rounded-md border border-[#007048]/30 bg-[#007048]/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-[#007048]">
            Converted {r.convertedAt?.slice(0, 10)}
          </p>
          <p className="mt-1 text-sm">
            Deal size: {USD_FMT.format(Number(r.convertedAmountUsd ?? 0))} ·
            Revshare to FM:{" "}
            <strong>
              {USD_FMT.format(Number(r.revshareEarnedUsd ?? 0))}
            </strong>
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            Referrer earns their kick on the next settlement — 85% of
            the revshare to{" "}
            {referrer ? publicName(referrer) : r.referrerUserId}.
          </p>
        </div>
      )}

      {r.status === "declined" && r.declineReason && (
        <div className="mt-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">
            Declined {r.declinedAt?.slice(0, 10)}
          </p>
          <p className="mt-1 text-[11px] italic text-ink-muted">
            {r.declineReason}
          </p>
        </div>
      )}

      {r.status === "pending" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <form
            action={markReferralConverted}
            className="space-y-2 rounded-md border border-[var(--surface-border)] p-3"
          >
            <input type="hidden" name="id" value={r.id} />
            <p className="text-[11px] uppercase tracking-wider text-[#007048]">
              Mark converted
            </p>
            <label className="block text-[11px]">
              Deal size (USD)
              <input
                name="convertedAmountUsd"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-[11px]">
              Revshare to FM (USD)
              <input
                name="revshareEarnedUsd"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-[#007048] py-1.5 text-[11px] font-medium text-white hover:opacity-90"
            >
              Convert
            </button>
          </form>
          <form
            action={markReferralDeclined}
            className="space-y-2 rounded-md border border-[var(--surface-border)] p-3"
          >
            <input type="hidden" name="id" value={r.id} />
            <p className="text-[11px] uppercase tracking-wider text-ink-muted">
              Mark declined
            </p>
            <label className="block text-[11px]">
              Reason (required)
              <textarea
                name="declineReason"
                rows={2}
                required
                placeholder="What happened — didn't convert, wrong fit, etc."
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full border border-[var(--surface-border)] py-1.5 text-[11px] font-medium text-ink hover:bg-[var(--surface-inset)]"
            >
              Decline
            </button>
          </form>
        </div>
      )}

      <p className="mt-3 text-[10px] text-ink-faint">
        Logged {r.createdAt.slice(0, 10)} ·{" "}
        <Link
          href={`/admin/audit-log?resource=partner_referral`}
          className="hover:underline"
        >
          audit trail →
        </Link>
      </p>
    </Card>
  );
}
