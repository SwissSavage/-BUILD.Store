/**
 * Live project readers — Postgres first, seed array as cold-start
 * fallback.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-28)
 *
 * Project CREATION was already writing to Postgres — /projects/new
 * and /contracts/new both do a real db.insert. But all 20 surfaces
 * that DISPLAY projects read MOCK_PROJECTS, the July seed array.
 *
 * Net effect: a member proposes a project, the row lands in Postgres,
 * and then it is nowhere to be seen. Jamar reported it as "I've tried
 * putting in projects, nothing uploads." The upload worked every
 * time. Nothing rendered it.
 *
 * That asymmetry — real writes, mock reads — is the single most
 * misleading failure mode in the codebase, because it looks exactly
 * like a broken form.
 * ─────────────────────────────────────────────────────────────
 *
 * IMPORTANT: pages using these readers must export
 * `dynamic = "force-dynamic"`, or Next.js bakes the result at build
 * time and new rows never appear regardless of this file.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects as projectsTable } from "@/db/schema";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import type { Project } from "@/lib/types";

export type ReadSource = "postgres" | "seed-fallback";

export interface ProjectRead {
  projects: Project[];
  source: ReadSource;
}

/** Every project, newest first. */
export async function getAllProjects(): Promise<ProjectRead> {
  try {
    const rows = await db
      .select()
      .from(projectsTable)
      .orderBy(desc(projectsTable.createdAt));
    return { projects: rows as unknown as Project[], source: "postgres" };
  } catch {
    return { projects: MOCK_PROJECTS, source: "seed-fallback" };
  }
}

/** One project by id. */
export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const [row] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);
    if (row) return row as unknown as Project;
    return MOCK_PROJECTS.find((p) => p.id === id) ?? null;
  } catch {
    return MOCK_PROJECTS.find((p) => p.id === id) ?? null;
  }
}

/**
 * Open RFPs — the public /contracts board and the talent-facing
 * opportunity lists.
 *
 * `isRfp && rfpApprovedAt` is the gate: a project only becomes a
 * public opportunity once an admin approves it. Keeping that rule
 * here rather than in each page means an un-approval takes effect
 * everywhere at once.
 */
export async function getOpenRfps(): Promise<ProjectRead> {
  const { projects, source } = await getAllProjects();
  return {
    projects: projects.filter(
      (p) => p.status === "open" && p.isRfp && Boolean(p.rfpApprovedAt),
    ),
    source,
  };
}

/** RFPs awaiting admin approval — /admin/rfps intake queue. */
export async function getPendingRfps(): Promise<ProjectRead> {
  const { projects, source } = await getAllProjects();
  return {
    projects: projects.filter((p) => p.isRfp && !p.rfpApprovedAt),
    source,
  };
}

/** Client-facing contracts (kind === "contract"), newest first. */
export async function getContracts(): Promise<ProjectRead> {
  const { projects, source } = await getAllProjects();
  return {
    projects: projects.filter((p) => p.kind === "contract"),
    source,
  };
}

/** Projects a given member is assigned to. Powers the member dashboard. */
export async function getProjectsForMember(
  userId: string,
): Promise<ProjectRead> {
  const { projects, source } = await getAllProjects();
  return {
    projects: projects.filter(
      (p) =>
        p.assignedMemberIds?.includes(userId) ||
        p.adminUserIds?.includes(userId),
    ),
    source,
  };
}

/** Completed work — public case studies and portfolio surfaces. */
export async function getCompletedProjects(): Promise<ProjectRead> {
  const { projects, source } = await getAllProjects();
  return {
    projects: projects.filter((p) => p.status === "completed"),
    source,
  };
}
