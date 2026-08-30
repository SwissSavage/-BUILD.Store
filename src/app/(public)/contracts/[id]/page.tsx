/**
 * /contracts/[id] — public contract detail with JobPosting JSON-LD
 * (employmentType=CONTRACTOR).
 *
 * Skeleton (title, industry, budget, skill tags, kind) is indexable.
 * Full brief + bid form require sign-in — that's where the actual
 * deliverables spec, timeline, and client details live.
 *
 * Hand-picked recruitment path: task #37 lets an admin fire the
 * invite ceremony with this contract's ID attached, so the invitee
 * lands post-signup on the /contracts/[id] full-brief view.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/readers/projects";
import { INDUSTRY_LABELS } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth-stub";
import { JobPostingJsonLd } from "@/components/JobPostingJsonLd";
import { Card } from "@/components/Card";
import { BidOnContractForm } from "@/components/BidOnContractForm";
import { computeRateBounds } from "@/lib/rate-bounds";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  "https://build.afuturemodern.com";

interface Params {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const p = await getProjectById(id);
  if (!p || p.kind !== "contract") {
    return { title: "Contract not found — Future Modern" };
  }
  return {
    title: `${p.title} — Contract at Future Modern`,
    description: p.description.slice(0, 155),
    alternates: { canonical: `${SITE_URL}/contracts/${p.id}` },
  };
}

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (
    !project ||
    project.kind !== "contract" ||
    !project.isRfp ||
    project.status !== "open" ||
    !project.rfpApprovedAt
  ) {
    notFound();
  }

  const currentUser = await getCurrentUser();
  const isSignedIn = !!currentUser;

  // Bid range for the signed-in bidder (task #48). Flat platform
  // range for everyone — talent sets their own rates; admin handles
  // outliers during triage. Null for signed-out viewers so they see
  // the sign-in card instead of the bid form.
  const rateBounds = currentUser
    ? computeRateBounds(currentUser)
    : null;

  // Contracts don't have a compensation string; budget is a numeric.
  // Compose a display range that Google can parse into MonetaryAmount.
  const budgetNum = Number(project.budget);
  const compText = Number.isFinite(budgetNum)
    ? `$${budgetNum.toLocaleString()}`
    : undefined;

  return (
    <>
      <JobPostingJsonLd
        title={project.title}
        description={project.description}
        datePosted={project.rfpApprovedAt}
        hiringOrganizationName="Future Modern"
        hiringOrganizationUrl={SITE_URL}
        locationText="Remote"
        isRemote={true}
        compensationText={compText}
        employmentType="CONTRACTOR"
        url={`${SITE_URL}/contracts/${project.id}`}
      />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/contracts" className="text-sm text-ink-muted hover:text-ink">
          ← All open contracts
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "rgba(80,112,240,0.15)",
              color: "#5070F0",
            }}
          >
            Contract
          </span>
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            {INDUSTRY_LABELS[project.industry]}
          </span>
        </div>

        <h1 className="mt-2 font-display text-4xl font-semibold">
          {project.title}
        </h1>
        <p className="mt-4 text-lg text-ink-muted">{project.description}</p>

        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3">
          <Field label="Budget" value={compText ?? "—"} />
          <Field label="Status" value="Open for bids" />
          <Field
            label="Posted"
            value={new Date(project.rfpApprovedAt).toLocaleDateString(
              undefined,
              { year: "numeric", month: "short", day: "numeric" },
            )}
          />
        </div>

        {project.skillsRequired.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-wider text-ink-muted">
              Skills
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {project.skillsRequired.map((s) => (
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

        <div className="mt-12">
          {isSignedIn && rateBounds ? (
            <BidOnContractForm
              contractId={project.id}
              contractTitle={project.title}
              rateBounds={rateBounds}
            />
          ) : (
            <Card>
              <p className="text-lg font-medium">
                Sign in to see the full brief and bid.
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Deliverables spec, timeline, and bid form live behind the
                member surface. If you&apos;re not a member yet, request
                an invite.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`/signin?next=/contracts/${project.id}`}
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
