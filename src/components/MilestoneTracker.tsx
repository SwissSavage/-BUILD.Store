/**
 * Domino's-tracker style milestone strip.
 *
 * Horizontal step indicator with one node per milestone, color-coded by
 * status, with overall progress and a current-state callout. Used on the
 * client-facing tracker (read-only), the admin PM surface, and the
 * talent project page.
 *
 * No state of its own — pure presentation from milestones + progress.
 */
import {
  MILESTONE_STATUS_LABELS,
  type MilestoneStatus,
  type ProjectMilestone,
} from "@/lib/types";

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  not_started: "#666666",
  in_progress: "#5070F0",
  blocked: "#D828A0",
  completed: "#007048",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function MilestoneTracker({
  milestones,
}: {
  milestones: ProjectMilestone[];
}) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-inset)] p-6 text-sm text-ink-muted">
        No milestones set yet. The team will populate the tracker once the
        engagement scope is locked.
      </div>
    );
  }

  const completed = milestones.filter((m) => m.status === "completed").length;
  const total = milestones.length;
  const ratio = total === 0 ? 0 : completed / total;

  const active =
    milestones.find((m) => m.status === "in_progress") ??
    milestones.find((m) => m.status === "blocked") ??
    milestones.find((m) => m.status !== "completed") ??
    milestones[milestones.length - 1];

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">
            Progress
          </div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {completed} of {total} milestones
          </div>
        </div>
        <div className="text-xs text-ink-muted">
          {Math.round(ratio * 100)}% complete
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: "#007048",
          }}
        />
      </div>

      <ol className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {milestones.map((m, idx) => {
          const isActive = m.id === active.id;
          const color = STATUS_COLOR[m.status];
          return (
            <li
              key={m.id}
              className={
                "rounded-xl border p-3 " +
                (isActive
                  ? "border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-sm"
                  : "border-[var(--surface-border)] bg-[var(--surface)]")
              }
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {idx + 1}
                </span>
                <span style={{ color }}>
                  {MILESTONE_STATUS_LABELS[m.status]}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium">{m.title}</div>
              <div className="mt-1 text-[11px] text-ink-faint">
                <DueLabel milestone={m} />
              </div>
              {m.status === "blocked" && m.blockerNote && (
                <p
                  className="mt-2 rounded-md px-2 py-1 text-[11px]"
                  style={{
                    backgroundColor: "rgba(216, 40, 160, 0.08)",
                    color: "#D828A0",
                  }}
                >
                  {m.blockerNote}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 rounded-xl bg-[var(--surface-inset)] p-3 text-xs text-ink-muted">
        Currently:{" "}
        <strong className="text-ink">{active.title}</strong>
        <span className="ml-2 text-ink-faint">
          (<DueLabel milestone={active} />)
        </span>
      </div>
    </div>
  );
}

function DueLabel({ milestone }: { milestone: ProjectMilestone }) {
  if (milestone.status === "completed") {
    if (milestone.completedAt) {
      return <>Completed {formatDate(milestone.completedAt)}</>;
    }
    return <>Completed</>;
  }
  const days = daysFromNow(milestone.dueAt);
  if (days > 1) return <>Due {formatDate(milestone.dueAt)} ({days} days)</>;
  if (days === 1) return <>Due tomorrow ({formatDate(milestone.dueAt)})</>;
  if (days === 0) return <>Due today</>;
  return (
    <span style={{ color: "#D828A0" }}>
      Overdue by {Math.abs(days)} day{Math.abs(days) === 1 ? "" : "s"}{" "}
      ({formatDate(milestone.dueAt)})
    </span>
  );
}
