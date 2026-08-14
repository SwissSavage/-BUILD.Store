/**
 * /admin/agreements — signed paperwork registry surface.
 *
 * The single source of truth for "who signed what, when." Every
 * paperwork event (talent-data release, membership covenant, LOI,
 * seller agreement, contributor agreement) lives in one Agreement
 * row. Gate helpers in the rest of the app read from this store to
 * answer questions like "does this member have a current talent-data
 * release on file?"
 *
 * Layout:
 *   1. Author-new form (top) — pick a user, agreement type, provider,
 *      version, signed date, and optional external ref / storage
 *      pointer / notes.
 *   2. Existing rows grouped by user, freshest signature first,
 *      with a Remove action and a light-weight edit affordance.
 *   3. OG unmatched-holder rail — placeholder while the on-chain
 *      reconciliation isn't wired. See task #258 for the eventual
 *      cross-reference against $BUILD holder addresses.
 *
 * Gated to admin. Every mutation writes to the audit log.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_AGREEMENTS } from "@/lib/mock-data/agreements";
import { publicName } from "@/lib/types";
import type { Agreement } from "@/lib/types";
import {
  AGREEMENT_PROVIDER_LABELS,
  AGREEMENT_TYPE_LABELS,
} from "@/lib/types";
import { createAgreement, removeAgreement, sendLoiForSignature, sendNcndaForSignature } from "@/lib/agreement-actions";

import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

/**
 * Pick the user roster the author form allows to attach agreements
 * to. Members + Partners + Prospects only — Viewers don't have a
 * relationship that would warrant paperwork yet. Admins can attach
 * paperwork to themselves (founder covenant, self-signed talent
 * releases).
 */
function agreementCandidates() {
  return [...MOCK_USERS]
    .filter(
      (u) =>
        u.membershipTier === "member" ||
        u.membershipTier === "partner" ||
        u.membershipTier === "prospect",
    )
    .sort((a, b) =>
      publicName(a).localeCompare(publicName(b), "en", { sensitivity: "base" }),
    );
}

/** Group agreements by user, freshest signature first within each group. */
function groupAgreementsByUser(rows: Agreement[]): Map<string, Agreement[]> {
  const byUser = new Map<string, Agreement[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  }
  return byUser;
}

/**
 * Warning message for rows with soft-validation gaps. Adobe Sign /
 * DocuSign entries should carry externalRef; manual entries should
 * carry storageUrl or an explanatory note. Returns null when the row
 * looks clean.
 */
function warningFor(row: Agreement): string | null {
  if (
    (row.provider === "adobesign" || row.provider === "docusign") &&
    !row.externalRef
  ) {
    return `${AGREEMENT_PROVIDER_LABELS[row.provider]}: externalRef missing. Add the envelope id.`;
  }
  if (row.provider === "manual" && !row.storageUrl && !row.notes) {
    return "Manual entry has no storageUrl or notes. File the countersigned artifact under signed-agreements/ and record the path.";
  }
  return null;
}

/**
 * Format an ISO signed-at as `YYYY-MM-DD` for compact table display.
 * Full timestamp is available on hover via `title=`.
 */
function formatSignedAt(iso: string): string {
  return iso.slice(0, 10);
}

