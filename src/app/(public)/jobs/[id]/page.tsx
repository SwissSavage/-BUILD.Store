/**
 * /jobs/[id] — public job posting detail with JobPosting JSON-LD.
 *
 * The public skeleton (title, industry, comp range, skill tags,
 * location, employmentType, datePosted) renders for everyone — this
 * is what Google Jobs indexes and what long-tail searches surface.
 * Full brief + application form require sign-in.
 *
 * SEO surface: emits schema.org JobPosting JSON-LD that Google Jobs
 * (google.com/search?ibp=htl;jobs) and AI answer engines
 * (Perplexity, Bing Copilot, Google AI Overviews) parse to include
 * this posting in their listings.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_JOBS } from "@/lib/mock-data/jobs";
import { INDUSTRY_LABELS } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth-stub";
import { JobPostingJsonLd } from "@/components/JobPostingJsonLd";
import { Card } from "@/components/Card";

const TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "contract-to-hire": "Contract-to-hire",
};

const EMPLOYMENT_TYPE_SCHEMA: Record<
  string,
  "FULL_TIME" | "PART_TIME" | "CONTRACTOR"
> = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  "contract-to-hire": "CONTRACTOR",
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  "https://build.afuturemodern.com";

interface Params {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const job = MOCK_JOBS.find((j) => j.id === id);
  if (!job) return { title: "Role not found — Future Modern" };
  return {
    title: `${job.title} — Future Modern`,
    description: job.description.slice(0, 155),
    alternates: { canonical: `${SITE_URL}/jobs/${job.id}` },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const job = MOCK_JOBS.find((j) => j.id === id);
  if (!job) notFound();

  const isSignedIn = !!(await getCurrentUser());
  const isRemote = /remote/i.test(job.location);

  return (
    <>
      <JobPostingJsonLd
        title={job.title}
        description={job.description}
        datePosted={job.createdAt}
        hiringOrganizationName="Future Modern"
        hiringOrganizationUrl={SITE_URL}
        locationText={job.location}
        isRemote={isRemote}
        compensationText={job.compensation}
        employmentType={EMPLOYMENT_TYPE_SCHEMA[job.employmentType] ?? "OTHER"}
        url={`${SITE_URL}/jobs/${job.id}`}
      />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/jobs" className="text-sm text-ink-muted hover:text-ink">
          ← All open roles
        </Link>

        {/* Public skeleton — indexable */}
        <div className="mt-4 flex items-center gap-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "rgba(0,112,72,0.15)",
              color: "#007048",
            }}
          >
            {TYPE_LABEL[job.employmentType] ?? job.employmentType}
          </span>
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            {INDUSTRY_LABELS[job.industry]}
          </span>
        </div>

        <h1 className="mt-2 font-display text-4xl font-semibold">
          {job.title}
        </h1>
        <p className="mt-4 text-lg text-ink-muted">{job.description}</p>

        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          <Field label="Comp" value={job.compensation} />
          <Field label="Location" value={job.location} />
          <Field label="Type" value={TYPE_LABEL[job.employmentType] ?? job.employmentType} />
          <Field label="Posted" value={new Date(job.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} />
        </div>

        {job.skillsRequired.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-wider text-ink-muted">
              Skills
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {job.skillsRequired.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-sm text-ink-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Auth-gated section — the actual apply flow */}
        <div className="mt-12">
          {isSignedIn ? (
            <Card>
              <p className="text-sm text-ink-muted">
                You&apos;re signed in. Submit your application from your
                dashboard or reply to the posting via your account.
              </p>
              {/* TODO: real apply form. For now the surface exists so
                  members know where to go. */}
              <Link
                href="/dashboard"
                className="mt-4 inline-block rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
              >
                Apply from dashboard
              </Link>
            </Card>
          ) : (
            <Card>
              <p className="text-lg font-medium">
                Sign in to see the full brief and apply.
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Full-brief details (deliverables, timeline, contact) live
                behind the member surface. If you&apos;re not a member yet,
                you can request an invite.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`/signin?next=/jobs/${job.id}`}
                  className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup/join"
                  className="rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm text-ink hover:border-brand-magenta"
                >
                  Request invite
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
