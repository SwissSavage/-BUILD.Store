/**
 * Shared cooperative calendar — server actions.
 *
 * Member-side actions:
 *   - addAvailability    : Member declares a weekly recurring window.
 *   - removeAvailability : Member removes a recurring window.
 *   - addBlock           : Member blocks a one-off range.
 *   - removeBlock        : Member removes a block.
 *   - createPeerMeeting  : Member books another Member (peer_internal).
 *   - confirmMeeting     : Attendee accepts a pending meeting.
 *   - declineMeeting     : Attendee declines a pending meeting.
 *   - cancelMeeting      : Organizer cancels.
 *   - addMeetingNotes    : Post-meeting notes (sandbox stub for minutes rail).
 *
 * Admin-side action:
 *   - createExternalClientMeeting : FM agent (admin) creates an external
 *                                   client meeting on a Member's behalf;
 *                                   the FM agent is set as `pmUserId`.
 *
 * Locked posture: peer_internal meetings allowed only between Members
 * (membershipTier === "member"). Partners receive external client
 * meetings only — they don't appear as bookable on the shared calendar.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  calendarAvailability,
  calendarBlocks,
  calendarMeetings,
} from "@/db/schema";
import { getUserById } from "@/lib/readers/users";
import { meetingReader } from "@/lib/readers";
import type {
  CalendarAvailability,
  CalendarBlock,
  CalendarMeeting,
} from "@/lib/types";

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

async function ensureMember(userId: string): Promise<void> {
  // Real lookup. The fixture scan threw "User not found" for every
  // member who signed up through the live flow, so the shared calendar
  // was unusable by anyone real.
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.membershipTier !== "member") {
    throw new Error(
      "Only Members can use the shared cooperative calendar. Partners route through the FM agent layer.",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Availability + blocks                                              */
/* ------------------------------------------------------------------ */

export async function addAvailability(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  await ensureMember(me.id);

  const dayOfWeek = Number(formData.get("dayOfWeek") ?? -1);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Day of week must be 0-6 (Sunday=0).");
  }
  const startMinute = Number(formData.get("startMinute") ?? -1);
  const endMinute = Number(formData.get("endMinute") ?? -1);
  if (
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endMinute) ||
    startMinute < 0 ||
    endMinute <= startMinute
  ) {
    throw new Error("Start and end times must be valid; end > start.");
  }
  const timezone = String(formData.get("timezone") ?? "UTC");

  const row: CalendarAvailability = {
    id: newId("av"),
    userId: me.id,
    dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    startMinute,
    endMinute,
    timezone,
    createdAt: new Date().toISOString(),
  };
  await db.insert(calendarAvailability).values({
    id: row.id,
    userId: row.userId,
    dayOfWeek: row.dayOfWeek,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    timezone: row.timezone,
    createdAt: row.createdAt,
  });
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function removeAvailability(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "").trim();
  // Scoped to the caller's own row — the id alone must not be enough
  // to delete somebody else's availability.
  const removed = await db
    .delete(calendarAvailability)
    .where(
      and(
        eq(calendarAvailability.id, id),
        eq(calendarAvailability.userId, me.id),
      ),
    )
    .returning({ id: calendarAvailability.id });
  if (removed.length === 0) throw new Error("Availability row not found");
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function addBlock(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  await ensureMember(me.id);

  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!startsAt || !endsAt) {
    throw new Error("Start and end timestamps are required.");
  }
  if (endsAt <= startsAt) {
    throw new Error("Block end must be after start.");
  }
  const row: CalendarBlock = {
    id: newId("blk"),
    userId: me.id,
    startsAt,
    endsAt,
    reason: reason.length === 0 ? null : reason,
    createdAt: new Date().toISOString(),
  };
  await db.insert(calendarBlocks).values({
    id: row.id,
    userId: row.userId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    reason: row.reason,
    createdAt: row.createdAt,
  });
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function removeBlock(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "").trim();
  const removed = await db
    .delete(calendarBlocks)
    .where(and(eq(calendarBlocks.id, id), eq(calendarBlocks.userId, me.id)))
    .returning({ id: calendarBlocks.id });
  if (removed.length === 0) throw new Error("Block not found");
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

/* ------------------------------------------------------------------ */
/*  Meetings                                                           */
/* ------------------------------------------------------------------ */

