/**
 * /admin/receipts — Cooperative Receipt authoring + management.
 *
 * The admin-facing companion to the tokenized /receipts/[token]
 * public surface. Every settled project is eligible for a receipt;
 * this page lists what's generated and provides a form to generate
 * new ones for eligible projects.
 *
 * Gated to admin. Each generation writes a `receipt.generated` audit
 * entry; removals write `receipt.removed`.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_PROJECT_MILESTONES } from "@/lib/mock-data/project-milestones";
import { MOCK_COOPERATIVE_RECEIPTS } from "@/lib/mock-data/cooperative-receipts";
import {
  generateCooperativeReceipt,
  removeCooperativeReceipt,
} from "@/lib/receipt-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

/**
 * Eligible projects for receipt generation: contracts that have
 * cleared settlement (revenue collected). We surface every settled
 * project here; ones that already have a receipt are marked in-line
 * so the admin can jump to the existing receipt instead of trying to
 * regenerate.
 */
function eligibleProjects() {
  return MOCK_PROJECTS.filter(
    (p) => p.kind === "contract" && p.collectedAt !== null,
  );
}

/** Auto-compute milestone hit rate from the milestone store — used
 *  as a form-side default so the admin doesn't have to look it up. */
function computeMilestones(projectId: string): {
  hit: number;
  total: number;
} {
  const rows = MOCK_PROJECT_MILESTONES.filter((m) => m.projectId === projectId);
  return {
    hit: rows.filter((m) => m.status === "completed").length,
    total: rows.length,
  };
}

export default async function AdminReceiptsPage() {
  const viewer = await getCurrentUser();
  if (!viewer || !viewer.isAdmin) redirect("/signin?next=/admin/receipts");

  const receipts = [...MOCK_COOPERATIVE_RECEIPTS].sort((a, b) =>
    b.generatedAt.localeCompare(a.generatedAt),
  );
  const projects = eligibleProjects();
  const projectsWithoutReceipt = projects.filter(
    (p) => !MOCK_COOPERATIVE_RECEIPTS.some((r) => r.projectId === p.id),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Cooperative Receipts</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Post-project client receipts
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            The gated proof-of-improvement layer. Generate a receipt
            when a project settles; the client accesses it via
            tokenized magic-link. No account required on their side —
            the token is the credential.
          </p>
        </div>
      </div>

      {/* Generate a new receipt */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Generate a new receipt
        </h2>
        {projectsWithoutReceipt.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              Every eligible settled project already has a receipt on
              file. Remove an existing receipt below to regenerate.
            </p>
          </Card>
        ) : (
          <form
            action={generateCooperativeReceipt}
            className="mt-6 space-y-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6"
          >
            <div>
              <label
                htmlFor="projectId"
                className="block text-xs uppercase tracking-wider text-ink-muted"
              >
                Project
              </label>
              <select
                id="projectId"
                name="projectId"
                required
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pick a settled project…
                </option>
                {projectsWithoutReceipt.map((p) => {
                  const ms = computeMilestones(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.title} · {ms.hit}/{ms.total} milestones
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-[11px] text-ink-faint">
                Only settled contracts appear here. RFPs and unpaid
                projects are excluded.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cashFlowPct"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Cash flow to cooperators (%)
                </label>
                <input
                  id="cashFlowPct"
                  name="cashFlowPct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  defaultValue={85}
                  required
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Baseline is 85. Override if this engagement diverged.
                </p>
              </div>

              <div>
                <label
                  htmlFor="timeToMatchHours"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Time to matched crew (hrs)
                </label>
                <input
                  id="timeToMatchHours"
                  name="timeToMatchHours"
                  type="number"
                  min={0}
                  defaultValue={48}
                  required
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  RFP submission → first curated crew presented.
                </p>
              </div>

              <div>
                <label
                  htmlFor="milestonesHit"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Milestones hit
                </label>
                <input
                  id="milestonesHit"
                  name="milestonesHit"
                  type="number"
                  min={0}
                  placeholder="Auto"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="milestonesTotal"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Milestones total
                </label>
                <input
                  id="milestonesTotal"
                  name="milestonesTotal"
                  type="number"
                  min={0}
                  placeholder="Auto"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Leave both blank to auto-fill from milestone store.
                </p>
              </div>

              <div>
                <label
                  htmlFor="crewPeerReviewOvrDelta"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Crew peer-review OVR delta
                </label>
                <input
                  id="crewPeerReviewOvrDelta"
                  name="crewPeerReviewOvrDelta"
                  type="number"
                  step={0.1}
                  defaultValue={0}
                  required
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Signed. Positive = crew earned standing during the
                  engagement.
                </p>
              </div>

              <div>
                <label
                  htmlFor="subsequentProjectIds"
                  className="block text-xs uppercase tracking-wider text-ink-muted"
                >
                  Subsequent project IDs
                </label>
                <input
                  id="subsequentProjectIds"
                  name="subsequentProjectIds"
                  type="text"
                  placeholder="p_002, p_005"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Space- or comma-delimited. What this crew shipped
                  after.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-brand-white shadow-lg shadow-brand-magenta/20 transition-colors hover:bg-brand-magenta/90"
              >
                Generate receipt
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Existing receipts */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Existing receipts
        </h2>
        {receipts.length === 0 ? (
          <Card className="mt-6">
            <p className="text-sm text-ink-muted">
              No receipts generated yet.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-4">
            {receipts.map((receipt) => {
              const project = MOCK_PROJECTS.find(
                (p) => p.id === receipt.projectId,
              );
              const hitRatePct =
                receipt.milestonesTotal > 0
                  ? Math.round(
                      (receipt.milestonesHit / receipt.milestonesTotal) * 100,
                    )
                  : 0;

              return (
                <li key={receipt.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardEyebrow>
                        {project?.title ?? receipt.projectId}
                      </CardEyebrow>
                      <span className="text-[11px] text-ink-faint">
                        Generated{" "}
                        {new Date(receipt.generatedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                    <CardTitle className="mt-1 text-lg">
                      Receipt · {receipt.cashFlowPct}% to cooperators ·{" "}
                      {receipt.milestonesHit}/{receipt.milestonesTotal}{" "}
                      milestones ({hitRatePct}%)
                    </CardTitle>
                    <p className="mt-3 text-xs text-ink-muted">
                      Client magic-link (production dispatches this to
                      the client contact):
                    </p>
                    <code className="mt-1 block break-all rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-[11px] text-ink">
                      /receipts/{receipt.clientToken}
                    </code>

                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={`/receipts/${receipt.clientToken}`}
                        className="text-xs text-brand-magenta hover:underline"
                      >
                        Preview client view →
                      </Link>
                      <form action={removeCooperativeReceipt}>
                        <input
                          type="hidden"
                          name="id"
                          value={receipt.id}
                        />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint hover:text-brand-magenta"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
