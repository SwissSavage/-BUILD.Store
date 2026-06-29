/**
 * Member applications to internal cooperative projects (Phase 2.5 sandbox).
 *
 * Internal projects (`Project.kind === "internal"`) don't go through the
 * RFP / quote-sheet rail — there's no client to vet and no commission
 * to split. Instead, members submit a short pitch saying what they'd
 * contribute and how much time they can give. Admins approve or
 * decline; approve auto-adds the user to the project's
 * `assignedMemberIds`.
 *
 * Seed list spans the open + in-progress internal projects so the
 * /projects/[id] surface, the /admin/projects/applications queue, and
 * the member's "Your applications" lane all have something to render.
 *
 * REPLACE WITH: a `project_applications` Drizzle table populated by
 * the same server action that mints the row in production. Approve
 * runs in a transaction with the projects-table update.
 */
import type { ProjectApplication } from "@/lib/types";

export const MOCK_PROJECT_APPLICATIONS: ProjectApplication[] = [
  // ── p_101 ($BUILD.Store component library) — two pending, one rejected
  {
    id: "pa_001",
    projectId: "p_101",
    userId: "u_aliza",
    proposedRole: "Design system lead",
    pitch:
      "Happy to own the design tokens + Card/Button audit. I've been pushing a similar primitive set on URL Media's editorial templates and can port the spacing scale across in a week.",
    hoursPerWeek: 8,
    portfolioLink: null,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    withdrawnAt: null,
    createdAt: "2026-04-23T15:20:00Z",
  },
  {
    id: "pa_002",
    projectId: "p_101",
    userId: "u_michael",
    proposedRole: "Form primitives + a11y pass",
    pitch:
      "I can take the form group (input, select, multiselect, file upload) and run the accessibility pass against WCAG AA. Done this for two B2B products in the last year.",
    hoursPerWeek: 6,
    portfolioLink: "https://example.com/michael/forms-case-study",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    withdrawnAt: null,
    createdAt: "2026-04-24T10:05:00Z",
  },
  {
    id: "pa_003",
    projectId: "p_101",
    userId: "u_trevor",
    proposedRole: "Storybook setup",
    pitch:
      "Wanted to learn the component library. Could do the Storybook scaffolding.",
    hoursPerWeek: 3,
    portfolioLink: null,
    status: "rejected",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-22T18:30:00Z",
    adminNote:
      "Need a member tier on this one — Storybook ties into the deploy pipeline. Let's revisit once your partner upgrade lands.",
    withdrawnAt: null,
    createdAt: "2026-04-22T11:50:00Z",
  },

  // ── p_102 (Member onboarding flow — Creative Media) — one approved, one pending
  {
    id: "pa_004",
    projectId: "p_102",
    userId: "u_aliza",
    proposedRole: "Storyboard + voiceover",
    pitch:
      "I'd write the first-week voiceover script and storyboard the three onboarding scenes. Can hand the Figma over to whoever picks up production.",
    hoursPerWeek: 5,
    portfolioLink: null,
    status: "approved",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-19T14:10:00Z",
    adminNote:
      "Yes — pair with whoever takes the design system slot on p_101 so the language stays consistent.",
    withdrawnAt: null,
    createdAt: "2026-04-18T09:30:00Z",
  },
  {
    id: "pa_005",
    projectId: "p_102",
    userId: "u_rob",
    proposedRole: "GTM-side reviewer",
    pitch:
      "Not the core builder, but I can stress-test the onboarding copy from a 'why would a partner stay' angle. Two-hour weekly review pass.",
    hoursPerWeek: 2,
    portfolioLink: null,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    withdrawnAt: null,
    createdAt: "2026-04-24T13:45:00Z",
  },

  // ── p_103 (Governance tooling) — one withdrawn (member self-cancelled)
  {
    id: "pa_006",
    projectId: "p_103",
    userId: "u_michael",
    proposedRole: "Treasury policy reviewer",
    pitch:
      "Could review the proposal-flow against the way our distribution policies are framed. Want to make sure on-chain weights map to the off-chain lane.",
    hoursPerWeek: 4,
    portfolioLink: null,
    status: "withdrawn",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    withdrawnAt: "2026-04-21T17:00:00Z",
    createdAt: "2026-04-20T08:15:00Z",
  },
];

/** All applications for a single project, newest-first. */
export function applicationsForProject(
  projectId: string,
): ProjectApplication[] {
  return MOCK_PROJECT_APPLICATIONS.filter(
    (a) => a.projectId === projectId,
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** All applications submitted by a single member, newest-first. */
export function applicationsByUser(userId: string): ProjectApplication[] {
  return MOCK_PROJECT_APPLICATIONS.filter((a) => a.userId === userId).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/** The active (pending) application a user has on a project, if any. */
export function activeApplication(
  projectId: string,
  userId: string,
): ProjectApplication | null {
  return (
    MOCK_PROJECT_APPLICATIONS.find(
      (a) =>
        a.projectId === projectId &&
        a.userId === userId &&
        a.status === "pending",
    ) ?? null
  );
}

/** Most recent application (any status) by a user on a project. */
export function latestApplication(
  projectId: string,
  userId: string,
): ProjectApplication | null {
  return applicationsForProject(projectId).find((a) => a.userId === userId) ?? null;
}

/** Count of pending applications across all projects — used for admin nav badge. */
export function pendingProjectApplicationCount(): number {
  return MOCK_PROJECT_APPLICATIONS.filter((a) => a.status === "pending").length;
}
