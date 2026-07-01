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
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { epkForUser } from "@/lib/mock-data/artist-epk";
import { MOCK_MEETINGS, meetingById } from "@/lib/mock-data/calendar";
import {
  MOCK_INBOUND_SUBMISSIONS,
  pushInboundSubmission,
} from "@/lib/mock-data/inbound-submissions";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { CalendarMeeting, Notification, NotificationKind } from "@/lib/types";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function pushNotification(
  kind: NotificationKind,
  userId: string,
  title: string,
  body: string,
  href: string,
): void {
  const ntf: Notification = {
    id: newId(`ntf_${kind}`),
    userId,
    kind,
    title,
    body,
    href,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  MOCK_NOTIFICATIONS.push(ntf);
}

/**
 * Pick the FM agent for an EPK booking. In production, this comes from
 * the artist's `accountOwnerId` (admin-assigned) or falls back to a
 * round-robin among active admins. Sandbox: the first admin that exists.
 */
function pickAgent(): string {
  const admin = MOCK_USERS.find((u) => u.isAdmin);
  if (!admin) throw new Error("No admin available to route booking");
  return admin.id;
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

  const artist = MOCK_USERS.find((u) => u.id === artistId);
  if (!artist) throw new Error("Artist not found");
  const epk = epkForUser(artistId);
  if (!epk || epk.status !== "published") {
    throw new Error(
      "This artist doesn't have a published EPK and isn't accepting bookings through the cooperative.",
    );
  }

  const agentId = pickAgent();

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
  MOCK_MEETINGS.push(meeting);

  // Inbound submission so admin triages the brief alongside other
  // inbound. Status starts "new"; admin moves it through in_triage →
  // converted as they handle.
  pushInboundSubmission({
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

  // Notify all admins that a booking request landed.
  for (const admin of MOCK_USERS.filter((u) => u.isAdmin)) {
    pushNotification(
      "booking_request_received",
      admin.id,
      `Booking request for ${artist.firstName ?? artist.handle}`,
      `${requesterName}${requesterCompany ? ` (${requesterCompany})` : ""} submitted a booking request. Brief: ${brief.slice(0, 140)}${brief.length > 140 ? "…" : ""}`,
      "/admin/inbound",
    );
  }

  // Audit — booking requests come from unauthenticated visitors, so
  // actor is null/system. External requester identity is captured in
  // the meeting row + notification body (not in audit `after` to avoid
  // duplicating PII into the audit store; audit tracks the platform
  // event, not the requester profile).
  logAuditEvent({
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
  const submission = MOCK_INBOUND_SUBMISSIONS.find((s) => s.id === submissionId);
  if (!submission) throw new Error("Submission not found");
  if (submission.kind !== "booking_request") {
    throw new Error("This action is for booking requests only.");
  }
  if (!submission.linkedResourceId) {
    throw new Error(
      "Booking submission has no linked meeting — cannot route forward.",
    );
  }
  const meeting = meetingById(submission.linkedResourceId);
  if (!meeting) throw new Error("Linked meeting not found");

  // FM agent (the pmUserId) confirms; artist attendee still pending.
  if (meeting.pmUserId && !meeting.confirmedByAttendeeIds.includes(meeting.pmUserId)) {
    meeting.confirmedByAttendeeIds = [
      ...meeting.confirmedByAttendeeIds,
      meeting.pmUserId,
    ];
  }
  meeting.updatedAt = new Date().toISOString();

  submission.status = "converted";
  submission.updatedAt = new Date().toISOString();
  submission.triageNote =
    (submission.triageNote ?? "") +
    ` [Approved by admin ${admin.id} — forwarded to attendee for confirmation.]`;

  // Notify the artist attendee(s) — anyone in the meeting except the PM.
  for (const attendeeId of meeting.attendeeIds) {
    if (attendeeId === meeting.pmUserId) continue;
    pushNotification(
      "booking_request_approved",
      attendeeId,
      `Booking request forwarded to you`,
      `${meeting.externalClientName ?? "A client"} wants to meet. Admin reviewed the brief and forwarded for your confirmation. Confirm or decline from your calendar.`,
      "/profile/calendar",
    );
  }

  logAuditEvent({
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
  const submission = MOCK_INBOUND_SUBMISSIONS.find((s) => s.id === submissionId);
  if (!submission) throw new Error("Submission not found");
  if (submission.kind !== "booking_request") {
    throw new Error("This action is for booking requests only.");
  }

  if (submission.linkedResourceId) {
    const meeting = meetingById(submission.linkedResourceId);
    if (meeting && meeting.status !== "cancelled") {
      meeting.status = "cancelled";
      meeting.updatedAt = new Date().toISOString();
    }
  }
  submission.status = "closed_no_action";
  submission.triageNote =
    (submission.triageNote ?? "") +
    ` [Declined by admin ${admin.id}${reason ? `: ${reason}` : ""}]`;
  submission.updatedAt = new Date().toISOString();

  // Sandbox stub: notify admin pool as the audit trail. Production
  // dispatches a decline email to submission.submitterEmail with the
  // reason (or a generic decline copy if no reason provided).
  for (const a of MOCK_USERS.filter((u) => u.isAdmin)) {
    pushNotification(
      "booking_request_declined",
      a.id,
      `Booking declined: ${submission.submitter}`,
      `Booking request declined${reason ? `. Reason: ${reason}` : ""}. Production sends the decline email to ${submission.submitterEmail ?? "(no email on file)"}.`,
      "/admin/inbound",
    );
  }

  logAuditEvent({
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
  const me = (await import("@/lib/auth-stub").then((m) => m.getCurrentUser()));
  if (!me) throw new Error("Sign in required");
  const meetingId = String(formData.get("id") ?? "").trim();
  const meeting = meetingById(meetingId);
  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.attendeeIds.includes(me.id)) {
    throw new Error("You're not an attendee on this meeting.");
  }
  if (!meeting.confirmedByAttendeeIds.includes(me.id)) {
    meeting.confirmedByAttendeeIds = [...meeting.confirmedByAttendeeIds, me.id];
  }
  const allConfirmed = meeting.attendeeIds.every((a) =>
    meeting.confirmedByAttendeeIds.includes(a),
  );
  if (allConfirmed) meeting.status = "confirmed";
  meeting.updatedAt = new Date().toISOString();

  // Notify admin pool + queue external email stub only when this is a
  // booking-shape meeting (external_client with a linked inbound row).
  if (meeting.kind === "external_client" && meeting.externalClientEmail) {
    for (const a of MOCK_USERS.filter((u) => u.isAdmin)) {
      pushNotification(
        "booking_confirmed",
        a.id,
        `Booking confirmed with ${meeting.externalClientName ?? "client"}`,
        `${meeting.title} — production dispatches confirmation email to ${meeting.externalClientEmail}.`,
        "/admin/inbound",
      );
    }
  }

  logAuditEvent({
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

void MOCK_MEETINGS;
void MOCK_USERS;
