/**
 * /admin/reserve — Contract Reserve Pool state + graduated bonus
 * release + rebate issuance across all contracts.
 *
 * Per-project card shows current balance, ledger history, and — if
 * bonus is pending — the graduated release composer where admin
 * captures per-contributor ratings (admin/peer/client). Rebate
 * issuance sits in a separate collapsed section per project.
 *
 * Gated to admin.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_PEER_REVIEWS } from "@/lib/mock-data/peer-reviews";
import { MOCK_CUSTOMER_FEEDBACK } from "@/lib/mock-data/customer-feedback";
import {
  MOCK_RESERVE_POOL_LEDGER,
  reservePoolBalance,
  reservePoolLedgerForProject,
  compositesForProject,
} from "@/lib/mock-data/reserve-pool";
import {
  executeGraduatedBonusRelease,
  issueClientRebate,
} from "@/lib/reserve-actions";
import {
  aggregatePeerCompositeForContributor,
  extractClientRatingForProject,
} from "@/lib/triangulation";
import {
  RESERVE_CREDIT_REASON_LABELS,
  RESERVE_DEBIT_REASON_LABELS,
  publicName,
  type Project,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Read-only rating display with source attribution. Admin cannot
 * edit — they see the value and where it came from. Renders a
 * "missing" state when the source hasn't submitted yet.
 */
function RatingChip({
  label,
  value,
  source,
  compact,
}: {
  label: string;
  value: number | null;
  source: string;
  compact?: boolean;
}) {
  const missing = value === null;
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        missing
          ? "border-brand-magenta/30 bg-brand-magenta/5"
          : "border-[var(--surface-border)] bg-[var(--surface-inset)]"
      } ${compact ? "text-[11px]" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <span
          className={`font-mono text-sm ${
            missing ? "text-brand-magenta" : "text-ink"
          }`}
        >
          {missing ? "—" : `${value.toFixed(1)} / 5`}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-ink-faint">source: {source}</p>
    </div>
  );
}

function projectsWithActivity(): Project[] {
  const projectIds = new Set(MOCK_RESERVE_POOL_LEDGER.map((e) => e.projectId));
  return MOCK_PROJECTS.filter(
    (p) => projectIds.has(p.id) || p.talentBonusAmount !== null,
  );
}

export default async function AdminReservePage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/reserve");

  const projects = projectsWithActivity();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Contract Reserve Pools</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Reserve ledger + graduated release
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Per-contract reserve pools hold the top − bottom bonus
            delta until the triangulated composite fires. Graduated
            release replaces the binary bonus_decision path — each
            contributor&apos;s payout is composite/5 × their share.
            Unreleased bonus routes to same-contract contributors at
            composite ≥ 4.5, then residual to the Engagement Recovery
            Pool.
          </p>
        </div>
        <Link
          href="/admin/audit-log?resource=reserve_pool"
          className="text-xs text-brand-magenta hover:underline"
        >
          Reserve audit trail →
        </Link>
      </div>

      <section className="mt-10 space-y-6">
        {projects.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              No contracts with reserve activity yet.
            </p>
          </Card>
        ) : (
          projects.map((project) => (
            <ReserveCard key={project.id} project={project} />
          ))
        )}
      </section>
    </div>
  );
}

