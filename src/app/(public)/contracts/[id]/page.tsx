/**
 * /contracts/[id] — public contract detail with JobPosting JSON-LD
 * (employmentType=CONTRACTOR).
 *
 * Skeleton (title, industry, skill tags, kind) is indexable.
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
import { Brief, briefHeadings, briefPlainText } from "@/components/Brief";
import { BriefTableOfContents } from "@/components/BriefTableOfContents";
import { Card, CardTitle } from "@/components/Card";
import { OpportunityHeader } from "@/components/OpportunityHeader";
import { AdminObjectControls } from "@/components/AdminObjectControls";
import { BidOnContractForm } from "@/components/BidOnContractForm";
import { computeRateBounds } from "@/lib/rate-bounds";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projectApplications } from "@/db/schema";
import { safely } from "@/lib/readers/factory";

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
    description: briefPlainText(p.description).slice(0, 155),
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

  // This viewer's current proposal, so the form opens as an editor
  // rather than pretending they have not bid. Without it a second
  // submission hit the duplicate check and failed illegibly.
  const existingProposal = currentUser
    ? ((
        await safely(
          () =>
            db
              .select({
                proposedRole: projectApplications.proposedRole,
                pitch: projectApplications.pitch,
                hoursPerWeek: projectApplications.hoursPerWeek,
                hourlyRate: projectApplications.hourlyRate,
                portfolioLink: projectApplications.portfolioLink,
                status: projectApplications.status,
                createdAt: projectApplications.createdAt,
              })
              .from(projectApplications)
              .where(
                and(
                  eq(projectApplications.projectId, id),
                  eq(projectApplications.userId, currentUser.id),
                  sql`${projectApplications.status} IN ('pending', 'approved')`,
                ),
              )
              .limit(1),
          [],
        )
      )[0] ?? null)
    : null;

  // Bid range for the signed-in bidder (task #48). Flat platform
  // range for everyone — talent sets their own rates; admin handles
  // outliers during triage. Null for signed-out viewers so they see
  // the sign-in card instead of the bid form.
  const rateBounds = currentUser
    ? computeRateBounds(currentUser)
    : null;

  // Budgets are private negotiation data: only the contract's submitting
  // client and administrators may see them.
  const canSeeBudget =
    currentUser?.isAdmin === true || currentUser?.id === project.clientId;
  const budgetNum = Number(project.budget);
  const compText = Number.isFinite(budgetNum)
    ? `$${budgetNum.toLocaleString()}`
    : undefined;

  return (
    <>
      <JobPostingJsonLd
        title={project.title}
        description={briefPlainText(project.description)}
        datePosted={project.rfpApprovedAt}
        hiringOrganizationName="Future Modern"
        hiringOrganizationUrl={SITE_URL}
        locationText="Remote"
        isRemote={true}
        compensationText={canSeeBudget ? compText : undefined}
        employmentType="CONTRACTOR"
        url={`${SITE_URL}/contracts/${project.id}`}
      />

      <div className="mx-auto max-w-app px-6 py-12">
        <OpportunityHeader
          backHref="/contracts"
          backLabel="All open contracts"
          imageUrl={project.featuredImageUrl}
          kind="Contract"
          industry={INDUSTRY_LABELS[project.industry]}
          title={project.title}
          postedAt={project.rfpApprovedAt}
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_20rem]">
          <BriefTableOfContents
            targetId="contract-brief"
            headings={briefHeadings(project.description)}
          />
          <div className="space-y-6">
            <section id="contract-brief">
              {/* Editorial reading surface, deliberately quieter than the action cards in the right rail. */}
              <Card className="bg-[var(--surface-reading)] p-8">
                <Brief text={project.description} title={project.title} />
                <AdminObjectControls
                  editHref={`/admin/projects/${project.id}/edit`}
                  label="contract"
                />
              </Card>
            </section>

            <section id="your-proposal" className="scroll-mt-24">
              {isSignedIn && rateBounds ? (
                <BidOnContractForm
                  contractId={project.id}
                  contractTitle={project.title}
                  rateBounds={rateBounds}
                  existing={existingProposal}
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
                      className="fm-btn-primary rounded-full px-5 py-2 text-sm"
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
            </section>
          </div>
          {/* Desktop rail: opportunity details stay visible while a long RFP is read. */}
          <aside className="h-fit space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="flex min-h-56 flex-col">
              <CardTitle>Open for bids</CardTitle>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Submit a proposal for this contract. The cooperative reviews
                each response before sharing selected candidates with the client.
              </p>
              {isSignedIn ? (
                <a href="#your-proposal" className="fm-btn-primary mt-auto rounded-full px-4 py-2 text-center text-sm">
                  Bid on this contract
                </a>
              ) : (
                <Link
                  href={`/signin?next=/contracts/${project.id}`}
                  className="fm-btn-primary mt-auto rounded-full px-4 py-2 text-center text-sm"
                >
                  Sign in to bid
                </Link>
              )}
            </Card>

            <Card>
              <CardTitle>Contract details</CardTitle>
              <div className="mt-4 space-y-4">
                {canSeeBudget && <Field label="Budget" value={compText ?? "—"} />}
                <Field
                  label="Posted"
                  value={new Date(project.rfpApprovedAt).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "short", day: "numeric" },
                  )}
                />
              </div>
            </Card>

            {project.skillsRequired.length > 0 && (
              <Card>
                <CardTitle>Skills</CardTitle>
                <SkillTags skills={project.skillsRequired} />
              </Card>
            )}
          </aside>
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

function SkillTags({ skills }: { skills: string[] }) {
  const visible = skills.slice(0, 3);
  const hidden = skills.slice(3);
  const tagClass = "rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {visible.map((skill) => <span key={skill} className={tagClass}>{skill}</span>)}
      {hidden.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none rounded-full bg-brand-magenta px-2 py-0.5 text-xs text-black [&::-webkit-details-marker]:hidden">
            +{hidden.length} more
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((skill) => <span key={skill} className={tagClass}>{skill}</span>)}
          </div>
        </details>
      )}
    </div>
  );
}
