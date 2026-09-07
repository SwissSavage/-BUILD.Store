/**
 * EPK calendar booking flow.
 *
 * Locked three-step posture (`future-modern.md`):
 *   1. Requester picks slot from EPK, provides brief + contact, submits.
 *      Lands in /admin/inbound as a `booking_request`.
 *      A pending external_client meeting gets created with the FM agent
 *      (defaults to the artist's account-owning admin, or the first
 *      admin available) as the PM in the loop.
 *   2. Admin reviews the brief in /admin/inbound; approve via the
 *      inbound triage actions, or decline.
 *   3. On admin approve (status flips to "in_triage" → "converted"),
 *      the meeting carries forward; the artist sees it on their
 *      /profile/calendar and confirms or declines via the standard
 *      calendar flow.
 *
 * Sandbox: this action is public — any visitor can request a booking
 * since EPKs are public artifacts. Anti-spam and rate-limiting layer at
 * production via Cloudflare + the inbound queue.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-07)
 *
 * Everything in this file except the inbound submission ran against
 * fixtures. The artist lookup and the admin fan-out scanned the seed
 * array, the EPK status check read the seed EPK list, and the meeting
 * was pushed onto an in-memory array that calendar-actions.ts stopped
 * reading when the calendar moved to Postgres. So: a real artist could
 * not be booked at all (the lookup threw), a seed artist could be
 * "booked" into a meeting that appeared on nobody's calendar, and the
 * approve and decline paths mutated reader output that was discarded on
 * return.
 *
 * Meetings now go through calendarMeetings and the submission through
 * updateInboundSubmission, which is the same rail calendar-actions.ts
 * and the inbound triage actions already use. That matters more than
 * the individual fixes: there is now one writer per table, so these
 * actions and the calendar cannot disagree about the state of a
 * meeting.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarMeetings } from "@/db/schema";
import { requireAdmin, getCurrentUser } from "@/lib/auth-stub";
import { getUserById, getAdminUsers } from "@/lib/readers/users";
import { getEpk, meetingReader } from "@/lib/readers";
import { confirmMeeting } from "@/lib/calendar-actions";
import {
  getStoredSubmission,
  updateInboundSubmission,
} from "@/lib/writers/inbound-submissions-update";
import { insertInboundSubmission } from "@/lib/writers/inbound-submissions";
import { notifyMany } from "@/lib/writers/notifications";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { CalendarMeeting } from "@/lib/types";

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/**
 * Every admin, for the "tell the admin pool" fan-outs below.
 *
 * These used to filter the seed array, which is the quiet half of this
 * bug: the fan-out succeeded and notified accounts that do not exist,
 * so a booking request landed in the queue and nobody was told.
 */
async function adminIds(): Promise<string[]> {
  const { users } = await getAdminUsers();
  return users.map((u) => u.id);
}

/**
 * Pick the FM agent for an EPK booking. In production this comes from
 * the artist's `accountOwnerId` (admin-assigned) or falls back to a
 * round-robin among active admins. Today: the longest-standing admin,
 * sorted rather than taken off the top of the reader, because the
 * reader returns newest-first and the newest admin should not silently
 * become the default PM on every booking the moment they are promoted.
 */
async function pickAgent(): Promise<string> {
  const { users } = await getAdminUsers();
  const [agent] = [...users].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!agent) throw new Error("No admin available to route booking");
  return agent.id;
}

