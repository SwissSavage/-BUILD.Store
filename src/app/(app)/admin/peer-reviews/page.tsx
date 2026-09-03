/**
 * Admin: peer review triage.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-09-03)
 *
 * Peer reviews were invisible. `submitPeerReview` inserted rows,
 * `recomputeMvpScore` turned them into OVR, OVR set the standing band
 * and the trading card tier, and no admin surface rendered a single
 * one. The comment at the top of peer-review-actions.ts says
 * attribution is shown on /admin/feedback; that route reads
 * `feedback_entries`, which is beta product feedback. Different table,
 * different thing.
 *
 * So one contributor could move another's standing, permanently, and
 * nobody could see it had happened, let alone undo it. That runs
 * against the rule that members keep their tier until the community
 * removes them. One reviewer is not the community.
 *
 * This page is the missing read. The void control is the missing
 * write. There is no edit control, on purpose: an admin who could
 * rewrite a score could rewrite standing quietly, and the whole point
 * of the MVP rail is that standing is legible.
 *
 * ANONYMITY: the locked posture (2026-04-25) is that reviews are
 * anonymous to contributors and attributed to admins. This is an admin
 * route behind requireAdmin, so reviewer names render here and must
 * not be echoed onto any contributor-facing surface.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllPeerReviews, safely } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import {
  voidPeerReview,
  restorePeerReview,
} from "@/lib/peer-review-admin-actions";
import { adminName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

type SearchParams = { show?: string; reviewee?: string };

export default async function AdminPeerReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { show, reviewee } = await searchParams;

  const [reviews, { users }] = await Promise.all([
    safely(() => getAllPeerReviews(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);

  const byId = new Map(users.map((u) => [u.id, u]));
  const nameOf = (id: string) => adminName(byId.get(id));

  const voidedCount = reviews.filter((r) => r.voidedAt).length;
  const liveCount = reviews.length - voidedCount;

  let shown = reviews;
  if (show === "voided") shown = shown.filter((r) => r.voidedAt);
  else if (show !== "all") shown = shown.filter((r) => !r.voidedAt);
  if (reviewee) shown = shown.filter((r) => r.revieweeId === reviewee);

  // Reviewers whose reviews keep getting voided. This is the reason
  // voiding is soft: the pattern only exists while the rows do.
  const voidsByReviewer = new Map<string, number>();
  for (const r of reviews) {
    if (!r.voidedAt) continue;
    voidsByReviewer.set(
      r.reviewerId,
      (voidsByReviewer.get(r.reviewerId) ?? 0) + 1,
    );
  }
  const repeatOffenders = [...voidsByReviewer.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  const filters: { key: string; label: string; count: number }[] = [
    { key: "live", label: "Counting", count: liveCount },
    { key: "voided", label: "Voided", count: voidedCount },
    { key: "all", label: "All", count: reviews.length },
  ];
  const active = show === "voided" || show === "all" ? show : "live";

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <CardEyebrow>Admin</CardEyebrow>
      <CardTitle className="mt-1">Peer reviews</CardTitle>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Every review contributors have written about each other. These
        feed OVR, which sets standing band, card tier and promotion
        eligibility, so a review left in error moves someone&apos;s
        standing until it is voided. Voiding removes it from every
        aggregate and recomputes the reviewee on the spot. It does not
        delete the row.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/peer-reviews?show=${f.key}`}
            className={
              active === f.key
                ? "rounded-full bg-brand-magenta px-4 py-1.5 font-medium text-white"
                : "rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
            }
          >
            {f.label} ({f.count})
          </Link>
        ))}
        {reviewee && (
          <Link
            href={`/admin/peer-reviews?show=${active}`}
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-ink-muted hover:border-brand-magenta"
          >
            Clear filter on {nameOf(reviewee)}
          </Link>
        )}
      </div>

      {repeatOffenders.length > 0 && (
        <Card className="mt-6 border-brand-magenta/40">
          <CardEyebrow>Worth a look</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            More than one voided review from the same reviewer. Not
            proof of anything on its own, but it is the shape a pattern
            makes.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {repeatOffenders.map(([id, n]) => (
              <li key={id}>
                {nameOf(id)}: {n} voided
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reviews.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">
            No peer reviews have been submitted yet. Reviews open when a
            multi-person engagement is marked completed, so this stays
            empty until the first one closes out.
          </p>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">
            Nothing matches this filter. {liveCount} counting,{" "}
            {voidedCount} voided.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {shown.map((r) => (
            <Card key={r.id} className={r.voidedAt ? "opacity-70" : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm">
                    <Link
                      href={`/admin/peer-reviews?show=${active}&reviewee=${r.revieweeId}`}
                      className="font-medium hover:text-brand-magenta"
                    >
                      {nameOf(r.revieweeId)}
                    </Link>{" "}
                    <span className="text-ink-faint">reviewed by</span>{" "}
                    <span className="font-medium">{nameOf(r.reviewerId)}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {r.contextKind === "contract" ? "Contract" : "Project"}{" "}
                    {r.contextId} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl font-semibold">
                    {r.stars}
                    <span className="text-sm text-ink-faint">/5</span>
                  </p>
                  {r.voidedAt && (
                    <span className="mt-1 inline-block rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] text-ink-muted">
                      Voided
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-muted">
                <span>Craft {r.craft}</span>
                <span>Collaboration {r.collaboration}</span>
                <span>Reliability {r.reliability}</span>
                {r.professionalism != null && (
                  <span>Professionalism {r.professionalism}</span>
                )}
                {r.communication != null && (
                  <span>Communication {r.communication}</span>
                )}
              </div>

              {r.prose && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-[var(--surface-inset)] p-3 text-sm text-ink-muted">
                  {r.prose}
                </p>
              )}

              {r.voidedAt ? (
                <div className="mt-4 border-t border-[var(--surface-border)] pt-4">
                  <p className="text-xs text-ink-faint">
                    Voided by {r.voidedBy ? nameOf(r.voidedBy) : "an admin"} on{" "}
                    {new Date(r.voidedAt).toLocaleDateString()}:{" "}
                    {r.voidReason ?? "no reason recorded"}
                  </p>
                  <form action={restorePeerReview} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      name="reason"
                      required
                      minLength={10}
                      placeholder="Why is this being reinstated?"
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                    <SubmitButton
                      className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-sm hover:border-brand-magenta hover:text-brand-magenta"
                      pendingLabel="Reinstating…"
                    >
                      Reinstate and recompute
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <details className="mt-4 border-t border-[var(--surface-border)] pt-4">
                  <summary className="cursor-pointer text-sm text-ink-muted hover:text-brand-magenta">
                    Void this review
                  </summary>
                  <form action={voidPeerReview} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      name="reason"
                      required
                      minLength={10}
                      placeholder="Why does this review not count? At least a sentence."
                      className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-ink-faint">
                      Removes it from {nameOf(r.revieweeId)}&apos;s rating,
                      recomputes their OVR now, and takes it out of the
                      bonus gate and reserve release for this
                      engagement. Reversible. Note that{" "}
                      {nameOf(r.reviewerId)} cannot then submit a
                      replacement review for this pairing, so a void
                      leaves the engagement one review lighter.
                    </p>
                    <SubmitButton
                      className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                      pendingLabel="Voiding…"
                    >
                      Void and recompute
                    </SubmitButton>
                  </form>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
