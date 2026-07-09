/**
 * /policies/privacy — Privacy Policy sandbox draft.
 *
 * Framework anchors: SOC 2 P1.1 (notice), P5.1 (access/correction/
 * erasure), GDPR Art. 13-14, CCPA §1798.100.
 *
 * Every claim below maps to a concrete implementation somewhere in
 * this codebase — no gap between what the policy says and what the
 * code does. The purpose of publishing this at all is that the
 * cooperative can honor a data subject request without a legal
 * dependency (privacy is not something you outsource).
 */
import Link from "next/link";
import { CardEyebrow } from "@/components/Card";

/** Static-rendered. Privacy Policy is a published document. */
export const dynamic = "force-static";

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Policy</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Privacy Policy
      </h1>
      <p className="mt-2 text-xs text-ink-faint">
        Version 0.1 · Last reviewed 2026-07-01 · Sandbox draft
      </p>

      <div
        className="mt-6 rounded-2xl border px-5 py-4"
        style={{
          borderColor: "rgba(80, 112, 240, 0.35)",
          backgroundColor: "rgba(80, 112, 240, 0.06)",
        }}
      >
        <p
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "#5070F0" }}
        >
          Sandbox draft
        </p>
        <p className="mt-1 text-sm text-ink">
          Working draft. Production version carries counsel review and a
          signed effective-date footer.
        </p>
      </div>

      <section className="prose prose-invert mt-8 max-w-none text-ink-muted">
        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Who we are
        </h2>
        <p className="mt-2 text-sm">
          <strong className="text-ink">Future Modern Builderberg LLC</strong>{" "}
          (&ldquo;Future Modern,&rdquo; &ldquo;we,&rdquo; &ldquo;the
          cooperative&rdquo;) operates $BUILD.Store, a unified
          cooperative platform for creative work, technology, and
          professional services. Registered in Florida.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          What we collect
        </h2>
        <p className="mt-2 text-sm">
          We collect three categories of data:
        </p>
        <ul className="mt-2 space-y-2 pl-6 text-sm">
          <li>
            <strong className="text-ink">Identity + contact.</strong>{" "}
            First name, last name, email, and (optionally) phone. We
            display first-name-only on public surfaces; full names are
            confined to admin and Member-internal views.
          </li>
          <li>
            <strong className="text-ink">Contribution record.</strong>{" "}
            Contracts you were credited on, milestones you completed,
            peer reviews you gave or received, MVP score sub-ratings,
            recognitions, canonizations. This is the cooperative canon.
          </li>
          <li>
            <strong className="text-ink">Financial.</strong> Wallet
            address (ERC-6551), Stripe payout destination (if
            configured), and per-contract compensation records.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Why we collect it
        </h2>
        <ul className="mt-2 space-y-2 pl-6 text-sm">
          <li>
            Operate the platform (route work, credit contributions,
            settle payouts).
          </li>
          <li>
            Maintain the cooperative canon (recognitions, canonizations,
            trading cards).
          </li>
          <li>
            Comply with law (tax reporting on payouts, business-records
            retention).
          </li>
          <li>
            Improve the platform (aggregate, non-personal analytics on
            engagement).
          </li>
        </ul>
        <p className="mt-2 text-sm">
          We do <strong className="text-ink">not</strong> sell personal
          data. We do not run behavioral advertising. We do not
          fingerprint. If you disable analytics cookies we retain full
          service access.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Who we share it with
        </h2>
        <p className="mt-2 text-sm">
          See the{" "}
          <Link
            href="/policies/subprocessors"
            className="text-brand-magenta hover:underline"
          >
            Subprocessor Registry
          </Link>{" "}
          for the current list of third parties that process cooperative
          data. Categories include payments, CRM, email delivery,
          hosting, and (for meeting-minute ingestion) transcript
          providers you have connected on your own account.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          How long we keep it
        </h2>
        <ul className="mt-2 space-y-2 pl-6 text-sm">
          <li>
            <strong className="text-ink">Active accounts:</strong> for
            the life of the account plus 90 days after account close.
          </li>
          <li>
            <strong className="text-ink">Financial records:</strong>{" "}
            seven years after the transaction, per business-records
            retention standards. This includes contracts, compensation
            decisions, wallet ledger entries.
          </li>
          <li>
            <strong className="text-ink">Audit log:</strong> twelve
            months hot for operational review; seven years cold for
            financial and compliance subset. See{" "}
            <Link href="/admin/compliance" className="text-brand-magenta hover:underline">
              compliance controls
            </Link>{" "}
            (admin-only) for the mapping.
          </li>
          <li>
            <strong className="text-ink">Aggregate analytics:</strong>{" "}
            indefinite, but only in anonymized aggregate form.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Your rights
        </h2>
        <p className="mt-2 text-sm">
          Regardless of jurisdiction, you can:
        </p>
        <ul className="mt-2 space-y-2 pl-6 text-sm">
          <li>Get a copy of the data we hold about you.</li>
          <li>Correct anything that&apos;s wrong.</li>
          <li>Ask us to erase your account.</li>
          <li>Toggle whether your profile is publicly discoverable.</li>
        </ul>
        <p className="mt-2 text-sm">
          The self-service surface is at{" "}
          <Link
            href="/profile/data-rights"
            className="text-brand-magenta hover:underline"
          >
            /profile/data-rights
          </Link>
          . Requests are logged to the immutable audit trail so you have
          a durable record of the ask and the response.
        </p>
        <p className="mt-2 text-sm">
          Regulatory windows we honor: 30 days for the GDPR export/
          erasure right (Art. 15+17), 45 days for the CCPA right to know
          / delete (§1798.100+105). Erasure runs a 30-day soft-delete
          window followed by hard-delete on day 31, with the financial
          subset retained per legal hold and each retained record
          audit-stamped at hard-delete.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          How we protect it
        </h2>
        <p className="mt-2 text-sm">
          Encryption in transit (TLS 1.3 minimum), encryption at rest,
          role-based access with quarterly review, and an append-only
          audit log recording every consequential mutation. Customer-
          facing summary at{" "}
          <Link
            href="/trust"
            className="text-brand-magenta hover:underline"
          >
            /trust
          </Link>
          ; the long-form technical audit lives at{" "}
          <code>deliverables/compliance/soc2-iso27001-readiness.md</code>.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Children
        </h2>
        <p className="mt-2 text-sm">
          The cooperative is intended for professional use. We do not
          knowingly collect data from anyone under 18. If you believe a
          minor has an account, contact us and we will erase the record.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Changes to this policy
        </h2>
        <p className="mt-2 text-sm">
          We publish material changes at least 30 days before they take
          effect and notify active Members by in-app notification.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold text-ink">
          Contact
        </h2>
        <p className="mt-2 text-sm">
          Privacy questions: <code>privacy@buildstore</code> (production).
          Sandbox: use the{" "}
          <Link href="/contact" className="text-brand-magenta hover:underline">
            /contact
          </Link>{" "}
          form.
        </p>
      </section>
    </div>
  );
}
