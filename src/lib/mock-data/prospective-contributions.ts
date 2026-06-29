/**
 * Prospective contributions (Phase 2.8 sandbox).
 *
 * Outside-the-cooperative offers to help on a specific internal
 * project. Submitters are unauthenticated; they reach this rail by
 * landing on /whitelist Path 3, browsing /projects, picking an open
 * internal initiative, and submitting the public "Offer to help"
 * form on /projects/[id].
 *
 * Two seed rows so the /admin/projects/contributions queue has
 * something to render before any real submissions land.
 *
 * REPLACE WITH: Drizzle insert from
 * `submitProspectiveContribution`. Read API filtered to admin only.
 */
import type { ProspectiveContribution } from "@/lib/types";

export const MOCK_PROSPECTIVE_CONTRIBUTIONS: ProspectiveContribution[] = [
  {
    id: "pc_001",
    projectId: "p_101", // $BUILD.Store component library
    contactName: "Marisol Vega",
    contactEmail: "marisol.v.designs@example.com",
    proposedRole: "Design system pair — tokens + density",
    pitch:
      "I run a small product design studio in Mexico City. Saw the component library RFP through a friend on the cooperative — happy to help shape the token layer (spacing, density modes, dark/light parity). Past work: Linear, Vercel, a few B2B SaaS launches. Don't need to be a member, just want to build the thing.",
    hoursPerWeek: 6,
    portfolioLink: "https://marisol.studio",
    status: "new",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: "2026-04-26T11:42:00Z",
  },
  {
    id: "pc_002",
    projectId: "p_102", // Member onboarding flow
    contactName: "Devon Park",
    contactEmail: "devon@parkresearch.io",
    proposedRole: "Onboarding research lead",
    pitch:
      "Heard about Future Modern through Sunny. I run user research for a workers' coop in Berlin and we just rebuilt our member onboarding — would love to compare notes and run a couple of sessions on yours if it's useful. Free for the next two weeks.",
    hoursPerWeek: 4,
    portfolioLink: null,
    status: "contacted",
    reviewedBy: "u_jamar",
    reviewedAt: "2026-04-27T09:15:00Z",
    adminNote: "Replied — booking a 30 min intro for Wed.",
    createdAt: "2026-04-25T18:08:00Z",
  },
];

/** All contributions for one project, newest-first. */
export function contributionsForProject(
  projectId: string,
): ProspectiveContribution[] {
  return MOCK_PROSPECTIVE_CONTRIBUTIONS.filter(
    (c) => c.projectId === projectId,
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Count of "new" rows for the admin badge. */
export function newContributionCount(): number {
  return MOCK_PROSPECTIVE_CONTRIBUTIONS.filter((c) => c.status === "new")
    .length;
}
