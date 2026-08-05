/**
 * /feedback/confirm/[token] — client-facing confirmation surface
 * for admin-captured feedback.
 *
 * Auth-free by design. The token IS the credential (same shape as
 * the invoice / receipt / proposal magic-links). Renders the
 * captured rating + who captured it + the meeting-minute context,
 * then asks the client to confirm or dispute.
 *
 * Confirmed → stays in the composite math.
 * Disputed  → excluded from composite until admin resolves.
 * Already-decided → shows the current state, no further action.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_CUSTOMER_FEEDBACK } from "@/lib/mock-data/customer-feedback";
import { MOCK_MEETING_MINUTES } from "@/lib/mock-data/meeting-minutes";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  confirmClientFeedback,
  disputeClientFeedback,
} from "@/lib/client-feedback-confirmation-actions";
import { adminName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

export default async function ClientFeedbackConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const row = MOCK_CUSTOMER_FEEDBACK.find(
    (f) => f.clientConfirmationToken === token,
  );
  if (!row) notFound();

  const project = row.contextKind === "contract"
    ? MOCK_PROJECTS.find((p) => p.id === row.contextId)
    : null;
  const capturedByAdmin = row.capturedByAdminUserId
    ? MOCK_USERS.find((u) => u.id === row.capturedByAdminUserId)
    : null;
  const meetingMinute = row.meetingMinuteId
    ? MOCK_MEETING_MINUTES.find((m) => m.id === row.meetingMinuteId)
    : null;

  const isSettled =
    row.clientConfirmationStatus === "confirmed" ||
    row.clientConfirmationStatus === "disputed";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <div className="text-xs uppercase tracking-wider text-brand-magenta">
          $BUILD.Store · Feedback confirmation
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
          Confirm your rating
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          {capturedByAdmin
            ? `${capturedByAdmin.firstName} ${capturedByAdmin.lastName ?? ""}`.trim()
            : "Your Future Modern account owner"}
          {" "}captured a rating on your behalf during our recent
          conversation. Please confirm the value below is accurate,
          or dispute it if we got it wrong. If you'd rather submit
          the full form yourself, contact us and we&apos;ll send
          the questionnaire link.
        </p>
      </header>

      <Card className="mt-8">
        <CardEyebrow>What we captured</CardEyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-muted">
              Overall rating
            </p>
            <p className="mt-1 font-display text-3xl font-semibold">
              {row.overallStars} / 5
            </p>
          </div>
          <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-muted">
              Would hire again?
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {row.wouldHireAgain ? "Yes" : "No"}
            </p>
          </div>
        </div>
        {row.prose && (
          <div className="mt-3 rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-muted">
              Summary
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
              {row.prose}
            </p>
          </div>
        )}
        <div className="mt-4 space-y-1 text-[11px] text-ink-faint">
          {project && (
            <p>
              Engagement:{" "}
              <span className="text-ink">{project.title}</span>
            </p>
          )}
          {capturedByAdmin && (
            <p>
              Captured by:{" "}
              <span className="text-ink">{adminName(capturedByAdmin)}</span>
            </p>
          )}
          {row.captureContext && (
            <p>
              Context: <span className="text-ink">{row.captureContext}</span>
            </p>
          )}
          {meetingMinute && (
            <p>
              Meeting record:{" "}
              <code className="rounded bg-[var(--surface-inset)] px-1 py-0.5 text-[10px]">
                {meetingMinute.id}
              </code>
            </p>
          )}
        </div>
      </Card>

      {isSettled ? (
        <Card className="mt-6">
          <CardEyebrow>
            {row.clientConfirmationStatus === "confirmed"
              ? "Confirmed"
              : "Disputed"}
          </CardEyebrow>
          <CardTitle className="mt-1 text-lg">
            {row.clientConfirmationStatus === "confirmed"
              ? "Thanks — we've locked this in."
              : "Marked as disputed. Your account owner will follow up."}
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            {row.clientConfirmationStatus === "confirmed"
              ? "Your rating stays in the record and feeds our internal composite math. If anything changes, contact your Future Modern account owner."
              : "Someone from Future Modern will reach out to reconcile. If you want to submit the rating yourself instead, contact us and we'll send you the questionnaire."}
          </p>
          {row.clientConfirmedAt && (
            <p className="mt-3 text-[11px] text-ink-faint">
              Decision recorded {row.clientConfirmedAt.slice(0, 10)}.
            </p>
          )}
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardEyebrow>Confirm</CardEyebrow>
            <CardTitle className="mt-1 text-lg">
              This looks right
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Lock it in. Your rating stays in the composite math
              exactly as captured.
            </p>
            <form action={confirmClientFeedback} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-full bg-brand-magenta py-2.5 text-sm font-medium text-brand-white hover:bg-brand-magenta/90"
              >
                Confirm rating
              </button>
            </form>
          </Card>
          <Card>
            <CardEyebrow>Dispute</CardEyebrow>
            <CardTitle className="mt-1 text-lg">
              We got something wrong
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Mark as disputed. Your rating is excluded from the
              composite until we reconcile. Optional: tell us what
              was wrong.
            </p>
            <form action={disputeClientFeedback} className="mt-4 space-y-3">
              <input type="hidden" name="token" value={token} />
              <textarea
                name="disputeReason"
                rows={2}
                placeholder="What was wrong? (optional)"
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="w-full rounded-full border border-brand-magenta py-2.5 text-sm font-medium text-brand-magenta hover:bg-brand-magenta/5"
              >
                Dispute
              </button>
            </form>
          </Card>
        </div>
      )}

      <p className="mt-8 text-center text-[11px] text-ink-faint">
        <Link href="/" className="hover:underline">
          $BUILD.Store home
        </Link>
      </p>
    </div>
  );
}