function ReserveCard({ project }: { project: Project }) {
  const balance = reservePoolBalance(project.id);
  const ledger = reservePoolLedgerForProject(project.id);
  const composites = compositesForProject(project.id);
  const bonusPending =
    project.bonusDecision === null || project.bonusDecision === "pending";
  const contribs = project.assignedMemberIds
    .map((id) => MOCK_USERS.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardTitle className="text-lg">{project.title}</CardTitle>
          <p className="mt-1 text-[11px] text-ink-faint">
            {project.id} · balance{" "}
            <strong className="text-ink">{USD_FMT.format(balance)}</strong>
            {project.talentBonusAmount && (
              <>
                {" · bonus pool "}
                {USD_FMT.format(Number(project.talentBonusAmount))}
              </>
            )}
            {" · status "}
            <span className="uppercase tracking-wider">
              {project.bonusDecision ?? "pending"}
            </span>
          </p>
        </div>
      </div>

      {/* Ledger */}
      {ledger.length > 0 && (
        <details className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-ink-muted">
            Ledger ({ledger.length} {ledger.length === 1 ? "entry" : "entries"})
          </summary>
          <ul className="mt-2 divide-y divide-[var(--surface-border)]">
            {ledger.map((entry) => {
              const label =
                entry.direction === "credit"
                  ? entry.creditReason
                    ? RESERVE_CREDIT_REASON_LABELS[entry.creditReason]
                    : "Credit"
                  : entry.debitReason
                    ? RESERVE_DEBIT_REASON_LABELS[entry.debitReason]
                    : "Debit";
              return (
                <li key={entry.id} className="py-2 text-[11px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-muted">{label}</span>
                    <span
                      className={
                        entry.direction === "credit"
                          ? "text-[#007048]"
                          : "text-brand-magenta"
                      }
                    >
                      {USD_FMT.format(Number(entry.amount))}
                    </span>
                  </div>
                  {entry.rationale && (
                    <p className="mt-0.5 italic text-ink-faint">
                      {entry.rationale}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Composites snapshotted */}
      {composites.length > 0 && (
        <details className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-ink-muted">
            Composites ({composites.length})
          </summary>
          <ul className="mt-2 divide-y divide-[var(--surface-border)]">
            {composites.map((c) => {
              const user = MOCK_USERS.find((u) => u.id === c.contributorUserId);
              return (
                <li key={c.id} className="py-2 text-[11px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>
                      {user ? publicName(user) : c.contributorUserId} —
                      admin {c.adminRating ?? "—"} · peer{" "}
                      {c.peerRating ?? "—"} · client{" "}
                      {c.clientRating ?? "—"}
                    </span>
                    <span className="text-ink-faint">
                      composite {c.weightedComposite} → release{" "}
                      {(c.bonusReleaseFraction * 100).toFixed(1)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Graduated bonus release — ratings from source tables, read-only */}
      {bonusPending && project.talentBonusAmount && contribs.length > 0 && (() => {
        const adminRating = project.pmEngagementRating ?? null;
        const clientRating = extractClientRatingForProject({
          feedback: MOCK_CUSTOMER_FEEDBACK,
          projectId: project.id,
        });
        const missingChase: string[] = [];
        if (adminRating === null) {
          missingChase.push(
            "PM engagement rating — capture on the settle page",
          );
        }
        if (clientRating === null) {
          missingChase.push(
            "Client rating — send them the /contracts/[id]/feedback magic-link",
          );
        }
        const perContribData = contribs.map((u) => {
          const peer = aggregatePeerCompositeForContributor({
            reviews: MOCK_PEER_REVIEWS,
            projectId: project.id,
            contributorUserId: u.id,
          });
          if (peer === null) {
            missingChase.push(
              `Peer reviews for ${publicName(u)} — ask fellow contributors to submit on /projects/${project.id}`,
            );
          }
          return { user: u, peer };
        });

        return (
          <form
            action={executeGraduatedBonusRelease}
            className="mt-4 rounded-lg border border-[var(--surface-border)] p-4"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <p className="text-xs uppercase tracking-wider text-ink-muted">
              Graduated bonus release
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">
              Ratings pulled from source tables. Admin cannot override
              any rating — only the original rater can change their
              submission at the source. Missing ratings redistribute
              weights pro-rata (but chase the raters when you can).
            </p>

            {/* Who to chase */}
            {missingChase.length > 0 && (
              <div className="mt-3 rounded-md border border-brand-magenta/30 bg-brand-magenta/5 p-3">
                <p className="text-[11px] uppercase tracking-wider text-brand-magenta">
                  Chase list — missing ratings
                </p>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-ink-muted">
                  {missingChase.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source ratings (read-only) */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <RatingChip
                label="Admin (PM)"
                value={adminRating}
                source="project.pmEngagementRating"
              />
              <RatingChip
                label="Client"
                value={clientRating}
                source="customer_feedback (most recent)"
              />
            </div>

            <ul className="mt-4 space-y-3">
              {perContribData.map(({ user: u, peer }) => (
                <li
                  key={u.id}
                  className="rounded-md bg-[var(--surface-inset)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar user={u} size="sm" />
                      <span className="text-sm font-medium">
                        {publicName(u)}
                      </span>
                    </div>
                    <RatingChip
                      label="Peer"
                      value={peer}
                      source="peer_reviews (avg)"
                      compact
                    />
                  </div>
                  <input type="hidden" name="contributorId" value={u.id} />
                  <div className="mt-2">
                    <label className="text-[11px]">
                      Internal invoice $ (peer-coverage weighting only —
                      not a rating)
                      <input
                        name={`internalInvoiceAmount_${u.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 5000"
                        className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-brand-white hover:bg-brand-magenta/90"
              >
                Execute graduated release
              </button>
            </div>
          </form>
        );
      })()}

      {/* Rebate composer */}
      {balance > 0 && (
        <details className="mt-4 rounded-lg border border-[var(--surface-border)] px-3 py-2">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-ink-muted">
            Issue client rebate
          </summary>
          <form action={issueClientRebate} className="mt-3 space-y-2">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px]">
                Amount (max {USD_FMT.format(balance)})
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={balance}
                  required
                  className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                />
              </label>
              <label className="text-[11px]">
                Sized against contributor (optional)
                <select
                  name="contributorUserId"
                  className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                >
                  <option value="">(no reference)</option>
                  {contribs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {publicName(u)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-[11px]">
              Rationale (required — audit trail)
              <textarea
                name="rationale"
                required
                rows={2}
                placeholder="Written justification for the rebate."
                className="mt-1 w-full rounded border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-brand-white hover:bg-brand-magenta/90"
              >
                Issue rebate
              </button>
            </div>
          </form>
        </details>
      )}
    </Card>
  );
}
