"use client";

/**
 * Confirm your email before you decide on a proposal.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * Reading the quote needs nothing: a champion forwarding it up the
 * ladder is the motion working. Deciding needs a mailbox, because
 * before this anyone with the URL could approve the engagement, pick
 * the lead builder and type any address, which then became the address
 * the SOW envelope went to.
 *
 * Two steps, deliberately small. Name and email, then a six-digit code.
 * No account, no password, nothing to remember, which is the same
 * ceremony every e-signature product uses and the reason it does not
 * cost a deal.
 *
 * Both actions RETURN their result rather than throwing. Next redacts
 * server action error messages in production, so a thrown error renders
 * as a blank page in front of a buyer. Same useActionState shape as
 * ApplyToJobForm.
 * ─────────────────────────────────────────────────────────────
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestQuoteAccessCode,
  verifyQuoteAccessCode,
  type QuoteVerificationResult,
} from "@/lib/quote-verification-actions";

export function QuoteSignerVerification({
  clientToken,
}: {
  clientToken: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [requestState, requestAction, requesting] = useActionState<
    QuoteVerificationResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await requestQuoteAccessCode(prev, formData);
    if (result.ok) setSent(true);
    return result;
  }, null);

  const [verifyState, verifyAction, verifying] = useActionState<
    QuoteVerificationResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await verifyQuoteAccessCode(prev, formData);
    // The decision controls live in a server component above this one,
    // so the page has to re-render for them to appear.
    if (result.ok) router.refresh();
    return result;
  }, null);

  return (
    <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <p className="text-[11px] uppercase tracking-wider text-ink-muted">
        Confirm it&apos;s you
      </p>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Anyone can read this proposal. Approving or declining it puts a
        name on an agreement, so we send a code to the address that
        signs. No account needed.
      </p>

      {!sent ? (
        <form action={requestAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="token" value={clientToken} />
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Your name
            </span>
            <input
              type="text"
              name="name"
              required
              minLength={2}
              placeholder="Full name"
              disabled={requesting}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Your email
            </span>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={requesting}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={requesting}
              className="fm-btn-primary inline-flex items-center rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {requesting ? "Sending…" : "Send me a code"}
            </button>
          </div>
        </form>
      ) : (
        <form action={verifyAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="token" value={clientToken} />
          <input type="hidden" name="email" value={email} />
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Six-digit code
            </span>
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              disabled={verifying}
              className="mt-1 w-40 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-lg tracking-[0.3em] placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={verifying}
            className="fm-btn-primary inline-flex items-center rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {verifying ? "Checking…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
          >
            Use a different address
          </button>
        </form>
      )}

      {requestState && !requestState.ok && (
        <p className="mt-3 text-sm text-red-500">{requestState.error}</p>
      )}
      {requestState?.ok && !verifyState?.ok && (
        <p className="mt-3 text-sm text-ink-muted">{requestState.message}</p>
      )}
      {verifyState && !verifyState.ok && (
        <p className="mt-3 text-sm text-red-500">{verifyState.error}</p>
      )}
    </div>
  );
}
