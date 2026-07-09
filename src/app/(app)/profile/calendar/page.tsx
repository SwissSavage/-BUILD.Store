/**
 * Member calendar — personal view + management.
 *
 * Surfaces:
 *   - Upcoming meetings (next 14 days, grouped by status)
 *   - Weekly recurring availability (Member declares bookable windows)
 *   - One-off blocks (focus time, travel, etc.)
 *   - Form to book a peer Member-to-Member meeting
 *
 * Locked posture (`future-modern.md` shared cooperative calendar):
 * Only Members can use this surface. Peer bookings are Member-only.
 * Partners route through the FM agent layer (admin-created external
 * client meetings include them as attendees).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  availabilityForUser,
  blocksForUser,
  upcomingMeetingsForUser,
} from "@/lib/mock-data/calendar";
import {
  addAvailability,
  addBlock,
  cancelMeeting,
  confirmMeeting,
  createPeerMeeting,
  declineMeeting,
  removeAvailability,
  removeBlock,
} from "@/lib/calendar-actions";
import { minuteForMeeting } from "@/lib/mock-data/meeting-minutes";
import {
  captureMeetingMinute,
  addMinuteCorrection,
} from "@/lib/meeting-minute-actions";
import {
  CALENDAR_MEETING_KIND_LABELS,
  CALENDAR_MEETING_STATUS_LABELS,
  publicName,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

export default async function ProfileCalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/calendar");

  if (user.membershipTier !== "member") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          Calendar is for Members
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The shared cooperative calendar is a Member-tier surface.
          Partner bookings route through the FM agent layer — clients
          schedule through admin, who manages the engagement calendar
          on your behalf. See <code>future-modern.md</code> tier-access
          matrix for the full posture.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-block text-sm text-brand-magenta hover:underline"
        >
          ← Back to profile
        </Link>
      </div>
    );
  }

  const availability = availabilityForUser(user.id);
  const blocks = blocksForUser(user.id);
  const meetings = upcomingMeetingsForUser(user.id, 14);
  const memberPeers = MOCK_USERS.filter(
    (u) => u.membershipTier === "member" && u.id !== user.id,
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/profile"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Your calendar
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Manage your weekly availability + one-off blocks; see upcoming
        meetings; book peer meetings with other Members. External-client
        meetings get scheduled through the FM agent layer and land here
        as confirmable invitations.
      </p>

      {/* Upcoming meetings */}
      <Card className="mt-8">
        <CardEyebrow>Upcoming</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          Next 14 days — {meetings.length} meeting
          {meetings.length === 1 ? "" : "s"}
        </CardTitle>
        {meetings.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No meetings on your calendar in the next 14 days.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {meetings.map((m) => {
              const isOrganizer = m.organizerId === user.id;
              const hasConfirmed = m.confirmedByAttendeeIds.includes(user.id);
              const otherAttendees = m.attendeeIds
                .filter((a) => a !== user.id)
                .map((a) => MOCK_USERS.find((u) => u.id === a))
                .filter(Boolean);
              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-[var(--surface-border)] p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-sm">{m.title}</strong>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{
                        backgroundColor:
                          m.status === "confirmed"
                            ? "rgba(0, 112, 72, 0.12)"
                            : m.status === "pending"
                              ? "rgba(80, 112, 240, 0.12)"
                              : "rgba(102, 102, 102, 0.12)",
                        color:
                          m.status === "confirmed"
                            ? "#007048"
                            : m.status === "pending"
                              ? "#5070F0"
                              : "#666666",
                      }}
                    >
                      {CALENDAR_MEETING_STATUS_LABELS[m.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {fmtDateTime(m.startsAt)} → {fmtDateTime(m.endsAt)}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {CALENDAR_MEETING_KIND_LABELS[m.kind]}
                    {otherAttendees.length > 0 && (
                      <>
                        {" "}· with{" "}
                        {otherAttendees
                          .map((a) => publicName(a!))
                          .join(", ")}
                      </>
                    )}
                    {m.externalClientName && (
                      <> · client: {m.externalClientName}</>
                    )}
                  </p>
                  {m.description && (
                    <p className="mt-2 text-xs text-ink-muted">{m.description}</p>
                  )}
                  {m.kind === "peer_internal" && (
                    <p className="mt-1 text-[11px] text-brand-magenta">
                      Member-to-Member meetings require minutes or recording.
                      Capture after the call.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.status === "pending" && !hasConfirmed && (
                      <form action={confirmMeeting}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                          style={{ backgroundColor: "#007048" }}
                        >
                          Confirm
                        </button>
                      </form>
                    )}
                    {m.status === "pending" && (
                      <form action={declineMeeting}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
                        >
                          Decline
                        </button>
                      </form>
                    )}
                    {(isOrganizer || user.isAdmin) &&
                      m.status !== "cancelled" && (
                        <form action={cancelMeeting}>
                          <input type="hidden" name="id" value={m.id} />
                          <button
                            type="submit"
                            className="text-[11px] text-brand-magenta underline hover:opacity-80"
                          >
                            Cancel meeting
                          </button>
                        </form>
                      )}
                  </div>

                  {/* Minutes / recording rail per meeting.
                      Internal Member-to-Member meetings require minutes;
                      external + governance can capture too. */}
                  {(() => {
                    const minute = minuteForMeeting(m.id);
                    return (
                      <details className="mt-3 rounded-lg bg-[var(--surface)] p-3">
                        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-brand-magenta">
                          {minute ? "Minutes on file" : "Capture minutes or recording"}
                        </summary>
                        {minute && (
                          <div className="mt-3 space-y-2 text-xs">
                            {minute.format === "notes" && (
                              <div className="whitespace-pre-line text-ink">
                                {minute.body}
                              </div>
                            )}
                            {minute.format === "recording" && (
                              <a
                                href={minute.recordingUrl ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-magenta underline"
                              >
                                Recording ↗
                              </a>
                            )}
                            {minute.format === "transcript_upload" && minute.uploadedFile && (
                              <div className="rounded-lg border border-[var(--surface-border)] p-2 text-ink">
                                <strong>{minute.uploadedFile.name}</strong>{" "}
                                <span className="text-ink-faint">
                                  ({Math.round(minute.uploadedFile.size / 1024)} kB
                                  {minute.uploadedFile.type
                                    ? ` · ${minute.uploadedFile.type}`
                                    : ""})
                                </span>
                                {minute.uploadedFile.url ? (
                                  <a
                                    href={minute.uploadedFile.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-2 text-brand-magenta underline"
                                  >
                                    Open ↗
                                  </a>
                                ) : (
                                  <span className="ml-2 text-[10px] text-ink-faint">
                                    (sandbox · production swap streams to storage)
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-[10px] text-ink-faint">
                              Captured{" "}
                              {new Date(minute.capturedAt).toLocaleString()}
                              {" · "}routing: {minute.routing}
                            </p>
                            {minute.corrections.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                                  Corrections
                                </span>
                                <ul className="space-y-1">
                                  {minute.corrections.map((c) => (
                                    <li
                                      key={c.id}
                                      className="text-[11px] text-ink"
                                    >
                                      • {c.body}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <form
                              action={addMinuteCorrection}
                              className="mt-2 flex flex-wrap items-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="minuteId"
                                value={minute.id}
                              />
                              <input
                                name="body"
                                type="text"
                                placeholder="Add a correction…"
                                className="flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                              />
                              <button
                                type="submit"
                                className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[10px] hover:border-brand-magenta hover:text-brand-magenta"
                              >
                                Append
                              </button>
                            </form>
                          </div>
                        )}
                        <form
                          action={captureMeetingMinute}
                          className="mt-3 space-y-2"
                          encType="multipart/form-data"
                        >
                          <input type="hidden" name="meetingId" value={m.id} />
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                              Format
                            </span>
                            <select
                              name="format"
                              defaultValue={minute?.format ?? "notes"}
                              className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                            >
                              <option value="notes">Notes (typed)</option>
                              <option value="recording">Recording URL</option>
                              <option value="transcript_upload">
                                Transcript / summary upload
                              </option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                              Notes body (if Notes)
                            </span>
                            <textarea
                              name="body"
                              rows={3}
                              defaultValue={minute?.body ?? ""}
                              placeholder="What was decided. What's next. Who owns what."
                              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                              Recording URL (if Recording)
                            </span>
                            <input
                              name="recordingUrl"
                              type="url"
                              defaultValue={minute?.recordingUrl ?? ""}
                              placeholder="https://…"
                              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                              Transcript / summary file (if Upload — Otter,
                              Granola, Fireflies, Zoom transcript, etc.)
                            </span>
                            <input
                              name="transcriptFile"
                              type="file"
                              accept=".txt,.md,.docx,.doc,.pdf,.vtt,.srt,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="mt-1 block w-full text-[11px] text-ink-muted file:mr-3 file:rounded-full file:border file:border-[var(--surface-border)] file:bg-[var(--surface-inset)] file:px-3 file:py-1 file:text-[10px] file:font-medium file:text-ink"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                            style={{ backgroundColor: "#5070F0" }}
                          >
                            {minute ? "Replace" : "Capture"}
                          </button>
                        </form>
                      </details>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Book a peer Member */}
      <Card className="mt-6 border-[#5070F0]/40">
        <CardEyebrow>Book a peer</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          New Member-to-Member meeting
        </CardTitle>
        <p className="mt-2 text-sm text-ink-muted">
          Peer bookings are autonomous between Members. Pick a Member
          and a time; they confirm on their side. Internal meetings
          carry the minutes/recording requirement — capture after.
        </p>
        <form action={createPeerMeeting} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2 block">
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
          <label className="md:col-span-2 block">
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
              Member to book with
            </span>
            <select
              name="attendeeId"
              required
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Pick a peer
              </option>
              {memberPeers.map((p) => (
                <option key={p.id} value={p.id}>
                  {publicName(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Starts at
            </span>
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Ends at
            </span>
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Book peer meeting
            </button>
          </div>
        </form>
      </Card>

      {/* Weekly availability */}
      <Card className="mt-6">
        <CardEyebrow>Weekly availability</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          When you&apos;re bookable
        </CardTitle>
        {availability.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No availability windows set. Without any, peers can&apos;t
            see clean booking suggestions for you.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {availability.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>
                  <strong>{DAYS[a.dayOfWeek]}</strong> {fmtMinute(a.startMinute)}{" "}
                  → {fmtMinute(a.endMinute)}{" "}
                  <span className="text-[11px] text-ink-faint">
                    ({a.timezone})
                  </span>
                </span>
                <form action={removeAvailability}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-brand-magenta underline hover:opacity-80"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addAvailability} className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Day
            </span>
            <select
              name="dayOfWeek"
              required
              defaultValue="1"
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              {DAYS.map((d, idx) => (
                <option key={idx} value={idx}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Start (min)
            </span>
            <input
              name="startMinute"
              type="number"
              defaultValue={600}
              min={0}
              max={1440}
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              End (min)
            </span>
            <input
              name="endMinute"
              type="number"
              defaultValue={1020}
              min={0}
              max={1440}
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Timezone
            </span>
            <input
              name="timezone"
              type="text"
              defaultValue="America/New_York"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-4">
            <button
              type="submit"
              className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
            >
              Add window
            </button>
          </div>
        </form>
        <p className="mt-2 text-[10px] text-ink-faint">
          Minutes from midnight: 600 = 10:00 am, 1020 = 5:00 pm.
        </p>
      </Card>

      {/* One-off blocks */}
      <Card className="mt-6">
        <CardEyebrow>Blocks</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          Time you can&apos;t be booked
        </CardTitle>
        {blocks.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No blocks. Add focus blocks, travel, or personal time so
            peers don&apos;t book over them.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span>
                  <strong>{fmtDateTime(b.startsAt)}</strong> →{" "}
                  {fmtDateTime(b.endsAt)}
                  {b.reason && (
                    <span className="ml-2 text-[11px] text-ink-faint">
                      ({b.reason})
                    </span>
                  )}
                </span>
                <form action={removeBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-brand-magenta underline hover:opacity-80"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addBlock} className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="block md:col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Starts at
            </span>
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block md:col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Ends at
            </span>
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block md:col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">
              Reason (optional)
            </span>
            <input
              name="reason"
              type="text"
              placeholder="Focus block, travel, etc."
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
            >
              Add block
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
