/**
 * Admin: team-meetings log.
 *
 * Cooperative-internal browse view of every captured meeting minute,
 * grouped by routing (project_scoped / team_governance / peer_one_on_one).
 * Carries the rolling institutional memory of cooperative decisions.
 *
 * Locked posture: Member-to-Member meetings require minutes or
 * recording; this surface is how admin verifies the practice is
 * actually happening + can search the record when something needs
 * looking up.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { meetingReader, minutesReader, safely } from "@/lib/readers";
import {
  MEETING_MINUTE_FORMAT_LABELS,
  MEETING_MINUTE_ROUTING_LABELS,
  publicName,
  type MeetingMinute,
  type MeetingMinuteRouting,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

const ROUTING_ORDER: MeetingMinuteRouting[] = [
  "team_governance",
  "project_scoped",
  "peer_one_on_one",
];

export default async function AdminTeamMeetingsPage() {
  await requireAdmin();

  // Minutes, the meetings they belong to, and the roster that names
  // the capturer and attendees. Loaded together — the meeting lookup
  // below was a synchronous fixture scan, so doing it per row would
  // now be one query per minute.
  const [minutes, meetings, { users: roster }] = await Promise.all([
    safely(() => minutesReader.all(), []),
    safely(() => meetingReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const meetingById = (id: string) =>
    meetings.find((m) => m.id === id) ?? null;

  const minutesByRouting: Record<MeetingMinuteRouting, MeetingMinute[]> = {
    project_scoped: [],
    team_governance: [],
    peer_one_on_one: [],
  };
  for (const m of minutes) {
    minutesByRouting[m.routing].push(m);
  }
  for (const k of ROUTING_ORDER) {
    minutesByRouting[k].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Team meetings · minutes log
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Every captured meeting minute, grouped by routing. The
        cooperative&apos;s rolling institutional memory — anything
        decided in a meeting between Members should be findable here.
      </p>

      {ROUTING_ORDER.map((routing) => {
        const rows = minutesByRouting[routing];
        return (
          <section key={routing} className="mt-10">
            <h2 className="font-display text-2xl font-semibold">
              {MEETING_MINUTE_ROUTING_LABELS[routing]}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {rows.length} on file.
            </p>
            {rows.length === 0 ? (
              <Card className="mt-3">
                <p className="text-sm text-ink-muted">
                  No minutes captured under this routing yet.
                </p>
              </Card>
            ) : (
              <ul className="mt-4 space-y-3">
                {rows.map((min) => {
                  const meeting = meetingById(min.meetingId);
                  const capturer = roster.find(
                    (u) => u.id === min.capturedByUserId,
                  );
                  return (
                    <Card key={min.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <CardEyebrow>
                            {MEETING_MINUTE_FORMAT_LABELS[min.format]}
                          </CardEyebrow>
                          <CardTitle className="mt-1 text-lg">
                            {meeting ? meeting.title : "(meeting deleted)"}
                          </CardTitle>
                        </div>
                        <span className="text-[11px] text-ink-faint">
                          Captured{" "}
                          {new Date(min.capturedAt).toLocaleDateString()}
                          {capturer && (
                            <>
                              {" "}
                              by {publicName(capturer)}
                            </>
                          )}
                        </span>
                      </div>
                      {meeting && (
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {new Date(meeting.startsAt).toLocaleString()} ·{" "}
                          {meeting.attendeeIds
                            .map((a) => roster.find((u) => u.id === a))
                            .filter(Boolean)
                            .map((u) => publicName(u!))
                            .join(", ")}
                        </p>
                      )}
                      {min.format === "notes" && (
                        <p className="mt-3 whitespace-pre-line text-sm text-ink">
                          {min.body}
                        </p>
                      )}
                      {min.format === "recording" && (
                        <a
                          href={min.recordingUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-sm text-brand-magentaText underline"
                        >
                          Recording ↗
                        </a>
                      )}
                      {min.format === "transcript_upload" && min.uploadedFile && (
                        <div className="mt-3 rounded-lg border border-[var(--surface-border)] p-3 text-sm">
                          <strong>{min.uploadedFile.name}</strong>{" "}
                          <span className="text-ink-faint">
                            ({Math.round(min.uploadedFile.size / 1024)} kB
                            {min.uploadedFile.type
                              ? ` · ${min.uploadedFile.type}`
                              : ""})
                          </span>
                          {min.uploadedFile.url ? (
                            <a
                              href={min.uploadedFile.url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-brand-magentaText underline"
                            >
                              Open ↗
                            </a>
                          ) : (
                            <span className="ml-2 text-[11px] text-ink-faint">
                              (sandbox metadata · production swap pulls
                              from object storage)
                            </span>
                          )}
                        </div>
                      )}
                      {min.corrections.length > 0 && (
                        <div className="mt-3 rounded-lg bg-[var(--surface)] p-3 text-xs">
                          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                            Corrections ({min.corrections.length})
                          </span>
                          <ul className="mt-2 space-y-1">
                            {min.corrections.map((c) => {
                              const author = roster.find(
                                (u) => u.id === c.byUserId,
                              );
                              return (
                                <li key={c.id}>
                                  • {c.body}{" "}
                                  <span className="text-[10px] text-ink-faint">
                                    —{" "}
                                    {author
                                      ? publicName(author)
                                      : c.byUserId}
                                    ,{" "}
                                    {new Date(c.addedAt).toLocaleDateString()}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
