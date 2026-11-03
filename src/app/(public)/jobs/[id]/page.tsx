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
import { AdminObjectControls } from "@/components/AdminObjectControls";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, Send, Tags } from "lucide-react";
import { jobReader } from "@/lib/readers";
import { INDUSTRY_LABELS } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth-stub";
import { JobPostingJsonLd } from "@/components/JobPostingJsonLd";
import { Brief, briefHeadings, briefPlainText } from "@/components/Brief";
import { BriefTableOfContents } from "@/components/BriefTableOfContents";
import { Card, CardTitle } from "@/components/Card";
import { ApplyToJobForm } from "@/components/ApplyToJobForm";
import { OpportunityHeader } from "@/components/OpportunityHeader";
import { ExpandableSkillTags } from "@/components/ExpandableSkillTags";

export const dynamic = "force-dynamic";

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
  const job = await jobReader.byId(id);
  if (!job) return { title: "Role not found — Future Modern" };
  return {
    title: `${job.title} — Future Modern`,
    description: briefPlainText(job.description).slice(0, 155),
    alternates: { canonical: `${SITE_URL}/jobs/${job.id}` },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const job = await jobReader.byId(id);
  if (!job) notFound();

  const isSignedIn = !!(await getCurrentUser());
  const isRemote = /remote/i.test(job.location);

  return (
    <>
      <JobPostingJsonLd
        title={job.title}
        description={briefPlainText(job.description)}
        datePosted={job.createdAt}
        hiringOrganizationName="Future Modern"
        hiringOrganizationUrl={SITE_URL}
        locationText={job.location}
        isRemote={isRemote}
        compensationText={job.compensation}
        employmentType={EMPLOYMENT_TYPE_SCHEMA[job.employmentType] ?? "OTHER"}
        url={`${SITE_URL}/jobs/${job.id}`}
      />

      <div className="mx-auto max-w-app px-6 py-12">
        <OpportunityHeader
          backHref="/jobs"
          backLabel="All open roles"
          kind={TYPE_LABEL[job.employmentType] ?? job.employmentType}
          industry={INDUSTRY_LABELS[job.industry]}
          title={job.title}
          postedAt={job.createdAt}
        />
        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_20rem]">
          <BriefTableOfContents
            targetId="job-brief"
            headings={briefHeadings(job.description)}
          />
          <section id="job-brief" className="min-w-0">
            <Card className="min-w-0 p-5 sm:p-8">
              <Brief text={job.description} title={job.title} />
              <AdminObjectControls editHref="/admin/jobs" label="role" />
            </Card>
          </section>
          <aside className="h-fit min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="flex min-h-56 flex-col">
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Send aria-hidden="true" size={18} strokeWidth={1.75} />
                  Apply to this role
                </span>
              </CardTitle>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Send an application with your pitch and relevant work. No
                account needed. Future Modern routes suitable candidates to
                the client lead.
              </p>
              {/* One destination now. "Sign in to apply" sent a reader
                  away from a form they are allowed to use. */}
              <a
                href="#job-application"
                className="fm-btn-primary mt-auto rounded-full px-4 py-2 text-center text-sm"
              >
                Apply to this role
              </a>
            </Card>

            <Card>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <BriefcaseBusiness aria-hidden="true" size={18} strokeWidth={1.75} />
                  Role details
                </span>
              </CardTitle>
              <div className="mt-4 space-y-4">
                <Field label="Compensation" value={job.compensation} />
                <Field label="Location" value={job.location} />
                <Field label="Type" value={TYPE_LABEL[job.employmentType] ?? job.employmentType} />
                <Field label="Posted" value={new Date(job.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} />
              </div>
            </Card>

            {job.skillsRequired.length > 0 && (
              <Card>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Tags aria-hidden="true" size={18} strokeWidth={1.75} />
                    Skills
                  </span>
                </CardTitle>
                <ExpandableSkillTags skills={job.skillsRequired} />
              </Card>
            )}
          </aside>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_20rem]">
          <div className="hidden lg:block" aria-hidden="true" />
          <section id="job-application" className="min-w-0 scroll-mt-24">
            {/* 2026-11-03: this rendered the form only when signed in,
                and otherwise a card reading "Sign in to see the full
                brief and apply." The full brief renders
                unconditionally above, so that sentence was false, and
                the only thing actually behind the gate was the form.
                A visitor can now apply, and that application is also
                their membership application. */}
            <ApplyToJobForm
              jobId={job.id}
              jobTitle={job.title}
              isSignedIn={isSignedIn}
            />
            {!isSignedIn && (
              <p className="mt-3 text-sm text-ink-muted">
                Already a member?{" "}
                <Link
                  href={`/signin?next=/jobs/${job.id}`}
                  className="text-brand-magentaText hover:underline"
                >
                  Sign in
                </Link>{" "}
                so this lands against your profile and standing.
              </p>
            )}
          </section>
          <div className="hidden lg:block" aria-hidden="true" />
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
