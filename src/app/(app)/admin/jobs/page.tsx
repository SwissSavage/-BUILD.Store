/**
 * /admin/jobs — post and manage job listings.
 *
 * The board at /jobs and the application queue at
 * /admin/jobs/applications both shipped in July. This page is the
 * missing third piece: until it existed there was no way to create a
 * posting, so the only jobs that could appear were seeded ones.
 *
 * Closing a job is a status change, never a delete — applications
 * reference the row, and someone who applied should still be able to
 * see what they applied to.
 */
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth-stub";
import { jobReader, jobApplicationReader, safely } from "@/lib/readers";
import { setJobStatus, upsertJob } from "@/lib/job-actions";
import { INDUSTRY_LABELS } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink";
const labelClass = "block text-xs text-ink-muted";
const primaryButton =
  "rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-white hover:opacity-90";
const ghostButton =
  "rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText";

const STATUS_COLOR: Record<string, string> = {
  open: "#007048",
  filled: "#5070F0",
  closed: "#A3A3A3",
};

export default async function AdminJobsPage() {
  await requireAdmin();

  const [jobs, applications] = await Promise.all([
    safely(() => jobReader.all(), []),
    safely(() => jobApplicationReader.all(), []),
  ]);

  const applicantCount = new Map<string, number>();
  for (const a of applications) {
    applicantCount.set(a.jobId, (applicantCount.get(a.jobId) ?? 0) + 1);
  }

  const open = jobs.filter((j) => j.status === "open");
  const closed = jobs.filter((j) => j.status !== "open");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold">Jobs</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Postings on the public board at{" "}
            <Link href="/jobs" className="text-brand-magentaText hover:underline">
              /jobs
            </Link>
            . Applications land in{" "}
            <Link
              href="/admin/jobs/applications"
              className="text-brand-magentaText hover:underline"
            >
              the triage queue
            </Link>
            .
          </p>
        </div>
        <span className="text-xs text-ink-faint">
          {open.length} open · {jobs.length} total
        </span>
      </div>

      {/* ── New posting ──────────────────────────────────────── */}
      <Card className="mt-8 border-brand-magenta/30">
        <CardEyebrow>Post a job</CardEyebrow>
        <form action={upsertJob} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Title
              <input
                name="title"
                required
                placeholder="Senior Frontend Engineer"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Posted by — shows publicly
              <input
                name="postedByLabel"
                defaultValue="Future Modern"
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            Description
            <textarea
              name="description"
              rows={6}
              required
              placeholder="What the work is, who it's for, what success looks like."
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClass}>
              Pillar
              <select name="industry" required className={inputClass}>
                <option value="stem">STEM</option>
                <option value="creative-media">Creative + media</option>
                <option value="professional-services">
                  Professional services
                </option>
              </select>
            </label>
            <label className={labelClass}>
              Employment type
              <select name="employmentType" required className={inputClass}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract-to-hire">Contract-to-hire</option>
              </select>
            </label>
            <label className={labelClass}>
              Status
              <select name="status" defaultValue="open" className={inputClass}>
                <option value="open">Open</option>
                <option value="filled">Filled</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Compensation
              <input
                name="compensation"
                required
                placeholder="$90k–$120k · or $75/hr"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Location
              <input
                name="location"
                required
                placeholder="Remote · or New York, NY"
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            Skills — one per line, or comma separated
            <textarea name="skillsRequired" rows={3} className={inputClass} />
          </label>

          <SubmitButton pendingLabel="Saving…" className={primaryButton}>
            Post job
          </SubmitButton>
        </form>
      </Card>

      {/* ── Open postings ────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
            Nothing posted. The public board is empty until something
            lands here.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {open.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                applicants={applicantCount.get(job.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">
            Filled + closed ({closed.length})
          </h2>
          <div className="mt-4 space-y-3">
            {closed.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                applicants={applicantCount.get(job.id) ?? 0}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function JobRow({
  job,
  applicants,
}: {
  job: Awaited<ReturnType<typeof jobReader.all>>[number];
  applicants: number;
}) {
  return (
    <Card>
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="min-w-0">
              <CardEyebrow>
                {INDUSTRY_LABELS[job.industry]} · {job.employmentType}
              </CardEyebrow>
              <CardTitle className="mt-1 text-lg">{job.title}</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                {job.compensation} · {job.location} · posted by{" "}
                {job.postedByLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-[11px] text-ink-faint">
                {applicants} applicant{applicants === 1 ? "" : "s"}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                  color: STATUS_COLOR[job.status],
                  border: `1px solid ${STATUS_COLOR[job.status]}`,
                }}
              >
                {job.status}
              </span>
            </div>
          </div>
        </summary>

        <form action={upsertJob} className="mt-4 space-y-3 border-t border-[var(--surface-border)] pt-4">
          <input type="hidden" name="id" value={job.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Title
              <input
                name="title"
                defaultValue={job.title}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Posted by
              <input
                name="postedByLabel"
                defaultValue={job.postedByLabel}
                className={inputClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Description
            <textarea
              name="description"
              defaultValue={job.description}
              rows={5}
              required
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClass}>
              Pillar
              <select
                name="industry"
                defaultValue={job.industry}
                className={inputClass}
              >
                <option value="stem">STEM</option>
                <option value="creative-media">Creative + media</option>
                <option value="professional-services">
                  Professional services
                </option>
              </select>
            </label>
            <label className={labelClass}>
              Employment type
              <select
                name="employmentType"
                defaultValue={job.employmentType}
                className={inputClass}
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract-to-hire">Contract-to-hire</option>
              </select>
            </label>
            <label className={labelClass}>
              Status
              <select
                name="status"
                defaultValue={job.status}
                className={inputClass}
              >
                <option value="open">Open</option>
                <option value="filled">Filled</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Compensation
              <input
                name="compensation"
                defaultValue={job.compensation}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Location
              <input
                name="location"
                defaultValue={job.location}
                required
                className={inputClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Skills
            <textarea
              name="skillsRequired"
              defaultValue={(job.skillsRequired ?? []).join("\n")}
              rows={3}
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton pendingLabel="Saving…" className={primaryButton}>
              Save
            </SubmitButton>
            <Link href={`/jobs/${job.id}`} className={ghostButton}>
              View public listing
            </Link>
          </div>
        </form>

        {job.status === "open" && (
          <div className="mt-3 flex gap-2">
            <form action={setJobStatus}>
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="filled" />
              <SubmitButton pendingLabel="Saving…" className={ghostButton}>
                Mark filled
              </SubmitButton>
            </form>
            <form action={setJobStatus}>
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="closed" />
              <SubmitButton pendingLabel="Saving…" className={ghostButton}>
                Close posting
              </SubmitButton>
            </form>
          </div>
        )}
      </details>
    </Card>
  );
}
