/**
 * Job posting admin actions.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-09-01)
 *
 * `/jobs` and `/jobs/[id]` have shipped since July and members can
 * apply to a posting — job_applications has a working insert and an
 * admin triage queue at /admin/jobs/applications.
 *
 * There was no way to create a job. Not in the admin console, not
 * anywhere. The only rows that ever existed came from the seed file,
 * so the public jobs board could only ever show fixtures and the
 * application queue could only ever receive applications against
 * fixtures.
 *
 * A surface that can be applied to but not posted to is a gap, not a
 * feature in progress.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { jobReader } from "@/lib/readers";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { adminName, type Industry } from "@/lib/types";

const INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];
const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract-to-hire",
] as const;
const STATUSES = ["open", "filled", "closed"] as const;

type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
type JobStatus = (typeof STATUSES)[number];

function revalidateJobSurfaces(id?: string): void {
  revalidatePath("/jobs");
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  if (id) revalidatePath(`/jobs/${id}`);
}

/**
 * Create or update a posting.
 *
 * `postedByLabel` is what renders publicly. It defaults to the
 * cooperative rather than the admin's name — a job posted by Future
 * Modern is posted by the cooperative, and an admin's personal name
 * on a public listing is a privacy leak nobody asked for.
 */
export async function upsertJob(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const industryRaw = String(formData.get("industry") ?? "").trim();
  const compensation = String(formData.get("compensation") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const employmentRaw = String(formData.get("employmentType") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "open").trim();
  const postedByLabel =
    String(formData.get("postedByLabel") ?? "").trim() || "Future Modern";
  const skillsRequired = String(formData.get("skillsRequired") ?? "")
    .split(/[\n,]+/)
    .map((sk) => sk.trim())
    .filter(Boolean);

  if (!title) throw new Error("Title is required.");
  if (description.length < 40) {
    throw new Error(
      "Description must be at least 40 characters — this is the whole listing.",
    );
  }
  if (!INDUSTRIES.includes(industryRaw as Industry)) {
    throw new Error("Pick a pillar.");
  }
  if (!EMPLOYMENT_TYPES.includes(employmentRaw as EmploymentType)) {
    throw new Error("Pick an employment type.");
  }
  if (!STATUSES.includes(statusRaw as JobStatus)) {
    throw new Error("Unknown status.");
  }
  if (!compensation) {
    throw new Error(
      "Compensation is required. A listing without a number wastes the applicant's time.",
    );
  }
  if (!location) throw new Error("Location is required — 'Remote' counts.");

  const values = {
    title,
    description,
    industry: industryRaw as Industry,
    skillsRequired,
    compensation,
    location,
    employmentType: employmentRaw as EmploymentType,
    postedByLabel,
    status: statusRaw as JobStatus,
  };

  let jobId = id;
  if (id) {
    await db.update(jobs).set(values).where(eq(jobs.id, id));
  } else {
    jobId = `job_${randomUUID()}`;
    await db.insert(jobs).values({
      id: jobId,
      ...values,
      postedBy: admin.id,
      createdAt: new Date().toISOString(),
    });
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: `job:${jobId}`,
    before: null,
    after: { title, status: values.status, employmentType: values.employmentType },
    reason: id
      ? `${adminName(admin)} updated job posting "${title}".`
      : `${adminName(admin)} posted job "${title}".`,
  });

  revalidateJobSurfaces(jobId);
}

/**
 * Close a posting. Deliberately not a delete: applications reference
 * the job, and someone who applied should still be able to see what
 * they applied to. Closed drops off the public board.
 */
export async function setJobStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!id) throw new Error("id is required");
  if (!STATUSES.includes(statusRaw as JobStatus)) {
    throw new Error("Unknown status.");
  }

  const existing = await jobReader.byId(id);
  if (!existing) throw new Error("Job not found.");

  await db
    .update(jobs)
    .set({ status: statusRaw as JobStatus })
    .where(eq(jobs.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: `job:${id}`,
    before: { status: existing.status },
    after: { status: statusRaw },
    reason: `Job "${existing.title}" set to ${statusRaw}.`,
  });

  revalidateJobSurfaces(id);
}
