/**
 * How far along, and nothing else.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-28)
 *
 * Jamar, on the public board and the Placed card: the store and the
 * contract cards show nothing about progress, and "specifics should be
 * hidden."
 *
 * MilestoneTracker is the full board. Titles, descriptions, due dates,
 * owners. That is right for the people doing the work and wrong for
 * everyone else, and until now it was the only thing that existed, so
 * any surface wanting to say "this is moving" had to show the whole
 * engagement or show nothing.
 *
 * This is the other end. A ratio and a count. It carries no titles, no
 * owners, no dates, no client, no money, and it takes none of those as
 * props, so it cannot leak them by being rendered somewhere careless.
 *
 * WHY ZERO MILESTONES RENDERS NOTHING
 *
 * A bar at 0% and a project nobody has scoped yet look identical, and
 * one of those is a lie about the engagement. An empty bar on a public
 * card reads as stalled work rather than unplanned work, so a project
 * with no milestones gets no bar at all.
 *
 * Milestone counts are themselves a mild signal: a bar that sits at
 * 2 of 5 for a month is visible to anyone watching. That is accepted
 * deliberately. It says the work is moving without saying what the
 * work is, which is the trade Jamar asked for.
 * ─────────────────────────────────────────────────────────────
 */

export interface MilestoneProgressProps {
  completed: number;
  total: number;
  /** Rendered above the bar. Keep it generic; it is public copy. */
  label?: string;
  /** Compact omits the count line, for dense card layouts. */
  compact?: boolean;
  className?: string;
}

export function MilestoneProgress({
  completed,
  total,
  label = "Progress",
  compact = false,
  className = "",
}: MilestoneProgressProps) {
  // Nothing to show, and an empty bar would misrepresent it. See the
  // WHY above.
  if (total <= 0) return null;

  const done = Math.max(0, Math.min(completed, total));
  const percent = Math.round((done / total) * 100);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-ink">
          {percent}%
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(102, 102, 102, 0.15)" }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent} percent of milestones complete`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: "#007048" }}
        />
      </div>
      {!compact && (
        <p className="mt-1 text-[10px] text-ink-faint">
          {done} of {total} milestones landed
        </p>
      )}
    </div>
  );
}
