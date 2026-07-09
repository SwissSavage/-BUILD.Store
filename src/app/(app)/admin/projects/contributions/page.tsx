/**
 * Admin queue for OUTSIDE-the-cooperative offers to contribute on a
 * specific internal project (Phase 2.8 sandbox).
 *
 * Submitters reach this rail by browsing /projects without an account,
 * picking an open initiative, and using the "Offer to help" form on
 * /projects/[id]. Each row carries the contributor's contact info and
 * pitch; admin reaches out by email and updates the row status:
 *   new → contacted → converted | dismissed
 *
 * REPLACE WITH: a Drizzle query joining `prospective_contributions` +
 * `projects`. The convert action will eventually create either a
 * `users` row + invite or a `project_applications` row on behalf of
 * the contributor — out of scope for the sandbox.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROSPECTIVE_CONTRIBUTIONS } from "@/lib/mock-data/prospective-contributions";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { decideProspectiveContribution } from "@/lib/prospective-contribution-actions";
import {
  PROSPECTIVE_CONTRIBUTION_STATUS_LABELS,
  adminName,
  type Project,
  type ProspectiveContribution,
  type ProspectiveContributionStatus,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const STATUS_ACCENT: Record<ProspectiveContributionStatus, string> = {
  new: "#5070F0",
  contacted: "#D828A0",
  converted: "#007048",
  dismissed: "#666666",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function projectFor(row: ProspectiveContribution): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === row.projectId);
}

export default async function AdminProjectContributionsPage() {
  await requireAdmin();

  const sorted = [...MOCK_PROSPECTIVE_CONTRIBUTIONS].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const open = sorted.filter(
    (c) => c.status === "new" || c.status === "contacted",
  );
  const closed = sorted.filter(
    (c) => c.status === "converted" || c.status === "dismissed",
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Projects</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Outside contributor queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Offers to help on a specific project from people without
            cooperative accounts. Reach out by email; status keeps the
            queue from going stale. Conversion to a real engagement
            still goes through the normal application or invite path.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href="/admin/projects/applications"
            className="text-brand-magenta hover:underline"
          >
            ← Member applications
          </Link>
          <Link
            href="/admin/projects"
            className="text-brand-magenta hover:underline"
          >
            All projects
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-ink-muted">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            No outstanding outside offers.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {open.map((c) => (
              <OpenRow key={c.id} row={c} />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">
            Closed ({closed.length})
          </h2>
          <div className="mt-3 space-y-2">
            {closed.map((c) => (
              <ClosedRow key={c.id} row={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OpenRow({ row }: { row: ProspectiveContribution }) {
  const project = projectFor(row);
  const accent = STATUS_ACCENT[row.status];

  return (
    <Card className={row.status === "new" ? "border-[#5070F0]/40" : "border-[#D828A0]/40"}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <CardTitle>{row.contactName}</CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            <a
              href={`mailto:${row.contactEmail}`}
              className="text-brand-magenta hover:underline"
            >
              {row.contactEmail}
            </a>{" "}
            · {row.hoursPerWeek}h/wk · submitted{" "}
            {formatDate(row.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
            style={{ backgroundColor: accent + "22", color: accent }}
          >
            {PROSPECTIVE_CONTRIBUTION_STATUS_LABELS[row.status]}
          </span>
          <Link
            href={project ? `/projects/${project.id}` : "/projects"}
            className="text-xs text-brand-magenta hover:underline"
          >
            {project ? project.title : "Project missing"} →
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          Proposed role
        </p>
        <p className="mt-1 font-medium">{row.proposedRole}</p>

        <p className="mt-4 text-xs uppercase tracking-wider text-ink-muted">
          Pitch
        </p>
        <p className="mt-1 text-sm italic text-ink-muted">"{row.pitch}"</p>

        {row.portfolioLink && (
          <p className="mt-3 text-xs">
            <span className="text-ink-muted">Reference: </span>
            <a
              href={row.portfolioLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-magenta hover:underline"
            >
              {row.portfolioLink}
            </a>
          </p>
        )}

        {row.adminNote && (
          <p
            className="mt-3 rounded-lg border px-3 py-2 text-xs italic"
            style={{ borderColor: `${accent}55`, color: accent }}
          >
            Note: {row.adminNote}
          </p>
        )}
      </div>

      <form
        action={decideProspectiveContribution}
        className="mt-5 space-y-3 border-t border-[var(--surface-border)] pt-4"
      >
        <input type="hidden" name="id" value={row.id} />
        <label
          htmlFor={`note-${row.id}`}
          className="block text-xs uppercase tracking-wider text-ink-muted"
        >
          Internal note (queue-only — never auto-emailed)
        </label>
        <textarea
          id={`note-${row.id}`}
          name="adminNote"
          rows={2}
          defaultValue={row.adminNote ?? ""}
          placeholder="e.g. Replied 4/27, booking intro for next Wed."
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {row.status === "new" && (
            <button
              type="submit"
              name="status"
              value="contacted"
              className="rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Mark contacted
            </button>
          )}
          <button
            type="submit"
            name="status"
            value="converted"
            className="rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Mark converted
          </button>
          <button
            type="submit"
            name="status"
            value="dismissed"
            className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm hover:border-brand-magenta hover:text-brand-magenta"
          >
            Dismiss
          </button>
        </div>
      </form>
    </Card>
  );
}

function ClosedRow({ row }: { row: ProspectiveContribution }) {
  const project = projectFor(row);
  const accent = STATUS_ACCENT[row.status];
  const decidedBy = row.reviewedBy
    ? MOCK_USERS.find((u) => u.id === row.reviewedBy)
    : undefined;

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{row.contactName}</span>
          <span className="text-ink-muted"> · {row.proposedRole}</span>
          {project && (
            <Link
              href={`/projects/${project.id}`}
              className="ml-2 text-xs text-brand-magenta hover:underline"
            >
              {project.title} →
            </Link>
          )}
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
          style={{ backgroundColor: accent + "22", color: accent }}
        >
          {PROSPECTIVE_CONTRIBUTION_STATUS_LABELS[row.status]}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {row.reviewedAt ? `Closed ${formatDate(row.reviewedAt)}` : ""}
        {decidedBy ? ` by ${adminName(decidedBy)}` : ""}
      </p>
      {row.adminNote && (
        <p className="mt-2 text-xs italic" style={{ color: accent }}>
          "{row.adminNote}"
        </p>
      )}
    </div>
  );
}
