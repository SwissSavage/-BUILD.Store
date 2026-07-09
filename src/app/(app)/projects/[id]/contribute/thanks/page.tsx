/**
 * Thank-you surface after a public ProspectiveContribution submission.
 * Deliberately doesn't reveal queue state (no "you're #3 in line") —
 * outreach is human and admin-paced.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function ContributeThanksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="border-[#007048]/40">
        <CardEyebrow>Offer received</CardEyebrow>
        <CardTitle className="mt-2">Thanks for offering to help.</CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          We got your note on{" "}
          <span className="text-ink">{project.title}</span>. Admin
          reviews each offer personally — usually within a few days —
          and reaches out by email to either book a quick intro call or
          let you know it isn&apos;t a fit this round. Either way, you
          hear back from a human, not an autoresponder.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          If you&apos;d like to learn more about the cooperative while
          you wait,{" "}
          <Link href="/about" className="text-brand-magenta hover:underline">
            here&apos;s what we&apos;re building
          </Link>
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta hover:text-brand-magenta"
          >
            Back to projects
          </Link>
          <Link
            href="/whitelist"
            className="rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Other ways to engage →
          </Link>
        </div>
      </Card>
    </div>
  );
}
