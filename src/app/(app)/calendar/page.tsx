/**
 * Shared cooperative calendar — Member-tier view.
 *
 * Shows the next 14 days across the cooperative:
 *   - Member availability windows (who's bookable when)
 *   - Upcoming meetings (peer / external / governance) the viewer can
 *     see — confirmed meetings are visible across the cohort, pending
 *     ones surface only to attendees.
 *
 * Transparency posture per locked architecture: Members can see each
 * other's busy windows (no event details), peer meetings between others
 * appear as busy blocks, governance/team meetings are visible to all
 * Members.
 *
 * Auth-gated to Members only. Partners route through the FM agent.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers } from "@/lib/readers/users";
import {
  availabilityReader,
  getUpcomingMeetings,
  safely,
} from "@/lib/readers";
import {
  CALENDAR_MEETING_KIND_LABELS,
  CALENDAR_MEETING_STATUS_LABELS,
  publicName,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtMinute(m: number): string {
  const norm = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const mm = norm % 60;
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(mm).padStart(2, "0")}${ampm}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDate(
  meetings: Awaited<ReturnType<typeof getUpcomingMeetings>>,
) {
  const groups: Record<string, typeof meetings> = {};
  for (const m of meetings) {
    const date = new Date(m.startsAt).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    groups[date] = groups[date] ?? [];
    groups[date].push(m);
  }
  return groups;
}

export default async function CooperativeCalendarPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/signin?next=/calendar");

  if (viewer.membershipTier !== "member" && !viewer.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          Members-only surface
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The shared cooperative calendar is Member-tier. Partner bookings
          route through the FM agent layer.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-block text-sm text-brand-magentaText hover:underline"
        >
          ← Back to profile
        </Link>
      </div>
    );
  }

  // Reader swap 2026-08-29: was MOCK_USERS.
  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });
  const members = roster.filter((u) => u.membershipTier === "member");

  // Reader swap 2026-09-03. Meetings and availability both came from
  // fixtures, so the cooperative calendar showed seed meetings that
  // were never scheduled and seed availability windows for people who
  // had declared none. Anyone booking off this was booking fiction.
  //
  // Availability loads once and groups in memory rather than querying
  // per member inside the render loop below, which would be one round
  // trip per Member on every page view.
  const [meetings, allAvailability] = await Promise.all([
    safely(() => getUpcomingMeetings(14), []),
    safely(() => availabilityReader.all(), []),
  ]);

  const availabilityByUser = new Map<string, typeof allAvailability>();
  for (const a of allAvailability) {
    const list = availabilityByUser.get(a.userId) ?? [];
    list.push(a);
    availabilityByUser.set(a.userId, list);
  }
  for (const list of availabilityByUser.values()) {
    list.sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
    );
  }

  const meetingsByDay = groupByDate(meetings);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold">
            Cooperative calendar
          </h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Next 14 days across the cooperative. Member availability +
            scheduled meetings. Peer meetings between Members surface to
            attendees only; governance and team meetings are visible to
            all Members.
          </p>
        </div>
        <Link
          href="/profile/calendar"
          className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:border-brand-magenta hover:text-brand-magentaText"
        >
          Manage your calendar →
        </Link>
      </div>

      {/* Member availability summary */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Member availability
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Weekly recurring windows declared by each Member. Glance to
          see who&apos;s available for a peer booking.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {members.map((m) => {
            const windows = availabilityByUser.get(m.id) ?? [];
            return (
              <Card key={m.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link
                      href={`/u/${m.handle}`}
                      className="hover:underline"
                    >
                      {publicName(m)}
                    </Link>
                  </CardTitle>
                  {memberLabel(m) && (
                    <span className="text-[11px] text-ink-muted">
                      {memberLabel(m)}
                    </span>
                  )}
                </div>
                {windows.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-muted">
                    No availability declared yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-0.5 text-xs">
                    {windows.map((w) => (
                      <li key={w.id} className="text-ink">
                        <strong>{DAYS_SHORT[w.dayOfWeek]}</strong>{" "}
                        {fmtMinute(w.startMinute)} →{" "}
                        {fmtMinute(w.endMinute)}{" "}
                        <span className="text-[10px] text-ink-faint">
                          ({w.timezone})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Upcoming meetings */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Scheduled — next 14 days
        </h2>
        {meetings.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No scheduled meetings in the next two weeks. Book a peer
              meeting from <code>/profile/calendar</code> or have an
              admin schedule an external-client meeting.
            </p>
          </Card>
        ) : (
          Object.entries(meetingsByDay).map(([day, items]) => (
            <div key={day} className="mt-5">
              <h3 className="font-display text-lg font-semibold text-brand-magentaText">
                {day}
              </h3>
              <ul className="mt-2 space-y-2">
                {items.map((m) => {
                  const visibleToViewer =
                    m.attendeeIds.includes(viewer.id) ||
                    viewer.isAdmin ||
                    m.kind === "team_governance" ||
                    (m.status === "confirmed" && m.kind !== "peer_internal");
                  const isViewerAttendee = m.attendeeIds.includes(viewer.id);
                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="text-sm">
                          {visibleToViewer ? m.title : "(busy)"}
                        </strong>
                        <span className="text-[11px] text-ink-faint">
                          {fmtDateTime(m.startsAt)} → {fmtDateTime(m.endsAt)}
                        </span>
                      </div>
                      {visibleToViewer && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {CALENDAR_MEETING_KIND_LABELS[m.kind]} ·{" "}
                          {CALENDAR_MEETING_STATUS_LABELS[m.status]}
                          {m.externalClientName && (
                            <> · {m.externalClientName}</>
                          )}
                          {isViewerAttendee && (
                            <>
                              {" "}
                              <span className="text-brand-magentaText">
                                · you&apos;re on this
                              </span>
                            </>
                          )}
                        </p>
                      )}
                      {visibleToViewer && m.description && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {m.description}
                        </p>
                      )}
                      {!visibleToViewer && (
                        <p className="mt-1 text-[11px] text-ink-faint">
                          Member-to-Member peer meeting. Details visible
                          to attendees only.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
