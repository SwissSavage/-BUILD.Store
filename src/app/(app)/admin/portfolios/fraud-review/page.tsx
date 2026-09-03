/**
 * Admin fraud-review queue for portfolio duplicates (task #56).
 *
 * Renders every pending FraudSignal from the weekly sweep. Admin
 * picks a disposition per signal — confirmed_fraud triggers a
 * compliance penalty follow-up prompt on the offending user (the
 * -9 OVR hit lands via /admin/compliance so admin sees the full
 * penalty context before it applies), false_positive closes the
 * signal without penalty.
 *
 * Full perceptual-hash comparison (pHash/dHash of downloaded image
 * bytes) lands when task #58 ships sharp — this queue's shape stays
 * the same, only the confidence numbers get more nuanced and image
 * previews get embedded next to each pair for side-by-side diffing.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { portfolioReader, safely } from "@/lib/readers";
import {
  allFraudSignals,
  reviewFraudSignal,
  runFraudScan,
} from "@/lib/fraud-scan";
import {
  adminName,
  publicName,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

async function reviewAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const signalId = String(formData.get("signalId") ?? "");
  const dispositionRaw = String(formData.get("disposition") ?? "");
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (
    dispositionRaw !== "confirmed_fraud" &&
    dispositionRaw !== "false_positive"
  ) {
    throw new Error("Invalid disposition");
  }
  await reviewFraudSignal({
    signalId,
    disposition: dispositionRaw,
    reviewerId: admin.id,
    note,
  });
  revalidatePath("/admin/portfolios/fraud-review");
}

async function runScanNow() {
  "use server";
  await requireAdmin();
  // runEveryDay=true bypasses the Sunday gate so admin can trigger
  // a scan on-demand from the queue page (useful after ingesting
  // a batch of new portfolio submissions).
  await runFraudScan({ runEveryDay: true });
  revalidatePath("/admin/portfolios/fraud-review");
}

type Roster = Awaited<ReturnType<typeof getAllUsers>>["users"];
type Items = Awaited<ReturnType<typeof portfolioReader.all>>;

function findItem(items: Items, id: string) {
  return items.find((p) => p.id === id) ?? null;
}
function findUser(roster: Roster, id: string) {
  return roster.find((u) => u.id === id) ?? null;
}

export default async function FraudReviewPage() {
  await requireAdmin();

  // The flagged items and their owners are loaded once for the whole
  // queue — a signal names two items and two users, so resolving them
  // per row would be four lookups per signal.
  const [signals, items, { users: roster }] = await Promise.all([
    safely(() => allFraudSignals(), []),
    safely(() => portfolioReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);

  // Pending first, then most-recent reviewed at the bottom.
  const pending = signals
    .filter((s) => !s.reviewedAt)
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  const reviewed = signals
    .filter((s) => s.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin/portfolios"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← All portfolios
      </Link>
      <div className="mt-3">
        <CardEyebrow>Fraud review</CardEyebrow>
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Portfolio duplicates
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Weekly sweep flags portfolio items that share image URLs or
        project URLs across different users. High-confidence signal
        for straight-up copy jobs; still admin-adjudicated because
        legitimate reasons for URL overlap exist (co-authored work,
        shared production credits). Perceptual-hash comparison lands
        with the image upload pipeline.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <form action={runScanNow}>
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magentaText"
          >
            Run scan now
          </button>
        </form>
        <span className="text-[11px] text-ink-faint">
          {pending.length} pending · {reviewed.length} reviewed
        </span>
      </div>

      <Card className="mt-6">
        <CardTitle>Pending signals</CardTitle>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No pending signals. Sweep runs weekly on Sundays UTC or
            on demand via the button above.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((s) => {
              const a = findItem(items, s.portfolioItemId);
              const b = s.collidingPortfolioItemId
                ? findItem(items, s.collidingPortfolioItemId)
                : null;
              const aUser = findUser(roster, s.offendingUserId);
              const bUser = s.collidingUserId
                ? findUser(roster, s.collidingUserId)
                : null;
              return (
                <li
                  key={s.id}
                  id={s.id}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-brand-magentaText">
                      {s.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-ink-faint">
                      Confidence {(s.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-[var(--surface-border)] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                        Item A · {aUser ? publicName(aUser) : s.offendingUserId}
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {a?.title ?? s.portfolioItemId}
                      </div>
                      {aUser && (
                        <div className="mt-0.5 text-[11px] text-ink-faint">
                          {adminName(aUser)}
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-[var(--surface-border)] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                        Item B · {bUser ? publicName(bUser) : s.collidingUserId ?? "—"}
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {b?.title ?? s.collidingPortfolioItemId ?? "—"}
                      </div>
                      {bUser && (
                        <div className="mt-0.5 text-[11px] text-ink-faint">
                          {adminName(bUser)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 break-all rounded bg-[var(--surface-inset)] px-3 py-2 font-mono text-[11px] text-ink-muted">
                    {s.signature}
                  </div>

                  <form action={reviewAction} className="mt-3 space-y-2">
                    <input type="hidden" name="signalId" value={s.id} />
                    <input
                      name="note"
                      placeholder="Reviewer note (optional)"
                      className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        name="disposition"
                        value="confirmed_fraud"
                        className="rounded-full bg-[#d84343] px-3 py-1 text-[11px] font-medium text-white hover:opacity-90"
                      >
                        Confirm fraud
                      </button>
                      <button
                        type="submit"
                        name="disposition"
                        value="false_positive"
                        className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-[#007048] hover:text-[#007048]"
                      >
                        False positive
                      </button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {reviewed.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Reviewed</CardTitle>
          <ul className="mt-4 space-y-2">
            {reviewed.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    {s.kind.replace(/_/g, " ")} — {s.portfolioItemId} ↔{" "}
                    {s.collidingPortfolioItemId ?? "—"}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor:
                        s.disposition === "confirmed_fraud"
                          ? "rgba(216,67,67,0.15)"
                          : "rgba(0,112,72,0.15)",
                      color:
                        s.disposition === "confirmed_fraud"
                          ? "#d84343"
                          : "#007048",
                    }}
                  >
                    {s.disposition?.replace(/_/g, " ") ?? "—"}
                  </span>
                </div>
                {s.reviewerNote && (
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {s.reviewerNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
