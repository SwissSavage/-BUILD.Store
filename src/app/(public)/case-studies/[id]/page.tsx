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
import { getProjectById } from "@/lib/readers/projects";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers } from "@/lib/readers/users";
import {
  INDUSTRY_LABELS,
  publicNameDisambiguated,
} from "@/lib/types";
import { Brief, briefPlainText } from "@/components/Brief";
import { Card, CardTitle } from "@/components/Card";

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
        <Link
          href="/case-studies"
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← All case studies
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "rgba(0,112,72,0.15)",
              color: "var(--fm-green-text)",
            }}
          >
            Completed
          </span>
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            {INDUSTRY_LABELS[project.industry]}
          </span>
        </div>

        <h1 className="mt-2 font-display text-4xl font-semibold">
          {project.title}
        </h1>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardTitle>About this work</CardTitle>
            <Brief text={project.description} title={project.title} className="mt-3" />
          </Card>
          <aside>
            <Card>
              {project.skillsRequired.length > 0 && (
                <div>
                  <CardTitle>Skills applied</CardTitle>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.skillsRequired.map((s) => (
                      <span key={s} className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {contributors.length > 0 && (
                <div className={project.skillsRequired.length > 0 ? "mt-6" : ""}>
                  <CardTitle>Contributors</CardTitle>
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
                </div>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