export default async function AdminAgreementsPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/agreements");

  const rows = [...MOCK_AGREEMENTS].sort((a, b) =>
    b.signedAt.localeCompare(a.signedAt),
  );
  const grouped = groupAgreementsByUser(rows);
  const candidates = agreementCandidates();

  const totalRows = rows.length;
  const totalWarnings = rows.filter((r) => warningFor(r) !== null).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Signed agreements</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Paperwork registry
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            The single source of truth for who signed what, when. One
            row per signature event — re-signing a revised covenant
            creates a new row, the old row stays for the historical
            record. Gate helpers across the platform read from this
            store to answer "does this member have a current signature
            on record?"
          </p>
        </div>
        <div className="text-right text-xs text-ink-faint">
          <p>
            {totalRows} row{totalRows === 1 ? "" : "s"} on file
          </p>
          {totalWarnings > 0 && (
            <p className="text-brand-magenta">
              {totalWarnings} row{totalWarnings === 1 ? "" : "s"} need
              attention
            </p>
          )}
        </div>
      </div>

      {/* Send Talent Partner LOI via Documenso */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Send Talent Partner LOI for signature
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Dispatches the FM-branded LOI template through Documenso
          (self-hosted at sign.afuturemodern.com). The invitee receives
          an email with the signing link. On completion, the webhook
          handler auto-creates an Agreement row here with provider=
          <code className="mx-1 rounded bg-[var(--surface-inset)] px-1 py-0.5 text-[11px]">
            documenso
          </code>
          and signature status advanced to
          <code className="mx-1 rounded bg-[var(--surface-inset)] px-1 py-0.5 text-[11px]">
            completed
          </code>
          .
        </p>

        <form
          action={sendLoiForSignature}
          className="mt-6 space-y-4 rounded-2xl border border-brand-magenta/20 bg-brand-magenta/[0.03] p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="loi-userId"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Invitee
              </label>
              <select
                id="loi-userId"
                name="userId"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pick a user
                </option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {publicName(u)} · {u.membershipTier}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="loi-email"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Recipient email (optional override)
              </label>
              <input
                id="loi-email"
                name="recipientEmail"
                type="email"
                placeholder="Defaults to the user's account email"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              Send LOI for signature
            </button>
          </div>
        </form>
      </section>


      {/* Send Mutual NCNDA via Documenso — bilateral variant */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Send Mutual NCNDA for signature
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Client outreach paperwork. Bilateral for one counterparty,
          multi-party (up to three) when the deal involves multiple
          entities. Signer accounts are not required on Documenso; the
          counterparty just clicks the link in the email. Retroactive
          receipt-style account-required assurance is not enabled for
          NCNDAs — signature is via email link only.
        </p>

        {/* Bilateral variant */}
        <form
          action={sendNcndaForSignature}
          className="mt-6 space-y-4 rounded-2xl border border-brand-magenta/20 bg-brand-magenta/[0.03] p-6"
        >
          <input type="hidden" name="variant" value="bilateral" />
          <div>
            <CardEyebrow>Bilateral · FM + 1 counterparty</CardEyebrow>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="ncnda-1-name"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Counterparty name
              </label>
              <input
                id="ncnda-1-name"
                name="name_1"
                type="text"
                required
                placeholder="Jane Doe"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="ncnda-1-email"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Email
              </label>
              <input
                id="ncnda-1-email"
                name="email_1"
                type="email"
                required
                placeholder="jane@example.com"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="ncnda-1-company"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Company (optional)
              </label>
              <input
                id="ncnda-1-company"
                name="company_1"
                type="text"
                placeholder="Acme Ventures"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              Send bilateral NCNDA
            </button>
          </div>
        </form>

        {/* Multi-party variant */}
        <form
          action={sendNcndaForSignature}
          className="mt-4 space-y-4 rounded-2xl border border-brand-blue/20 bg-brand-blue/[0.03] p-6"
        >
          <input type="hidden" name="variant" value="multi" />
          <div>
            <CardEyebrow>Multi-party · FM + up to 3 counterparties</CardEyebrow>
            <p className="mt-1 text-[11px] text-ink-faint">
              Counterparty 1 is required. 2 and 3 are optional; leave
              blank if unused.
            </p>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid gap-4 md:grid-cols-3">
              <div>
                <label
                  htmlFor={`ncnda-m${i}-name`}
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  {i === 1 ? "Counterparty 1 name" : `Counterparty ${i} name (optional)`}
                </label>
                <input
                  id={`ncnda-m${i}-name`}
                  name={`name_${i}`}
                  type="text"
                  required={i === 1}
                  placeholder={i === 1 ? "Jane Doe" : ""}
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`ncnda-m${i}-email`}
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Email
                </label>
                <input
                  id={`ncnda-m${i}-email`}
                  name={`email_${i}`}
                  type="email"
                  required={i === 1}
                  placeholder={i === 1 ? "jane@example.com" : ""}
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`ncnda-m${i}-company`}
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Company (optional)
                </label>
                <input
                  id={`ncnda-m${i}-company`}
                  name={`company_${i}`}
                  type="text"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-brand-blue px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-blue/20 transition-colors hover:bg-brand-blue/90"
            >
              Send multi-party NCNDA
            </button>
          </div>
        </form>
      </section>

      {/* Author a new agreement */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Log a signed agreement
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Attach to an existing user + agreement type. Provider-native
          entries (Adobe Sign / DocuSign) should include the envelope
          id in externalRef. Manual entries should point storageUrl
          at the filed artifact under
          <code className="ml-1 rounded bg-[var(--surface-inset)] px-1 py-0.5 text-[11px]">
            Future Modern/deliverables/legal/signed-agreements/
          </code>
          .
        </p>

        <form
          action={createAgreement}
          className="mt-6 space-y-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="userId"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                User
              </label>
              <select
                id="userId"
                name="userId"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">Pick a user</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {publicName(u)} · {u.membershipTier}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="agreementType"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Type
              </label>
              <select
                id="agreementType"
                name="agreementType"
                required
                defaultValue="talent_data"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {(Object.keys(AGREEMENT_TYPE_LABELS) as Array<
                  keyof typeof AGREEMENT_TYPE_LABELS
                >).map((t) => (
                  <option key={t} value={t}>
                    {AGREEMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="version"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Version
              </label>
              <input
                id="version"
                name="version"
                type="text"
                placeholder="1.0"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="signedAt"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Signed at
              </label>
              <input
                id="signedAt"
                name="signedAt"
                type="date"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="provider"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Provider
              </label>
              <select
                id="provider"
                name="provider"
                required
                defaultValue="adobesign"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {(Object.keys(AGREEMENT_PROVIDER_LABELS) as Array<
                  keyof typeof AGREEMENT_PROVIDER_LABELS
                >).map((p) => (
                  <option key={p} value={p}>
                    {AGREEMENT_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="externalRef"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              External ref (optional)
            </label>
            <input
              id="externalRef"
              name="externalRef"
              type="text"
              placeholder="Adobe Sign / DocuSign envelope id"
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="storageUrl"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Storage URL (optional)
            </label>
            <input
              id="storageUrl"
              name="storageUrl"
              type="text"
              placeholder="Future Modern/deliverables/legal/signed-agreements/2026-07-30-example.pdf"
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-xs uppercase tracking-wider text-ink-muted"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Countersignature dates, cross-reference notes, redline commentary."
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
            >
              Log agreement
            </button>
          </div>
        </form>
      </section>

      {/* Existing rows, grouped by user */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">On file</h2>
        {grouped.size === 0 ? (
          <Card className="mt-6">
            <p className="text-sm text-ink-muted">
              No agreements on record yet. Log the first one above.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-4">
            {Array.from(grouped.entries()).map(([userId, userRows]) => {
              const user = MOCK_USERS.find((u) => u.id === userId);
              if (!user) return null;
              return (
                <li key={userId}>
                  <Card>
                    <div className="flex items-center gap-3">
                      <Avatar user={user} size="sm" />
                      <div className="min-w-0">
                        <CardTitle className="text-lg">
                          {publicName(user)}
                        </CardTitle>
                        <p className="text-[11px] text-ink-faint">
                          {user.membershipTier} · {userRows.length} agreement
                          {userRows.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-4 divide-y divide-[var(--surface-border)]">
                      {userRows.map((row) => {
                        const warning = warningFor(row);
                        return (
                          <li key={row.id} className="py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">
                                  {AGREEMENT_TYPE_LABELS[row.agreementType]}{" "}
                                  <span className="text-ink-faint">
                                    v{row.version}
                                  </span>
                                </p>
                                <p className="text-[11px] text-ink-faint">
                                  {AGREEMENT_PROVIDER_LABELS[row.provider]}
                                  {" · "}
                                  <span title={row.signedAt}>
                                    Signed {formatSignedAt(row.signedAt)}
                                  </span>
                                </p>
                              </div>
                              <form action={removeAgreement}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={row.id}
                                />
                                <button
                                  type="submit"
                                  className="text-xs text-ink-faint hover:text-brand-magenta"
                                >
                                  Remove
                                </button>
                              </form>
                            </div>

                            {row.externalRef && (
                              <p className="mt-1 text-[11px] text-ink-faint">
                                Ref:{" "}
                                <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
                                  {row.externalRef}
                                </code>
                              </p>
                            )}
                            {row.storageUrl && (
                              <p className="mt-1 text-[11px] text-ink-faint break-all">
                                Storage:{" "}
                                <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5">
                                  {row.storageUrl}
                                </code>
                              </p>
                            )}
                            {row.notes && (
                              <p className="mt-1 text-[11px] text-ink-muted">
                                {row.notes}
                              </p>
                            )}
                            {warning && (
                              <p className="mt-2 rounded-md border border-brand-magenta/30 bg-brand-magenta/5 px-2 py-1 text-[11px] text-brand-magenta">
                                {warning}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* OG unmatched-holder rail — placeholder for task #258 */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Unmatched holders — OG onboarding
        </h2>
        <Card className="mt-4">
          <p className="text-sm text-ink-muted">
            When an on-chain $BUILD holder appears with no matching
            Agreement row, they surface here for outreach. That is
            expected for original contributors who predate the
            paperwork registry — treat as onboarding backlog, not
            compliance failure. Reach out, get them caught up on
            talent-data + membership covenant, and they get filed
            here.
          </p>
          <p className="mt-3 text-[11px] text-ink-faint">
            On-chain cross-reference not wired yet. See{" "}
            <Link
              href="/admin/audit-log"
              className="text-brand-magenta hover:underline"
            >
              /admin/audit-log
            </Link>{" "}
            for the current agreement-mutation trail.
          </p>
        </Card>
      </section>
    </div>
  );
}
