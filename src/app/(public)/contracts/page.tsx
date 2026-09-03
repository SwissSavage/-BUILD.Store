/**
 * /contracts — public contract opportunities board.
 *
 * SEO surface: every RFP-approved short-term contract available for
 * bid is indexable here. Google Jobs vertical picks up per-posting
 * JobPosting JSON-LD at /contracts/[id] with employmentType=CONTRACTOR.
 * AI answer engines quote listings when someone asks "who's hiring
 * for X contract work."
 *
 * All FM contracts are depersonalized — the hiring organization
 * always surfaces as "Future Modern" regardless of the underlying
 * portfolio client. Removes client-poaching risk that would normally
 * block public contract listings.
 *
 * Public visibility: skeleton (title, industry, comp/budget range,
 * skill tags, kind) renders for everyone. Full brief + bid form live
 * at /contracts/[id] and require sign-in.
 */
import Link from "next/link";
import { PostListingButton } from "@/components/PostListingButton";
import { getAllProjects } from "@/lib/readers/projects";
import { INDUSTRY_LABELS } from "@/lib/types";
import { briefSummary } from "@/components/Brief";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const metadata = {
  title: "Open contracts — Future Modern",
  description:
    "Short-term contract opportunities open to Future Modern members and vetted talent. All engagements route through Future Modern until delivery — one team, one point of contact.",
};

/**
 * A newly approved RFP has to appear here immediately — this is the
 * board talent refreshes. Static rendering would freeze the list at
 * build time and make every new contract invisible until the next
 * deploy.
 */
export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  // Public listing: only admin-vetted, currently-open RFPs. Contracts
  // that are already in progress or completed aren't discoverable here
  // (they'll surface as past-project case studies at #32 instead).
  //
  // Reader swap 2026-08-28: was MOCK_PROJECTS, so real contracts
  // created through /contracts/new never showed up on the board.
  const { projects } = await getAllProjects();
  const open = projects
    .filter(
      (p) =>
        p.kind === "contract" &&
        p.isRfp &&
        p.status === "open" &&
        p.rfpApprovedAt !== null,
    )
    .sort((a, b) =>
      (b.rfpApprovedAt ?? "").localeCompare(a.rfpApprovedAt ?? ""),
    );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div>
        <h1 className="font-display text-4xl font-semibold">
          Open contracts
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Short-term deliverables open for bidding. Every contract is
          depersonalized — you engage with Future Modern until the work
          ships, then we attribute the client publicly if they consent.
          Sign in to see full briefs and bid.
        </p>
        <PostListingButton
          href="/admin/contracts/new"
          label="Post a contract"
        />
      </div>

      {open.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
          No open contracts right now. New RFPs clear the intake queue
          regularly.
          <PostListingButton
            href="/admin/contracts/new"
            label="Post a contract"
            hint="Goes live immediately — admins skip the vetting queue."
            standalone
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {open.map((p) => (
            <Link
              key={p.id}
              href={`/contracts/${p.id}`}
              className="block transition-opacity hover:opacity-95"
            >
              <Card>
                <div className="flex items-center justify-between">
                  <CardEyebrow>{INDUSTRY_LABELS[p.industry]}</CardEyebrow>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "rgba(80,112,240,0.15)",
                      color: "var(--fm-blue-text)",
                    }}
                  >
                    Contract
                  </span>
                </div>
                <CardTitle className="mt-2">{p.title}</CardTitle>
                <p className="mt-3 text-sm text-ink-muted">
                  {briefSummary(p.description, { skipTitle: p.title })}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.skillsRequired.slice(0, 5).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="mt-5 space-y-1.5 text-sm">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-ink-faint">
                      Budget
                    </span>
                    <div className="font-medium">
                      ${Number(p.budget).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