export async function createPeerMeeting(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  await ensureMember(me.id);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const otherAttendeeId = String(formData.get("attendeeId") ?? "").trim();

  if (!title) throw new Error("Title is required.");
  if (!startsAt || !endsAt) {
    throw new Error("Start and end timestamps are required.");
  }
  if (endsAt <= startsAt) {
    throw new Error("Meeting end must be after start.");
  }
  if (!otherAttendeeId || otherAttendeeId === me.id) {
    throw new Error("Pick a Member to book with (not yourself).");
  }
  await ensureMember(otherAttendeeId);

  const row: CalendarMeeting = {
    id: newId("mt"),
    title,
    description: description.length === 0 ? null : description,
    startsAt,
    endsAt,
    kind: "peer_internal",
    organizerId: me.id,
    attendeeIds: [me.id, otherAttendeeId],
    confirmedByAttendeeIds: [me.id], // organizer auto-confirms
    status: "pending",
    externalClientName: null,
    externalClientEmail: null,
    projectId: null,
    pmUserId: null,
    notesPreview: null,
    recordingUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.insert(calendarMeetings).values({
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    kind: row.kind,
    organizerId: row.organizerId,
    attendeeIds: row.attendeeIds,
    confirmedByAttendeeIds: row.confirmedByAttendeeIds,
    status: row.status,
    externalClientName: row.externalClientName,
    externalClientEmail: row.externalClientEmail,
    projectId: row.projectId,
    pmUserId: row.pmUserId,
    notesPreview: row.notesPreview,
    recordingUrl: row.recordingUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function createExternalClientMeeting(formData: FormData) {
  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const externalClientName = String(
    formData.get("externalClientName") ?? "",
  ).trim();
  const externalClientEmail = String(
    formData.get("externalClientEmail") ?? "",
  ).trim();
  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const attendeeIdsRaw = formData.getAll("attendeeIds").map(String);

  if (!title || !startsAt || !endsAt || !externalClientName) {
    throw new Error(
      "Title, start, end, and external client name are required.",
    );
  }
  if (endsAt <= startsAt) {
    throw new Error("Meeting end must be after start.");
  }
  if (attendeeIdsRaw.length === 0) {
    throw new Error("At least one cooperative attendee is required.");
  }
  // PM (the FM agent) is automatically the admin running the action.
  const attendeeIds = Array.from(new Set([admin.id, ...attendeeIdsRaw]));

  const row: CalendarMeeting = {
    id: newId("mt"),
    title,
    description: description.length === 0 ? null : description,
    startsAt,
    endsAt,
    kind: "external_client",
    organizerId: admin.id,
    attendeeIds,
    confirmedByAttendeeIds: [admin.id],
    status: "pending",
    externalClientName,
    externalClientEmail: externalClientEmail.length === 0 ? null : externalClientEmail,
    projectId,
    pmUserId: admin.id,
    notesPreview: null,
    recordingUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.insert(calendarMeetings).values({
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    kind: row.kind,
    organizerId: row.organizerId,
    attendeeIds: row.attendeeIds,
    confirmedByAttendeeIds: row.confirmedByAttendeeIds,
    status: row.status,
    externalClientName: row.externalClientName,
    externalClientEmail: row.externalClientEmail,
    projectId: row.projectId,
    pmUserId: row.pmUserId,
    notesPreview: row.notesPreview,
    recordingUrl: row.recordingUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

export async function confirmMeeting(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "").trim();
  const meeting = await meetingReader.byId(id);
  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.attendeeIds.includes(me.id)) {
    throw new Error("You're not an attendee on this meeting.");
  }
  const confirmedBy = meeting.confirmedByAttendeeIds.includes(me.id)
    ? meeting.confirmedByAttendeeIds
    : [...meeting.confirmedByAttendeeIds, me.id];
  // Once every attendee has confirmed, the meeting flips to confirmed.
  const allConfirmed = meeting.attendeeIds.every((a) =>
    confirmedBy.includes(a),
  );
  await db
    .update(calendarMeetings)
    .set({
      confirmedByAttendeeIds: confirmedBy,
      ...(allConfirmed ? { status: "confirmed" as const } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(calendarMeetings.id, id));
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function declineMeeting(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "").trim();
  const meeting = await meetingReader.byId(id);
  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.attendeeIds.includes(me.id)) {
    throw new Error("You're not an attendee on this meeting.");
  }
  await db
    .update(calendarMeetings)
    .set({ status: "declined", updatedAt: new Date().toISOString() })
    .where(eq(calendarMeetings.id, id));
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function cancelMeeting(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "").trim();
  const meeting = await meetingReader.byId(id);
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.organizerId !== me.id && !me.isAdmin) {
    throw new Error("Only the organizer (or admin) can cancel a meeting.");
  }
  await db
    .update(calendarMeetings)
    .set({ status: "cancelled", updatedAt: new Date().toISOString() })
    .where(eq(calendarMeetings.id, id));
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}

export async function addMeetingNotes(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const meeting = await meetingReader.byId(id);
  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.attendeeIds.includes(me.id) && !me.isAdmin) {
    throw new Error("Only attendees (or admin) can add notes.");
  }
  meeting.notesPreview = notes.length === 0 ? null : notes;
  meeting.updatedAt = new Date().toISOString();
  revalidatePath("/profile/calendar");
  revalidatePath("/calendar");
}
