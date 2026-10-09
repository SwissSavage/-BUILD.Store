/**
 * One project's proposals, and nothing else.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * Jamar: "each project should have its own isolated application queue
 * ... the unified log works small, that does not work at scale."
 *
 * Triaging a proposal means comparing it against the other proposals
 * for the same piece of work. The flat queue made that a scrolling
 * exercise, and one that gets worse every time the cooperative wins
 * anything. This is the surface the work actually happens on; the
 * cross-cutting list is now an index that points here.
 *
 * `getApplicationsForProject` has existed since the project page
 * needed it. Nothing in the schema changed. The queue was flat because
 * the page was flat.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { getApplicationsForProject } from "@/lib/readers/project-applications";
import { getAllUsers } from "@/lib/readers/users";
import { getProjectById } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { CardEyebrow } from "@/components/Card";
import {
  DecidedRow,
  PendingRow,
  makeLookup,
} from "@/components/ProjectApplicationRows";

export const dynamic = "force-dynamic";

export default async function ProjectApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const project = await safely(() => getProjectById(id), null);
  if (!project) notFound();

  const [applications, { users: roster }] = await Promise.all([
    safely(() => getApplicationsForProject(id), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const lookup = makeLookup(roster, [project]);

  const sorted = [...applications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pending = sorted.filter((a) => a.status === "pending");
  const decided = sorted.filter((a) => a.status !== "pending");

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Proposals</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            {project.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Everyone who has proposed themselves for this work, and nobody
            who has not. Build the team from who is available. Passing on
            someone here is about fit for this piece, not a judgment on
            them.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <Link
            href={`/projects/${project.id}`}
            className="text-brand-magentaText hover:underline"
          >
            Open the project →
          </Link>
          <Link
            href="/admin/projects/applications"
            className="text-ink-muted hover:text-brand-magentaText"
          >
            ← All proposal queues
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            Nothing waiting on you here.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((a) => (
              <PendingRow key={a.id} application={a} lookup={lookup} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">
            Decided ({decided.length})
          </h2>
          <div className="mt-3 space-y-2">
            {decided.map((a) => (
              <DecidedRow
                key={a.id}
                application={a}
                lookup={lookup}
                roster={roster}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
