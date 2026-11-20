/**
 * A Builder's own hours on one engagement.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-20)
 *
 * The timesheet model, the arithmetic and the client-facing black
 * form shipped on 2026-11-18 with nothing calling any of it. A
 * Builder could not enter an hour through the app, which made the
 * whole feature unreachable. This is the surface that was missing.
 *
 * WHY ONLY ON HOURLY ENGAGEMENTS
 *
 * A fixed-price engagement bills a figure agreed up front. Hours
 * logged against it would feed a timesheet that contradicts the
 * contract, so the section does not render at all rather than
 * collecting data nobody can use.
 *
 * WHY THE BUILDER SEES NO MONEY
 *
 * Hours and descriptions, and that is all. The client-facing rate is
 * documented on the schema as never shown to the Builder, and their
 * own net arrives through the remittance statement at settlement,
 * which is the one place it should come from. Showing a running total
 * in dollars here would be a second opinion about the same money.
 *
 * Server component: the reads happen here and the only client piece
 * is the form, which takes the project id and nothing else.
 * ─────────────────────────────────────────────────────────────
 */
import { LogTimeForm } from "@/components/LogTimeForm";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { getTimeEntriesForUserOnProject } from "@/lib/readers/timesheets";
import { safely } from "@/lib/readers";
import { formatHours, num, shortDate } from "@/lib/timesheet";
import type { Project, User } from "@/lib/types";

export async function ProjectTimeSection({
  project,
  user,
  onTeam,
}: {
  project: Project;
  user: User;
  onTeam: boolean;
}) {
  // Admins can log on somebody's behalf from the contract side. Here
  // the question is only whether this person is on this job.
  if (!onTeam) return null;
  if (project.engagementBasis !== "hourly") return null;

  const entries = await safely(
    () => getTimeEntriesForUserOnProject(project.id, user.id),
    [],
  );

  const billable = entries.filter((e) => e.billable);
  const total = billable.reduce((acc, e) => acc + num(e.hours), 0);
  const unbilled = entries.length - billable.length;

  return (
    <Card>
      <CardEyebrow>Your hours</CardEyebrow>
      <CardTitle className="mt-2">
        {entries.length === 0
          ? "Nothing logged yet"
          : `${formatHours(total)} billable${
              unbilled > 0
                ? `, and ${unbilled} not charged`
                : ""
            }`}
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        Log the day, the time and what you did. These lines become the
        timesheet the client receives alongside the invoice, so write
        them the way you would want to read them.
      </p>

      <LogTimeForm projectId={project.id} />

      {entries.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--surface-border)] text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5">
              <span className="w-16 shrink-0 text-ink-muted">
                {shortDate(e.workDate)}
              </span>
              <span className="w-16 shrink-0 tabular-nums">
                {formatHours(num(e.hours))}
                {e.precision === "estimated" && (
                  <span className="text-ink-faint"> *</span>
                )}
                {e.precision === "provisional" && (
                  <span className="text-ink-faint"> †</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                {e.description}
                {!e.billable && (
                  <span className="ml-2 rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-faint">
                    not charged
                    {e.exclusionReason ? ` · ${e.exclusionReason}` : ""}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
