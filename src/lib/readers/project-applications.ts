/**
 * Project application (bid) readers — live Postgres, seed fallback.
 *
 * Bids submitted through /projects/[id] now write to the
 * project_applications table. These readers back the admin triage
 * queue and the duplicate-submission guard.
 *
 * Uses the (project_id, status) index added in drizzle/0012.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectApplications } from "@/db/schema";
import { MOCK_PROJECT_APPLICATIONS } from "@/lib/mock-data/project-applications";
import type { ProjectApplication } from "@/lib/types";

/** Every application, newest first. Powers the admin queue. */
export async function getAllApplications(): Promise<ProjectApplication[]> {
  try {
    const rows = await db
      .select()
      .from(projectApplications)
      .orderBy(desc(projectApplications.createdAt));
    return rows as unknown as ProjectApplication[];
  } catch {
    return MOCK_PROJECT_APPLICATIONS;
  }
}

/** Applications on one project. */
export async function getApplicationsForProject(
  projectId: string,
): Promise<ProjectApplication[]> {
  try {
    const rows = await db
      .select()
      .from(projectApplications)
      .where(eq(projectApplications.projectId, projectId))
      .orderBy(desc(projectApplications.createdAt));
    return rows as unknown as ProjectApplication[];
  } catch {
    return MOCK_PROJECT_APPLICATIONS.filter((a) => a.projectId === projectId);
  }
}

/** One application by id. */
export async function getApplicationById(
  id: string,
): Promise<ProjectApplication | null> {
  try {
    const [row] = await db
      .select()
      .from(projectApplications)
      .where(eq(projectApplications.id, id))
      .limit(1);
    if (row) return row as unknown as ProjectApplication;
    return MOCK_PROJECT_APPLICATIONS.find((a) => a.id === id) ?? null;
  } catch {
    return MOCK_PROJECT_APPLICATIONS.find((a) => a.id === id) ?? null;
  }
}

/**
 * The double-apply guard: one pending bid per person per project.
 * Reapplying after a rejection or withdrawal is allowed, which is why
 * this filters on status rather than just existence.
 */
export async function findPendingApplication(
  projectId: string,
  userId: string,
): Promise<ProjectApplication | null> {
  try {
    const [row] = await db
      .select()
      .from(projectApplications)
      .where(
        and(
          eq(projectApplications.projectId, projectId),
          eq(projectApplications.userId, userId),
          eq(projectApplications.status, "pending"),
        ),
      )
      .limit(1);
    if (row) return row as unknown as ProjectApplication;
    return null;
  } catch {
    return (
      MOCK_PROJECT_APPLICATIONS.find(
        (a) =>
          a.projectId === projectId &&
          a.userId === userId &&
          a.status === "pending",
      ) ?? null
    );
  }
}

/**
 * Every proposal a member has submitted, newest first.
 *
 * Added 2026-09-02. /profile was calling applicationsByUser from
 * mock-data, so a member's own proposal count read from seed data and
 * showed zero for everyone real. Billy: "my signed agreements etc are
 * showing up as if I haven't done anything, whereas I should see at
 * least 1 signed agreement and 1 proposal sent."
 */
export async function getApplicationsForUser(
  userId: string,
): Promise<ProjectApplication[]> {
  const rows = await db
    .select()
    .from(projectApplications)
    .where(eq(projectApplications.userId, userId))
    .orderBy(desc(projectApplications.createdAt));
  return rows as unknown as ProjectApplication[];
}
