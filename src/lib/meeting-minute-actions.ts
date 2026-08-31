/**
 * Meeting minutes / recording rail — server actions.
 *
 * captureMeetingMinute  : attendee captures notes OR a recording URL.
 *                        Routing is derived from the meeting context
 *                        (project_scoped if projectId set; team_governance
 *                        if kind === "team_governance"; otherwise
 *                        peer_one_on_one).
 * addMinuteCorrection   : other attendees append corrections.
 * editMyMinute          : capturer edits the body (only the capturer or
 *                        admin can replace; corrections come from peers).
 *
 * Locked posture: every internal Member-to-Member meeting requires
 * minutes or a recording. External-client meetings can capture but
 * aren't strictly required (the brief lives elsewhere).
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingMinutes } from "@/db/schema";
import { meetingReader, minutesReader } from "@/lib/readers";
import type {
  MeetingMinute,
  MeetingMinuteFormat,
  MeetingMinuteRouting,
} from "@/lib/types";

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function routingFor(
  meeting: Awaited<ReturnType<typeof meetingReader.byId>>,
): MeetingMinuteRouting {
  if (!meeting) return "peer_one_on_one";
  if (meeting.projectId) return "project_scoped";
  if (meeting.kind === "team_governance") return "team_governance";
  return "peer_one_on_one";
}

export async function captureMeetingMinute(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const format = String(formData.get("format") ?? "notes") as MeetingMinuteFormat;
  const body = String(formData.get("body") ?? "").trim();
  const recordingUrl = String(formData.get("recordingUrl") ?? "").trim();
  const uploaded = formData.get("transcriptFile");

  const meeting = await meetingReader.byId(meetingId);
  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.attendeeIds.includes(me.id) && !me.isAdmin) {
    throw new Error("Only attendees (or admin) can capture minutes.");
  }
  if (
    format !== "notes" &&
    format !== "recording" &&
    format !== "transcript_upload"
  ) {
    throw new Error(
      "Format must be 'notes', 'recording', or 'transcript_upload'.",
    );
  }
  if (format === "notes" && body.length < 10) {
    throw new Error("Notes body must be at least 10 characters.");
  }
  if (format === "recording" && recordingUrl.length < 5) {
    throw new Error("Recording URL is required when format is 'recording'.");
  }

  let uploadedFile: MeetingMinute["uploadedFile"] = null;
  if (format === "transcript_upload") {
    if (!(uploaded instanceof File) || uploaded.size === 0) {
      throw new Error(
        "Upload a transcript / summary file when format is 'transcript_upload'.",
      );
    }
    uploadedFile = {
      name: uploaded.name,
      size: uploaded.size,
      type: uploaded.type,
      url: null, // sandbox metadata only; production streams bytes to storage
    };
  }

  // One minute row per meeting. Replacing re-captures (capturer can
  // change format or replace body); corrections come from peers.
  const existing = await minutesReader.one(
    eq(meetingMinutes.meetingId, meetingId),
  );
  if (existing) {
    existing.format = format;
    existing.body = format === "notes" ? body : null;
    existing.recordingUrl = format === "recording" ? recordingUrl : null;
    existing.uploadedFile =
      format === "transcript_upload" ? uploadedFile : null;
    existing.updatedAt = new Date().toISOString();
    revalidatePath("/profile/calendar");
    revalidatePath("/admin/team-meetings");
    return;
  }

  const row: MeetingMinute = {
    id: newId("min"),
    meetingId,
    format,
    routing: routingFor(meeting),
    body: format === "notes" ? body : null,
    recordingUrl: format === "recording" ? recordingUrl : null,
    uploadedFile,
    capturedByUserId: me.id,
    corrections: [],
    capturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.insert(meetingMinutes).values({
    id: row.id,
    meetingId: row.meetingId,
    format: row.format,
    routing: row.routing,
    body: row.body,
    recordingUrl: row.recordingUrl,
    uploadedFile: row.uploadedFile,
    capturedByUserId: row.capturedByUserId,
    corrections: row.corrections,
    capturedAt: row.capturedAt,
    updatedAt: row.updatedAt,
  });
  revalidatePath("/profile/calendar");
  revalidatePath("/admin/team-meetings");
}

export async function addMinuteCorrection(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const minuteId = String(formData.get("minuteId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 5) {
    throw new Error("Correction must be at least 5 characters.");
  }
  const minute = await minutesReader.byId(minuteId);
  if (!minute) throw new Error("Minute not found");
  const meeting = await meetingReader.byId(minute.meetingId);
  if (!meeting || !meeting.attendeeIds.includes(me.id)) {
    throw new Error("Only attendees can append corrections.");
  }
  // Corrections are append-only — a minute is a record of what was
  // said, and an attendee disputing it adds to that record rather
  // than editing it.
  const corrections = [
    ...minute.corrections,
    {
      id: newId("cor"),
      byUserId: me.id,
      body,
      addedAt: new Date().toISOString(),
    },
  ];
  await db
    .update(meetingMinutes)
    .set({ corrections, updatedAt: new Date().toISOString() })
    .where(eq(meetingMinutes.id, minuteId));
  revalidatePath("/profile/calendar");
  revalidatePath("/admin/team-meetings");
}
