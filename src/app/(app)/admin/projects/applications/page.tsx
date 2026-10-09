/**
 * Which projects have proposals waiting, and how many.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS AN INDEX AND NOT A LOG (2026-10-08)
 *
 * This was every application to every project in one flat list, newest
 * first. Jamar: "each project should have its own isolated application
 * queue ... the unified log works small, that does not work at scale."
 *
 * The flat list is not merely untidy. Deciding on a proposal means
 * holding it against the other proposals for the same piece of work,
 * and interleaving six projects makes that impossible to do by reading
 * down the page. It also degrades in exactly the direction the
 * cooperative is trying to grow: every contract won makes this page
 * worse.
 *
 * So the triage moved to /admin/projects/[id]/applications and this
 * became the way in. It still answers the question this page was opened
 * to answer, which is "what is waiting on me", and it answers it in one
 * screen that stays one screen.
 *
 * The rows themselves live in ProjectApplicationRows so the two
 * surfaces cannot drift apart. Three hand-maintained admin nav lists
 * taught that lesson already.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllApplications } from "@/lib/readers/project-applications";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { CardEyebrow } from "@/components/Card";
import { formatDate } from "@/components/ProjectApplicationRows";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

interface QueueSummary {
  project: Project;
  pending: number;
  decided: number;
  newest: string | null;
}

export default async function AdminProjectApplicationsIndexPage() {
  await requireAdmin();

  const [applications, { projects }] = await Promise.all([
    safely(() => getAllApplications(), []),
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
  ]);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const byProject = new Map<string, QueueSummary>();

  for (const app of applications) {
    const project = projectById.get(app.projectId);
    // An application whose project is gone has nowhere to be triaged.
    // Counting it here would show a number that opens an empty page.
    if (!project) continue;
    const entry = byProject.get(project.id) ?? {
      project,
      pending: 0,
      decided: 0,
      newest: null,
    };
    if (app.status === "pending") entry.pending += 1;
    else entry.decided += 1;
    if (!entry.newest || app.createdAt > entry.newest) {
      entry.newest = app.createdAt;
    }
    byProject.set(project.id, entry);
  }

  const queues = [...byProject.values()];
  // Anything waiting on a decision first, then by how recently someone
  // put themselves forward. Both halves stay reachable.
  const waiting = queues
    .filter((q) => q.pending > 0)
    .sort((a, b) => (b.newest ?? "").localeCompare(a.newest ?? ""));
  const settled = queues
    .filter((q) => q.pending === 0)
    .sort((a, b) => (b.newest ?? "").localeCompare(a.newest ?? ""));

  const totalPending = waiting.reduce((n, q) => n + q.pending, 0);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Projects</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Proposals
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Each project keeps its own queue, because deciding on a
            proposal means weighing it against the others for that same
            work. Open a queue to triage it.
          </p>
        </div>
        <Link
          href="/admin/projects"
          className="text-xs text-brand-magentaText hover:underline"
        >
          ← All projects
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted">
          Waiting on you ({totalPending})
        </h2>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">All caught up.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {waiting.map((q) => (
              <QueueRow key={q.project.id} summary={q} />
            ))}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">
            Decided ({settled.length})
          </h2>
          <div className="mt-3 space-y-2">
            {settled.map((q) => (
              <QueueRow key={q.project.id} summary={q} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function QueueRow({ summary }: { summary: QueueSummary }) {
  const { project, pending, decided, newest } = summary;
  return (
    <Link
      href={`/admin/projects/${project.id}/applications`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4 hover:border-brand-magenta"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{project.title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {project.kind === "contract" ? "Contract" : "Internal"}
          {newest ? ` · latest ${formatDate(newest)}` : ""}
          {decided > 0 ? ` · ${decided} decided` : ""}
        </p>
      </div>
      {pending > 0 ? (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
          style={{ backgroundColor: "#5070F0" }}
        >
          {pending} pending
        </span>
      ) : (
        <span className="shrink-0 text-[11px] text-ink-faint">Clear</span>
      )}
    </Link>
  );
}
