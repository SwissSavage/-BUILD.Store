/**
 * Admin: project milestone tracker (PM surface).
 *
 * Full CRUD over `project_milestones` for one contract:
 *   - Add a milestone with title, description, owner, due date.
 *   - Update status from any state to any other.
 *   - Send a ping to the owner.
 *   - Resolve a blocker.
 *   - Delete a milestone.
 *
 * Plus the manual deadline sweep at the top — fires `milestone_due_soon`
 * and `milestone_overdue` notifications for everything that qualifies,
 * debounced 24 hours.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  milestonesForProject,
  projectProgress,
} from "@/lib/mock-data/project-milestones";
import {
  createMilestone,
  deleteMilestone,
  pingMilestoneOwner,
  resolveBlocker,
  sweepDeadlines,
  updateMilestoneStatus,
} from "@/lib/milestone-actions";
import {
  MILESTONE_STATUS_LABELS,
  publicName,
  type MilestoneStatus,
  type ProjectMilestone,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { MilestoneTracker } from "@/components/MilestoneTracker";

const STATUS_OPTIONS: MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "completed",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function ownerLabel(ownerUserId: string): string {
  const u = MOCK_USERS.find((x) => x.id === ownerUserId);
  return u ? publicName(u) : ownerUserId;
}

export default async function AdminTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const milestones = milestonesForProject(id);
  const progress = projectProgress(id);
  const teamCandidates = project.assignedMemberIds
    .concat(project.adminUserIds)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((uid) => MOCK_USERS.find((u) => u.id === uid))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Project tracker · admin</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            {project.title}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {progress.completed} of {progress.total} milestones complete.
            Status: <strong>{project.status}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/contracts/${id}/ledger`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Ledger
          </Link>
          <Link
            href={`/admin/contracts/${id}/attribution`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Attribution
          </Link>
          <Link
            href={`/contracts/${id}/tracker?token=demo`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Client preview
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <MilestoneTracker milestones={milestones} />
      </div>

      <Card className="mt-6 border-[#5070F0]/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardEyebrow>Sweep</CardEyebrow>
            <CardTitle className="mt-1 text-lg">
              Run the deadline sweep
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Fires due-soon notifications to owners on rows due within
              three days, and overdue notifications to project admins on
              rows past due. Debounced 24 hours per row. Runs against
              every project in production via daily cron; this button is
              the manual trigger for sandbox use.
            </p>
          </div>
          <form action={sweepDeadlines}>
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Run sweep
            </button>
          </form>
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Milestones ({milestones.length})
        </h2>
        <div className="mt-4 space-y-4">
          {milestones.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                No milestones yet. Add the first one below to start the
                tracker.
              </p>
            </Card>
          ) : (
            milestones.map((m) => (
              <MilestoneRow
                key={m.id}
                milestone={m}
                teamCandidates={teamCandidates}
              />
            ))
          )}
        </div>
      </section>

      <Card className="mt-10 border-[#D828A0]/40">
        <CardEyebrow>Add a milestone</CardEyebrow>
        <CardTitle className="mt-1 text-xl">New milestone</CardTitle>
        <form action={createMilestone} className="mt-5 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="projectId" value={id} />
          <label className="block md:col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Title
            </span>
            <input
              name="title"
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Description (optional)
            </span>
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Owner
            </span>
            <select
              name="ownerUserId"
              required
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Pick the milestone owner
              </option>
              {teamCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {publicName(u)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Due date
            </span>
            <input
              name="dueAt"
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Create milestone
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function MilestoneRow({
  milestone,
  teamCandidates,
}: {
  milestone: ProjectMilestone;
  teamCandidates: Array<{ id: string }>;
}) {
  void teamCandidates;
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>
            Step {milestone.sequence / 10}
            <span className="ml-2 text-ink-faint">
              · Due {formatDate(milestone.dueAt)}
            </span>
          </CardEyebrow>
          <CardTitle className="mt-1 text-lg">{milestone.title}</CardTitle>
          {milestone.description && (
            <p className="mt-1 text-xs text-ink-muted">
              {milestone.description}
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-faint">
            Owner: {ownerLabel(milestone.ownerUserId)}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider"
          style={{
            backgroundColor:
              milestone.status === "completed"
                ? "rgba(0, 112, 72, 0.12)"
                : milestone.status === "blocked"
                  ? "rgba(216, 40, 160, 0.12)"
                  : milestone.status === "in_progress"
                    ? "rgba(80, 112, 240, 0.12)"
                    : "rgba(102, 102, 102, 0.12)",
            color:
              milestone.status === "completed"
                ? "#007048"
                : milestone.status === "blocked"
                  ? "#D828A0"
                  : milestone.status === "in_progress"
                    ? "#5070F0"
                    : "#666666",
          }}
        >
          {MILESTONE_STATUS_LABELS[milestone.status]}
        </span>
      </div>

      {milestone.status === "blocked" && milestone.blockerNote && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{ backgroundColor: "rgba(216, 40, 160, 0.06)" }}
        >
          <span className="text-[10px] uppercase tracking-wider text-brand-magenta">
            Blocker
          </span>
          <p className="mt-1 text-ink">{milestone.blockerNote}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <form action={updateMilestoneStatus} className="flex items-end gap-2">
          <input type="hidden" name="id" value={milestone.id} />
          <label className="flex flex-col text-[10px] uppercase tracking-wider text-ink-faint">
            Status
            <select
              name="status"
              defaultValue={milestone.status}
              className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-sm normal-case tracking-normal text-ink"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {MILESTONE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
          >
            Update
          </button>
        </form>

        <form action={pingMilestoneOwner}>
          <input type="hidden" name="id" value={milestone.id} />
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
          >
            Ping owner
          </button>
        </form>

        {milestone.status === "blocked" && (
          <form action={resolveBlocker}>
            <input type="hidden" name="id" value={milestone.id} />
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: "#007048" }}
            >
              Resolve blocker
            </button>
          </form>
        )}

        <form action={deleteMilestone}>
          <input type="hidden" name="id" value={milestone.id} />
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] text-brand-magenta hover:bg-[var(--surface-inset)]"
          >
            Delete
          </button>
        </form>
      </div>
    </Card>
  );
}
