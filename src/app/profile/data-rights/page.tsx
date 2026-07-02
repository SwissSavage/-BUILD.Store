/**
 * /profile/data-rights — data subject rights surface.
 *
 * SOC 2 P5.1 / ISO 27001 A.18.1 / GDPR Art. 15+17 / CCPA §1798.100+105.
 * Sandbox stub: user submits an export or erasure request; server
 * action writes an audit entry + notifies admin pool for manual
 * follow-up. Production auto-fulfills within the regulatory window
 * (30 days GDPR / 45 days CCPA) and dispatches the JSON extract or
 * schedules the erasure job.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  requestDataExport,
  requestDataErasure,
} from "@/lib/data-rights-actions";
import { readAuditLog } from "@/lib/mock-data/audit-log";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function DataRightsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/data-rights");

  const priorRequests = readAuditLog({
    actorUserId: user.id,
  }).filter(
    (e) =>
      e.action === "data.subject_export_requested" ||
      e.action === "data.subject_erasure_requested",
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <CardEyebrow>Your data</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Data rights
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your data, your terms. Export it or erase it. Both requests
        audit-logged. Export within 30 days (GDPR). Erasure runs 30-day
        soft-delete then hard-delete; financial records retained per
        legal-hold.
      </p>

      <section className="mt-8">
        <Card>
          <CardEyebrow>Export</CardEyebrow>
          <CardTitle className="mt-2 text-xl">
            Download your data
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            JSON archive: profile, contributions, contract history,
            wallet ledger, recognitions, canonizations, meeting minutes,
            audit-log entries you were the actor on. Production
            dispatches by signed URL within 24 hours.
          </p>
          <form action={requestDataExport} className="mt-4 space-y-3">
            <label className="block text-xs text-ink-muted">
              Optional note to the ops team
              <textarea
                name="note"
                rows={2}
                maxLength={400}
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
                placeholder="Anything you want us to know about the request…"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
            >
              Request export
            </button>
          </form>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardEyebrow>Erasure</CardEyebrow>
          <CardTitle className="mt-2 text-xl">
            Erase your account
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            30-day soft-delete: account de-provisioned, profile hidden.
            Day 31: hard-delete. Financial records (contracts, comp
            decisions, wallet ledger) retained per business-records
            law — compliance-admin visible only, each with an audit
            entry at hard-delete.
          </p>
          <form action={requestDataErasure} className="mt-4 space-y-3">
            <label className="block text-xs text-ink-muted">
              Optional reason
              <textarea
                name="reason"
                rows={2}
                maxLength={400}
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
                placeholder="You don't owe us an explanation, but it helps us improve."
              />
            </label>
            <label className="block text-xs text-ink-muted">
              Confirmation — type <code className="text-brand-magenta">ERASE MY ACCOUNT</code>
              <input
                type="text"
                name="confirmation"
                required
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm font-mono text-ink"
                placeholder="ERASE MY ACCOUNT"
              />
            </label>
            <button
              type="submit"
              className="rounded-full border border-brand-magenta px-5 py-2 text-sm text-brand-magenta hover:bg-brand-magenta hover:text-white"
            >
              Begin erasure (30-day window)
            </button>
          </form>
        </Card>
      </section>

      <section className="mt-10">
        <CardEyebrow>Request history</CardEyebrow>
        {priorRequests.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No prior requests on file.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {priorRequests.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs uppercase tracking-wider text-brand-magenta">
                    {e.action === "data.subject_export_requested"
                      ? "Export requested"
                      : "Erasure requested"}
                  </span>
                  <span className="text-[10px] text-ink-faint">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                {e.reason && (
                  <p className="mt-1 text-xs italic text-ink-muted">
                    {e.reason.length > 200
                      ? `${e.reason.slice(0, 200)}…`
                      : e.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-10 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Compliance note
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Requests are recorded in the append-only audit log
          (SOC 2 CC7.2 / ISO 27001 A.12.4). The mapping to production
          fulfillment lives in{" "}
          <code className="text-brand-magenta">
            deliverables/compliance/soc2-iso27001-readiness.md
          </code>
          . If you have questions about how your data is handled,{" "}
          <Link href="/policies/privacy" className="text-brand-magenta hover:underline">
            see the privacy policy →
          </Link>
        </p>
      </div>
    </div>
  );
}
