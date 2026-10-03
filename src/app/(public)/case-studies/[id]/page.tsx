/**
 * /case-studies/[id] — public detail of a completed contract.
 *
 * Emits CreativeWork JSON-LD so search engines and AI answer engines
 * can index the case study as a discrete work with FM as creator +
 * contributors credited by first name only (via publicNameDisambiguated).
 * Deliverables spec + client identity stay behind the auth wall on
 * /projects/[id]; this route is the public marketing / SEO surface.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, Tags, Users } from "lucide-react";
import { getProjectById } from "@/lib/readers/projects";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers } from "@/lib/readers/users";
import {
  INDUSTRY_LABELS,
  publicNameDisambiguated,
} from "@/lib/types";
import { Brief, briefHeadings, briefPlainText } from "@/components/Brief";
import { BriefTableOfContents } from "@/components/BriefTableOfContents";
import { Card, CardTitle } from "@/components/Card";
import { OpportunityHeader } from "@/components/OpportunityHeader";
import { ExpandableSkillTags } from "@/components/ExpandableSkillTags";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

interface Params {
  id: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getProjectById(id);
  if (!p || p.status !== "completed") {
    return { title: "Case study not found — Future Modern" };
  }
  return {
    title: `${p.title} — Case study at Future Modern`,
    description: briefPlainText(p.description).slice(0, 155),
    alternates: { canonical: `${SITE_URL}/case-studies/${p.id}` },
  };
}

export default async function CaseStudyDetail({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (
    !project ||
    project.kind !== "contract" ||
    project.status !== "completed" ||
    !project.rfpApprovedAt
  ) {
    notFound();
  }

  const { users: roster } = await getAllUsers();
  const contributors = (project.assignedMemberIds ?? [])
    .map((uid) => roster.find((u) => u.id === uid))
    .filter((u): u is (typeof roster)[number] => !!u);
  const publishedAt = project.collectedAt ?? project.rfpApprovedAt;

  const creativeWork = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: briefPlainText(project.description),
    url: `${SITE_URL}/case-studies/${project.id}`,
    creator: {
      "@id": `${SITE_URL}#organization`,
    },
    ...(contributors.length > 0
      ? {
          contributor: contributors.map((c) => ({
            "@type": "Person",
            name: publicNameDisambiguated(c, roster),
            url: `${SITE_URL}/u/${c.handle}`,
          })),
        }
      : {}),
    ...(project.collectedAt
      ? { datePublished: project.collectedAt }
      : {}),
    ...(project.skillsRequired.length > 0
      ? { keywords: project.skillsRequired.join(", ") }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWork) }}
      />
      <div className="mx-auto max-w-app px-6 py-12">
        <OpportunityHeader
          backHref="/case-studies"
          backLabel="All case studies"
          imageUrl={project.featuredImageUrl}
          kind="Case study"
          industry={INDUSTRY_LABELS[project.industry]}
          title={project.title}
          postedAt={publishedAt}
          trailing={
            <span className="rounded-full bg-[rgba(0,112,72,0.18)] px-2.5 py-0.5 text-xs font-medium text-brand-greenText">
              Completed
            </span>
          }
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_20rem]">
          <BriefTableOfContents
            targetId="case-study-brief"
            headings={briefHeadings(project.description)}
          />
          <section id="case-study-brief">
            <Card className="p-8">
              <Brief text={project.description} title={project.title} />
            </Card>
          </section>
          <aside className="h-fit space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <FileText aria-hidden="true" size={18} strokeWidth={1.75} />
                  Case study details
                </span>
              </CardTitle>
              <div className="mt-4 space-y-4">
                <Field label="Status" value="Completed" />
                <Field
                  label="Published"
                  value={new Date(publishedAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                />
              </div>
            </Card>

            {project.skillsRequired.length > 0 && (
              <Card>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Tags aria-hidden="true" size={18} strokeWidth={1.75} />
                    Skills applied
                  </span>
                </CardTitle>
                <ExpandableSkillTags skills={project.skillsRequired} />
              </Card>
            )}

            {contributors.length > 0 && (
            <Card>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Users aria-hidden="true" size={18} strokeWidth={1.75} />
                  Contributors
                </span>
              </CardTitle>
              <ul className="mt-3 space-y-2">
                {contributors.map((c) => (
                  <li key={c.id} className="text-sm">
                    <Link href={`/u/${c.handle}`} className="font-medium hover:text-brand-magentaText">
                      {publicNameDisambiguated(c, roster)}
                    </Link>
                    {memberLabel(c) && (
                      <span className="ml-2 text-xs text-ink-muted">· {memberLabel(c)}</span>
                    )}
                  </li>
                ))}
              </ul>
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
      <p className="text-xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
