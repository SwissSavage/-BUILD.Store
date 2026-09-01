/**
 * /jobs — public jobs board.
 *
 * SEO surface: every open FT/PT/contract-to-hire role at Future Modern
 * or its cooperative partners is indexable here. Google Jobs vertical
 * and AI answer engines discover openings via this URL + the
 * per-posting JobPosting JSON-LD emitted at /jobs/[id].
 *
 * All FM postings are depersonalized — the hiring organization surface
 * as "Future Modern" regardless of the underlying partner/client, until
 * work ships and the client is happy to be attributed publicly. That
 * removes the client-poaching risk that would normally block public
 * job listings.
 *
 * Public visibility: the skeleton (title, industry, comp range, skill
 * tags, location, employmentType, datePosted) renders for everyone —
 * that's what Google indexes and what long-tail searches surface.
 * Full brief + application form live at /jobs/[id] and require sign-in.
 */
import Link from "next/link";
import { PostListingButton } from "@/components/PostListingButton";
import { getOpenJobs, safely } from "@/lib/readers";
import { INDUSTRY_LABELS } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Open roles — Future Modern",
  description:
    "Full-time, part-time, and contract-to-hire roles at Future Modern and cooperative partners. Members and vetted talent get first look before postings hit generic job boards.",
};

const TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "contract-to-hire": "Contract-to-hire",
};

export default async function JobsPage() {
  // MOCK data for now; a follow-up drizzle-swap will source from the
  // `jobs` table. Listing shape is identical either way — the swap is
  // isolated to this query.
  // Status filter in the query — a closed role should never be one
  // client-side filter away from a public page.
  const open = (await safely(() => getOpenJobs(), [])).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div>
        <h1 className="font-display text-4xl font-semibold">Open roles</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Full-time and part-time work with Future Modern and cooperative
          partners. Every posting is depersonalized — you&apos;re
          working with Future Modern until the engagement ships. Sign in
          to see full briefs and apply.
        </p>
        <PostListingButton href="/admin/jobs" label="Post a job" />
      </div>

      {open.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
          No roles open right now. Postings refresh as partners route
          work to Future Modern.
          <PostListingButton
            href="/admin/jobs"
            label="Post a job"
            hint="Appears on this board as soon as you save it."
            standalone
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {open.map((j) => (
            <Link
              key={j.id}
              href={`/jobs/${j.id}`}
              className="block transition-opacity hover:opacity-95"
            >
              <Card>
                <div className="flex items-center justify-between">
                  <CardEyebrow>{INDUSTRY_LABELS[j.industry]}</CardEyebrow>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "rgba(0,112,72,0.15)",
                      color: "#007048",
                    }}
                  >
                    {TYPE_LABEL[j.employmentType] ?? j.employmentType}
                  </span>
                </div>
                <CardTitle className="mt-2">{j.title}</CardTitle>
                <p className="mt-3 line-clamp-3 text-sm text-ink-muted">
                  {j.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {j.skillsRequired.slice(0, 5).map((s) => (
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
                      Comp
                    </span>
                    <div className="font-medium">{j.compensation}</div>
                  </div>
                  <div className="text-xs text-ink-muted">{j.location}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
