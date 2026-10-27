/**
 * /admin/portfolio — the pipeline from a finished deal to a public
 * case study.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS PAGE EXISTS (2026-10-27)
 *
 * There was no surface at all. /case-studies read live projects and
 * published any contract that was completed and had an RFP behind it,
 * so settlement put a public page about a client engagement on the
 * internet as a side effect of allocating the splits.
 *
 * Jamar: "There needs to be a clear pipeline that moves deals into
 * portfolio, with an opt in to make it a case study."
 *
 * Three columns, left to right, and a deal only moves right when
 * somebody decides it should:
 *
 *   Eligible     finished work with no write-up yet
 *   Portfolio    written up, internal, waiting on the client
 *   Published    the client agreed, it is live
 *
 * Nothing moves on its own. Entries are created by hand, which Jamar
 * chose over automatic entry on settlement: "Only ones you add by
 * hand."
 *
 * WHY ELIGIBLE IS NOT GATED ON rfpApprovedAt
 *
 * The old filter required it, which silently excluded every directly
 * composed engagement — Advanced Welding could be fully settled and
 * never appear. That gate assumed all contracts came through RFP
 * intake, the same assumption already found and fixed on the contract
 * operations buckets. Same rule used here: cleared by an approved RFP
 * or by a Builder accepting.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { portfolioEntries } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import {
  recordClientConsent,
  revokeClientConsent,
  savePortfolioEntry,
  setPortfolioPublished,
} from "@/lib/portfolio-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

const field =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs";
const key = "text-[10px] uppercase tracking-wider text-ink-muted";

export default async function AdminPortfolioPage() {
  await requireAdmin();

  const [{ projects: allProjects }, entries] = await Promise.all([
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
    safely(
      () =>
        db
          .select()
          .from(portfolioEntries)
          .orderBy(desc(portfolioEntries.updatedAt)),
      [],
    ),
  ]);

  const entryByProject = new Map(entries.map((e) => [e.projectId, e]));
  const projectById = new Map(allProjects.map((p) => [p.id, p]));

  // Same cleared() rule the contract operations board uses. An RFP
  // contract is cleared when an admin approves it; a directly composed
  // engagement is cleared when the Builder accepts. Different gate,
  // same meaning.
  const eligible = allProjects.filter(
    (p) =>
      p.kind === "contract" &&
      p.status === "completed" &&
      (Boolean(p.rfpApprovedAt) || p.engagementState === "accepted") &&
      !entryByProject.has(p.id),
  );

  const inPortfolio = entries.filter((e) => e.state === "portfolio");
  const published = entries.filter((e) => e.state === "published");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Portfolio</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Finished work, written up. A piece becomes a public case study
        only when a client has agreed to it, and that agreement is
        recorded here rather than remembered.
      </p>

      {/* ── Eligible ─────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Finished, not written up — {eligible.length}
        </h2>
        {eligible.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              Nothing waiting. Completed contracts appear here once
              settlement marks them done.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            {eligible.map((p) => (
              <Card key={p.id}>
                <CardEyebrow>
                  {p.rfpApprovedAt ? "Won through an RFP" : "Direct engagement"}
                </CardEyebrow>
                <CardTitle className="mt-1 text-lg">{p.title}</CardTitle>
                <form action={savePortfolioEntry} className="mt-3 space-y-2">
                  <input type="hidden" name="projectId" value={p.id} />
                  <label className="block">
                    <span className={key}>Headline</span>
                    <input
                      name="headline"
                      placeholder="What the work was, in one line"
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={key}>Summary</span>
                    <textarea
                      name="summary"
                      rows={3}
                      placeholder="What was delivered and what it changed. Not the pitch that won it."
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={key}>
                      Cited works (one per line: Label | URL | what it is)
                    </span>
                    <textarea
                      name="citedWorks"
                      rows={2}
                      placeholder="Launch film | https://... | 90 second cut used across paid social"
                      className={field}
                    />
                  </label>
                  <button
                    type="submit"
                    className="mt-1 rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magentaText"
                  >
                    Add to portfolio
                  </button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── In portfolio ─────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          In portfolio — {inPortfolio.length}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Internal. Not on the website.
        </p>
        <div className="mt-4 space-y-4">
          {inPortfolio.map((e) => {
            const project = projectById.get(e.projectId);
            const consented = Boolean(e.clientConsentAt && e.clientConsentBy);
            return (
              <Card key={e.id}>
                <CardTitle className="text-lg">{e.headline}</CardTitle>
                <p className="mt-1 text-xs text-ink-faint">
                  {project?.title ?? e.projectId}
                  {e.citedWorks.length > 0 &&
                    ` · ${e.citedWorks.length} cited work${e.citedWorks.length === 1 ? "" : "s"}`}
                </p>

                {consented ? (
                  <div className="mt-3 rounded-lg border border-[#13A06A]/40 bg-[#13A06A]/5 px-3 py-2">
                    <p className="text-xs text-ink">
                      {e.clientConsentBy} agreed on{" "}
                      {new Date(e.clientConsentAt!).toLocaleDateString()}.{" "}
                      {e.clientMayBeNamed
                        ? "The client may be named."
                        : "The client is not to be named."}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {e.clientConsentNote}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <form action={setPortfolioPublished}>
                        <input type="hidden" name="projectId" value={e.projectId} />
                        <input type="hidden" name="publish" value="1" />
                        <button
                          type="submit"
                          className="fm-btn-primary rounded-full px-4 py-1.5 text-xs font-medium"
                        >
                          Publish as a case study
                        </button>
                      </form>
                      <form action={revokeClientConsent}>
                        <input type="hidden" name="projectId" value={e.projectId} />
                        <button
                          type="submit"
                          className="text-xs text-brand-magentaText hover:underline"
                        >
                          Withdraw consent
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <form
                    action={recordClientConsent}
                    className="mt-3 space-y-2 rounded-lg border border-dashed border-[var(--surface-border)] p-3"
                  >
                    <input type="hidden" name="projectId" value={e.projectId} />
                    <p className={key}>Client consent — required to publish</p>
                    <label className="block">
                      <span className={key}>Who agreed</span>
                      <input
                        name="clientConsentBy"
                        placeholder="A person's name, not the company"
                        className={field}
                      />
                    </label>
                    <label className="block">
                      <span className={key}>How it was captured</span>
                      <textarea
                        name="clientConsentNote"
                        rows={2}
                        placeholder="Email of 14 Oct, call on the 2nd, whatever it was. This is the part that matters in a year."
                        className={field}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" name="clientMayBeNamed" />
                      They are happy to be named
                    </label>
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magentaText"
                    >
                      Record consent
                    </button>
                  </form>
                )}
              </Card>
            );
          })}
          {inPortfolio.length === 0 && (
            <Card>
              <p className="text-sm text-ink-muted">Nothing here yet.</p>
            </Card>
          )}
        </div>
      </section>

      {/* ── Published ────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Published — {published.length}
        </h2>
        <div className="mt-4 space-y-3">
          {published.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{e.headline}</CardTitle>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Live since{" "}
                    {e.publishedAt
                      ? new Date(e.publishedAt).toLocaleDateString()
                      : "—"}
                    {" · "}
                    consent from {e.clientConsentBy}
                    {!e.clientMayBeNamed && " · client not named"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/case-studies/${e.projectId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-magentaText hover:underline"
                  >
                    View ↗
                  </Link>
                  <form action={setPortfolioPublished}>
                    <input type="hidden" name="projectId" value={e.projectId} />
                    <input type="hidden" name="publish" value="0" />
                    <button
                      type="submit"
                      className="text-xs text-ink-muted hover:text-ink"
                    >
                      Take down
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
          {published.length === 0 && (
            <Card>
              <p className="text-sm text-ink-muted">
                Nothing published. A piece reaches the public site only
                from here.
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
