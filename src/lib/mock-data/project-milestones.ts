/**
 * Per-project milestones for the Domino's-style tracker.
 *
 * Seed covers two active contract projects (p_003 DCG / GTM, p_004 URL
 * Media editorial) and one internal cooperative project (p_103 governance
 * tooling) so the tracker has data on every surface that consumes it.
 *
 * Status mix is intentional: some completed, some in-progress, one
 * blocked, one not-started, one nearly-due. Lets us exercise the sweep
 * logic, the blocker UI, and the public Domino's strip without needing
 * the user to manually walk the state machine first.
 *
 * REPLACE WITH: `project_milestones` Drizzle table. Add a unique index
 * on (projectId, sequence) so the tracker order is stable.
 */
import type { ProjectMilestone } from "@/lib/types";

const NOW = "2026-05-04T12:00:00Z";
const dayOffset = (n: number): string => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
};

export const MOCK_PROJECT_MILESTONES: ProjectMilestone[] = [
  // ── p_003 (DCG GTM — Rob + Michael).
  {
    id: "ms_003_01",
    projectId: "p_003",
    sequence: 10,
    title: "Discovery kickoff",
    description: "60-minute kickoff with stakeholders. Establish scope, success criteria.",
    ownerUserId: "u_rob",
    dueAt: dayOffset(-21),
    status: "completed",
    blockerNote: null,
    completedAt: dayOffset(-20),
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-30),
    updatedAt: dayOffset(-20),
  },
  {
    id: "ms_003_02",
    projectId: "p_003",
    sequence: 20,
    title: "Movement Launch Brief",
    description: "First major deliverable: positioning, channel mix, three-month plan.",
    ownerUserId: "u_michael",
    dueAt: dayOffset(-7),
    status: "completed",
    blockerNote: null,
    completedAt: dayOffset(-8),
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-30),
    updatedAt: dayOffset(-8),
  },
  {
    id: "ms_003_03",
    projectId: "p_003",
    sequence: 30,
    title: "Regional benchmark appendix",
    description: "Comparable-market read; was an unscoped extra that landed well.",
    ownerUserId: "u_rob",
    dueAt: dayOffset(2),
    status: "in_progress",
    blockerNote: null,
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-14),
    updatedAt: dayOffset(-1),
  },
  {
    id: "ms_003_04",
    projectId: "p_003",
    sequence: 40,
    title: "Operational Readiness Scorecard",
    description: "Optional continuation deliverable: eight-axis rubric + walkthrough.",
    ownerUserId: "u_michael",
    dueAt: dayOffset(14),
    status: "not_started",
    blockerNote: null,
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-14),
    updatedAt: dayOffset(-14),
  },

  // ── p_004 (URL Media editorial — Aliza solo).
  {
    id: "ms_004_01",
    projectId: "p_004",
    sequence: 10,
    title: "Subject shortlist",
    description: "Five artists with two-line pitch each.",
    ownerUserId: "u_aliza",
    dueAt: dayOffset(-30),
    status: "completed",
    blockerNote: null,
    completedAt: dayOffset(-28),
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-45),
    updatedAt: dayOffset(-28),
  },
  {
    id: "ms_004_02",
    projectId: "p_004",
    sequence: 20,
    title: "First-round interviews",
    description: "Recorded conversations, transcript pass.",
    ownerUserId: "u_aliza",
    dueAt: dayOffset(-14),
    status: "completed",
    blockerNote: null,
    completedAt: dayOffset(-12),
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-30),
    updatedAt: dayOffset(-12),
  },
  {
    id: "ms_004_03",
    projectId: "p_004",
    sequence: 30,
    title: "Draft package, photo direction sign-off",
    description: "Long-form drafts plus photography brief approved by URL.",
    ownerUserId: "u_aliza",
    dueAt: dayOffset(1),
    status: "in_progress",
    blockerNote: null,
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-14),
    updatedAt: dayOffset(-2),
  },
  {
    id: "ms_004_04",
    projectId: "p_004",
    sequence: 40,
    title: "Final delivery",
    description: "Edited package, ready for publish.",
    ownerUserId: "u_aliza",
    dueAt: dayOffset(10),
    status: "not_started",
    blockerNote: null,
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-14),
    updatedAt: dayOffset(-14),
  },

  // ── p_103 (internal governance tooling — Chibu + Trevor). One blocked
  // milestone exercises the blocker rail and the admin "resolve" pathway.
  {
    id: "ms_103_01",
    projectId: "p_103",
    sequence: 10,
    title: "Multisig contract review",
    description: "Audit and integration plan for treasury multisig.",
    ownerUserId: "u_chibu",
    dueAt: dayOffset(-2),
    status: "blocked",
    blockerNote:
      "Waiting on contract owner to confirm signing threshold. Owner unresponsive for 8 days.",
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-20),
    updatedAt: dayOffset(-2),
  },
  {
    id: "ms_103_02",
    projectId: "p_103",
    sequence: 20,
    title: "Governance UI scaffold",
    description: "Prototype dashboard for proposal lifecycle.",
    ownerUserId: "u_trevor",
    dueAt: dayOffset(7),
    status: "in_progress",
    blockerNote: null,
    completedAt: null,
    lastDueSoonNoticeAt: null,
    lastOverdueNoticeAt: null,
    createdAt: dayOffset(-20),
    updatedAt: dayOffset(-1),
  },
];

/** Milestones for a given project, ordered by sequence. */
export function milestonesForProject(projectId: string): ProjectMilestone[] {
  return MOCK_PROJECT_MILESTONES.filter((m) => m.projectId === projectId).sort(
    (a, b) => a.sequence - b.sequence,
  );
}

/** Milestones owned by a given user, ordered by due date. */
export function milestonesForOwner(userId: string): ProjectMilestone[] {
  return MOCK_PROJECT_MILESTONES.filter((m) => m.ownerUserId === userId).sort(
    (a, b) => a.dueAt.localeCompare(b.dueAt),
  );
}

/** % of milestones completed for a project (0..1). Used by the tracker strip. */
export function projectProgress(projectId: string): {
  completed: number;
  total: number;
  ratio: number;
} {
  const ms = milestonesForProject(projectId);
  const completed = ms.filter((m) => m.status === "completed").length;
  return {
    completed,
    total: ms.length,
    ratio: ms.length === 0 ? 0 : completed / ms.length,
  };
}
