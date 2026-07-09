/**
 * Admin: customer testimonial promotion queue (Phase 2.7).
 *
 * Two stacks on this page:
 *   1. Pending: customer feedback rows that arrived (via magic-link
 *      contract questionnaire OR buyer-side order questionnaire) and
 *      haven't been promoted to a public quote yet.
 *   2. Published: already promoted, with an unpublish escape hatch.
 *
 * Promotion flow is deliberately a manual scrub:
 *   - Admin reads the full prose
 *   - Pulls a single quote (pre-filled with the original prose, edits
 *     down to remove PII / sharpen the line)
 *   - Picks ONE contributor / seller to attach it to (the contract
 *     team or the order seller; the surface narrows the picker for you)
 *   - Submits → row gets publishedAt + publishedQuote + publishedForUserId,
 *     and the contributor gets a `testimonial_published` notification.
 *
 * Re-publish OVERWRITES (so admin can refine after a typo). Unpublish
 * flips the row back to private without deleting it.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_CUSTOMER_FEEDBACK,
  pendingFeedback,
} from "@/lib/mock-data/customer-feedback";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  declineGoogleReviewFollowup,
  markGoogleReviewFollowupSent,
  publishTestimonial,
  unpublishTestimonial,
} from "@/lib/customer-feedback-actions";
import {
  adminName,
  publicName,
  ATTRIBUTION_CONSENT_LABELS,
  GOOGLE_REVIEW_OPTIN_LABELS,
  GOOGLE_REVIEW_FOLLOWUP_LABELS,
  type CustomerFeedback,
  type User,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_dcg: "Direct Connect Global",
  client_bk_greenroots: "Brooklyn GreenRoots",
  client_arborai: "ArborAI",
};

function eligibleAttributees(row: CustomerFeedback): User[] {
  if (row.contextKind === "contract") {
    const project = MOCK_PROJECTS.find((p) => p.id === row.contextId);
    if (!project) return [];
    return project.assignedMemberIds
      .map((id) => MOCK_USERS.find((u) => u.id === id))
      .filter((u): u is User => Boolean(u));
  }
  // marketplace_order
  const order = MOCK_ORDERS.find((o) => o.id === row.contextId);
  if (!order) return [];
  const seller = MOCK_USERS.find((u) => u.id === order.sellerId);
  return seller ? [seller] : [];
}

function contextLabel(row: CustomerFeedback): string {
  if (row.contextKind === "contract") {
    const project = MOCK_PROJECTS.find((p) => p.id === row.contextId);
    if (!project) return row.contextId;
    const client = CLIENT_LABELS[project.clientId] ?? project.clientId;
    return `${project.title} · ${client}`;
  }
  const order = MOCK_ORDERS.find((o) => o.id === row.contextId);
  return order ? `Order ${order.number}` : row.contextId;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminTestimonialsPage() {
  await requireAdmin();

  const pending = pendingFeedback();
  const published = MOCK_CUSTOMER_FEEDBACK.filter(
    (f) => f.publishedAt !== null,
  ).sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Beta operations</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Testimonial promotion queue
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Customer feedback lands here first. Pull a clean line and
            promote it to one contributor&apos;s public-to-members
            profile. Never published verbatim.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          ← Admin home
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Pending ({pending.length})
        </h2>
        <div className="mt-4 space-y-5">
          {pending.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                Inbox zero. No customer feedback waiting on a publishing
                decision.
              </p>
            </Card>
          ) : (
            pending.map((row) => (
              <PendingRow key={row.id} row={row} />
            ))
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Published ({published.length})
        </h2>
        <div className="mt-4 space-y-4">
          {published.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                No testimonials live yet.
              </p>
            </Card>
          ) : (
            published.map((row) => (
              <PublishedRow key={row.id} row={row} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PendingRow({ row }: { row: CustomerFeedback }) {
  const targets = eligibleAttributees(row);
  const consent = row.attributionConsent;
  const publishingBlocked =
    consent === null || consent === "internal_only";
  const reviewOptedIn = row.googleReviewOptIn === "yes_send_link";

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>{contextLabel(row)}</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            {row.customerName} · {row.overallStars}★
          </CardTitle>
        </div>
        <span className="text-xs text-ink-faint">
          {formatDate(row.createdAt)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-ink-muted md:grid-cols-4">
        <span>Overall: {row.overallStars}★</span>
        <span>Met expectations: {row.metExpectations}★</span>
        <span>Communication: {row.communication}★</span>
        <span>
          Re-engage: {row.wouldHireAgain ? "Yes" : "No"}
        </span>
      </div>

      <p className="mt-4 rounded-lg bg-[var(--surface-inset)] p-3 text-sm italic">
        &ldquo;{row.prose}&rdquo;
      </p>
      <p className="mt-2 text-[11px] text-ink-faint">
        From {row.customerName} · {row.customerEmail}
      </p>

      <div className="mt-4 grid gap-2 rounded-lg border border-[var(--surface-border)] p-3 text-xs md:grid-cols-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">
            Stood out
          </div>
          <div className="mt-0.5 text-ink-muted">
            {row.contributorShoutout ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">
            Attribution
          </div>
          <div
            className={
              "mt-0.5 " +
              (publishingBlocked ? "text-brand-magenta" : "text-ink-muted")
            }
          >
            {consent
              ? ATTRIBUTION_CONSENT_LABELS[consent]
              : "Missing. Treat as internal only."}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">
            Google Review
          </div>
          <div className="mt-0.5 text-ink-muted">
            {row.googleReviewOptIn
              ? GOOGLE_REVIEW_OPTIN_LABELS[row.googleReviewOptIn]
              : "—"}
            {row.googleReviewFollowupStatus && (
              <span className="ml-1 text-ink-faint">
                ({GOOGLE_REVIEW_FOLLOWUP_LABELS[row.googleReviewFollowupStatus]})
              </span>
            )}
          </div>
        </div>
      </div>

      {reviewOptedIn && row.googleReviewFollowupStatus !== "sent" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={markGoogleReviewFollowupSent}>
            <input type="hidden" name="feedbackId" value={row.id} />
            <button
              type="submit"
              className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Mark Google Review email sent
            </button>
          </form>
          {row.googleReviewFollowupStatus !== "declined" && (
            <form action={declineGoogleReviewFollowup}>
              <input type="hidden" name="feedbackId" value={row.id} />
              <button
                type="submit"
                className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
              >
                Decline follow-up
              </button>
            </form>
          )}
        </div>
      )}

      {publishingBlocked ? (
        <p className="mt-5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs text-ink-muted">
          Customer did not consent to external attribution. This row stays
          in the queue for internal calibration only. It cannot be
          published as a testimonial.
        </p>
      ) : targets.length === 0 ? (
        <p className="mt-4 text-xs text-brand-magenta">
          No contributors associated with this context. Can&apos;t
          promote until the team list is populated.
        </p>
      ) : (
        <form action={publishTestimonial} className="mt-5 space-y-3">
          <input type="hidden" name="feedbackId" value={row.id} />

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Quote (PII-scrubbed, ≤ original length)
            </span>
            <textarea
              name="publishedQuote"
              required
              rows={3}
              defaultValue={row.prose}
              maxLength={row.prose.length}
              minLength={20}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Attribute to
            </span>
            <select
              name="publishedForUserId"
              required
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Pick a contributor
              </option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {adminName(t)} (@{t.handle})
                </option>
              ))}
            </select>
          </label>

          {row.contributorShoutout && (
            <p className="text-[11px] text-ink-faint">
              Customer shoutout: <em>{row.contributorShoutout}</em>. Try to
              land attribution on the named person.
            </p>
          )}

          <button
            type="submit"
            className="rounded-full px-5 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Publish testimonial
          </button>
        </form>
      )}
    </Card>
  );
}

function PublishedRow({ row }: { row: CustomerFeedback }) {
  const target = MOCK_USERS.find((u) => u.id === row.publishedForUserId);
  return (
    <Card className="border-[#007048]/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>{contextLabel(row)}</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            On {target ? publicName(target) : "—"}&apos;s profile
          </CardTitle>
        </div>
        <span className="text-xs text-[#007048]">
          Published {formatDate(row.publishedAt ?? row.createdAt)}
        </span>
      </div>

      <p className="mt-3 rounded-lg bg-[var(--surface-inset)] p-3 text-sm italic">
        &ldquo;{row.publishedQuote}&rdquo;
      </p>
      <p className="mt-2 text-[11px] text-ink-faint">
        Original: {row.customerName} · {row.customerEmail} ·{" "}
        {row.overallStars}★
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {target && (
          <Link
            href={`/u/${target.handle}`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            View on profile ↗
          </Link>
        )}
        <form action={unpublishTestimonial}>
          <input type="hidden" name="feedbackId" value={row.id} />
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Unpublish
          </button>
        </form>
      </div>
    </Card>
  );
}