export async function createEpkBookingRequest(formData: FormData) {
  const artistId = String(formData.get("artistId") ?? "").trim();
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const requesterEmail = String(formData.get("requesterEmail") ?? "").trim();
  const requesterCompany = String(
    formData.get("requesterCompany") ?? "",
  ).trim();
  const brief = String(formData.get("brief") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();

  if (!artistId) throw new Error("Artist is required.");
  if (!requesterName || !requesterEmail) {
    throw new Error("Your name and email are required.");
  }
  if (brief.length < 30) {
    throw new Error(
      "Tell us about the engagement (≥ 30 chars). FM's agent reviews the brief before routing.",
    );
  }
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new Error("Pick a start and end time (end must be after start).");
  }

  const artist = await getUserById(artistId);
  if (!artist) throw new Error("Artist not found");
  const epk = await getEpk(artistId);
  if (!epk || epk.status !== "published") {
    throw new Error(
      "This artist doesn't have a published EPK and isn't accepting bookings through the cooperative.",
    );
  }

  const agentId = await pickAgent();

  // Tentative external_client meeting on FM agent's calendar — artist
  // included as attendee. Status stays pending; admin approval routes it
  // forward, artist confirmation moves it to confirmed.
  const meeting: CalendarMeeting = {
    id: newId("mt"),
    title: `Booking request — ${requesterName}${requesterCompany ? ` (${requesterCompany})` : ""}`,
    description: brief,
    startsAt,
    endsAt,
    kind: "external_client",
    organizerId: agentId,
    attendeeIds: [agentId, artistId],
    confirmedByAttendeeIds: [],
    status: "pending",
    externalClientName: requesterName,
    externalClientEmail: requesterEmail,
    projectId: null,
    pmUserId: agentId,
    notesPreview: null,
    recordingUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.insert(calendarMeetings).values({
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    kind: meeting.kind,
    organizerId: meeting.organizerId,
    attendeeIds: meeting.attendeeIds,
    confirmedByAttendeeIds: meeting.confirmedByAttendeeIds,
    status: meeting.status,
    externalClientName: meeting.externalClientName,
    externalClientEmail: meeting.externalClientEmail,
    projectId: meeting.projectId,
    pmUserId: meeting.pmUserId,
    notesPreview: meeting.notesPreview,
    recordingUrl: meeting.recordingUrl,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  });

  // Inbound submission so admin triages the brief alongside other
  // inbound. Status starts "new"; admin moves it through in_triage →
  // converted as they handle.
  try {
    await insertInboundSubmission({
      kind: "booking_request",
      status: "new",
      title: `Booking request for ${artist.firstName ?? artist.handle} from ${requesterName}`,
      submitter: requesterName,
      submitterEmail: requesterEmail || null,
      submitterCompany: requesterCompany || null,
      pillarTags: artist.primaryIndustry ? [artist.primaryIndustry] : [],
      keywordTags: artist.skills ?? [],
      body: brief + `\n\nProposed slot: ${startsAt} → ${endsAt}`,
      attachments: [],
      assignedAdminId: agentId,
      triageNote: `Tentative meeting created. Approve to forward to ${artist.firstName ?? artist.handle} for confirmation; decline to reject the brief.`,
      deepLinkHref: "/admin/team-meetings",
      linkedResourceId: meeting.id,
      derived: false,
    });
  } catch (err) {
    // The triage row is what makes this meeting reviewable. Without it
    // the meeting is an orphan on an admin calendar that no one can
    // approve or decline, so undo it and fail loudly rather than leave
    // a pending booking nobody can act on.
    await db.delete(calendarMeetings).where(eq(calendarMeetings.id, meeting.id));
    throw err;
  }

  // Notify all admins that a booking request landed.
  await notifyMany(await adminIds(), {
    kind: "booking_request_received",
    title: `Booking request for ${artist.firstName ?? artist.handle}`,
    body: `${requesterName}${requesterCompany ? ` (${requesterCompany})` : ""} submitted a booking request. Brief: ${brief.slice(0, 140)}${brief.length > 140 ? "…" : ""}`,
    href: "/admin/inbound",
  });

  // Audit — booking requests come from unauthenticated visitors, so
  // actor is null/system. External requester identity is captured in
  // the meeting row + notification body (not in audit `after` to avoid
  // duplicating PII into the audit store; audit tracks the platform
  // event, not the requester profile).
  await logAuditEvent({
    actorUserId: null,
    actorRoleSnapshot: "system",
    action: "booking.request_created",
    resourceKind: "booking",
    resourceId: meeting.id,
    before: null,
    after: {
      artistId,
      agentId,
      startsAt,
      endsAt,
      briefLength: brief.length,
    },
  });

  revalidatePath(`/u/${artist.handle}`);
  revalidatePath("/admin/inbound");
  revalidatePath("/profile/calendar");
  revalidatePath("/notifications");
}

/**
 * Admin approves a booking_request. Marks the inbound row `converted`
 * + updates the associated meeting so the FM agent (organizer) is
 * confirmed. Artist still needs to confirm on their calendar surface
 * for the meeting to reach fully-confirmed state.
 */
export async function approveBookingRequest(formData: FormData) {
  const admin = await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  // Reader swap 2026-09-03. Booking requests were moved to Postgres
  // on 09-02 by createEpkBookingRequest, but these two actions kept
  // looking them up in the fixture array, so approving or declining a
  // real booking request answered "Submission not found".
  const submission = await getStoredSubmission(submissionId);
  if (!submission) throw new Error("Submission not found");
  if (submission.kind !== "booking_request") {
    throw new Error("This action is for booking requests only.");
  }
  if (!submission.linkedResourceId) {
    throw new Error(
      "Booking submission has no linked meeting — cannot route forward.",
    );
  }
  const meeting = await meetingReader.byId(submission.linkedResourceId);
  if (!meeting) throw new Error("Linked meeting not found");

  // FM agent (the pmUserId) confirms; artist attendee still pending.
  const confirmedBy =
    meeting.pmUserId && !meeting.confirmedByAttendeeIds.includes(meeting.pmUserId)
      ? [...meeting.confirmedByAttendeeIds, meeting.pmUserId]
      : meeting.confirmedByAttendeeIds;
  await db
    .update(calendarMeetings)
    .set({
      confirmedByAttendeeIds: confirmedBy,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(calendarMeetings.id, meeting.id));

  await updateInboundSubmission(submission.id, {
    status: "converted",
    triageNote:
      (submission.triageNote ?? "") +
      ` [Approved by admin ${admin.id} — forwarded to attendee for confirmation.]`,
  });

  // Notify the artist attendee(s) — anyone in the meeting except the PM.
  await notifyMany(
    meeting.attendeeIds.filter((id) => id !== meeting.pmUserId),
    {
      kind: "booking_request_approved",
      title: `Booking request forwarded to you`,
      body: `${meeting.externalClientName ?? "A client"} wants to meet. Admin reviewed the brief and forwarded for your confirmation. Confirm or decline from your calendar.`,
      href: "/profile/calendar",
    },
  );

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "booking.request_approved",
    resourceKind: "booking",
    resourceId: meeting.id,
    before: { status: "pending" },
    after: {
      status: meeting.status,
      confirmedByPm: true,
      awaitingAttendeeConfirmation: true,
    },
  });

  revalidatePath("/admin/inbound");
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
  revalidatePath("/notifications");
}

