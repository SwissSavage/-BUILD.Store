/**
 * Mock membership applications (tier progression).
 *
 * REPLACE WITH: `membership_applications` table queries.
 * Admin UI approves/rejects; on approval, bump the user's tier.
 */
import type { MembershipApplication } from "@/lib/types";

export const MOCK_APPLICATIONS: MembershipApplication[] = [
  {
    id: "app_001",
    userId: "u_trevor",
    requestedTier: "partner",
    currentTier: "prospect",
    status: "pending",
    applicationData: {
      sample_work: "https://example.com/trevor-data-portfolio",
      time_commitment: "20 hrs/week",
      why: "Want to contribute to the cooperative data infra.",
    },
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-04-18T00:00:00Z",
  },
  {
    id: "app_002",
    userId: "u_michael",
    requestedTier: "member",
    currentTier: "partner",
    status: "pending",
    applicationData: {
      referrals: ["u_jamar"],
      completed_projects: 3,
      why: "Move to full cooperative rights.",
    },
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-04-15T00:00:00Z",
  },
];