/**
 * Admin declines a booking_request. Cancels the tentative meeting and
 * marks the submission closed_no_action. Sandbox stub: production
 * would fire a decline email to the external requester's address; we
 * log a notification to admins as the audit trail.
 */
export async function declineBookingRequest(formData: FormData) {
  const admin = await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  // Reader swap 2026-09-03. Booking requests were moved to Postgres
  // on 09-02 by createEpkBookingRequest, but these two actions kept
  // looking them up in the fixture array, so approving or declining a
  // real booking request answered "Submission not found".
  const submission = await getStoredSubmission(submissionId);
  if (!submission) throw new Error("Submission not found");
  if (submission.kind !== "booking_request") {
    throw new Error("This action is for booking requests only.");
  }

  if (submission.linkedResourceId) {
    // Guarded on the meeting not already being cancelled so a double
    // decline does not rewrite updatedAt on a settled row.
    await db
      .update(calendarMeetings)
      .set({ status: "cancelled", updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(calendarMeetings.id, submission.linkedResourceId),
          ne(calendarMeetings.status, "cancelled"),
        )!,
      );
  }
  await updateInboundSubmission(submission.id, {
    status: "closed_no_action",
    triageNote:
      (submission.triageNote ?? "") +
      ` [Declined by admin ${admin.id}${reason ? `: ${reason}` : ""}]`,
  });

  // Sandbox stub: notify admin pool as the audit trail. Production
  // dispatches a decline email to submission.submitterEmail with the
  // reason (or a generic decline copy if no reason provided).
  await notifyMany(await adminIds(), {
    kind: "booking_request_declined",
    title: `Booking declined: ${submission.submitter}`,
    body: `Booking request declined${reason ? `. Reason: ${reason}` : ""}. Production sends the decline email to ${submission.submitterEmail ?? "(no email on file)"}.`,
    href: "/admin/inbound",
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "booking.request_declined",
    resourceKind: "booking",
    resourceId: submission.linkedResourceId ?? submission.id,
    before: { status: "pending" },
    after: { status: "cancelled" },
    reason: reason || null,
  });

  revalidatePath("/admin/inbound");
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
  revalidatePath("/notifications");
}

/**
 * Wraps `confirmMeeting` from `calendar-actions.ts` with a booking-
 * flow notification: when the artist confirms a booking meeting, fire
 * a `booking_confirmed` notification to the admin pool + queue an
 * external requester email (sandbox stub). Callers that want the
 * generic confirm behavior for non-booking meetings should still use
 * `confirmMeeting` directly.
 */
export async function confirmBookingMeeting(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const meetingId = String(formData.get("id") ?? "").trim();

  // Actually delegate now. This used to re-implement confirmMeeting
  // against the fixture array, which is how the two drifted: the
  // calendar wrote to Postgres and the booking flow wrote to memory, so
  // an artist who confirmed from the booking surface stayed pending on
  // the calendar. The attendee guard and the all-confirmed transition
  // live in confirmMeeting; this function is the notification wrapper
  // its own docstring says it is.
  await confirmMeeting(formData);

  const meeting = await meetingReader.byId(meetingId);
  if (!meeting) throw new Error("Meeting not found");
  const allConfirmed = meeting.status === "confirmed";

  // Notify admin pool + queue external email stub only when this is a
  // booking-shape meeting (external_client with a linked inbound row).
  if (meeting.kind === "external_client" && meeting.externalClientEmail) {
    await notifyMany(await adminIds(), {
      kind: "booking_confirmed",
      title: `Booking confirmed with ${meeting.externalClientName ?? "client"}`,
      body: `${meeting.title} — production dispatches confirmation email to ${meeting.externalClientEmail}.`,
      href: "/admin/inbound",
    });
  }

  await logAuditEvent({
    actorUserId: me.id,
    actorRoleSnapshot: snapshotActorRole(me),
    action: allConfirmed ? "booking.confirmed" : "booking.request_approved",
    resourceKind: "booking",
    resourceId: meeting.id,
    before: null,
    after: {
      status: meeting.status,
      confirmedAttendeeCount: meeting.confirmedByAttendeeIds.length,
      totalAttendees: meeting.attendeeIds.length,
    },
  });

  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
  revalidatePath("/notifications");
}
