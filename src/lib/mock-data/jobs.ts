/**
 * Mock full-time / part-time roles listed on the $BUILD.Store job board.
 *
 * REPLACE WITH: `jobs` table queries. Postings can originate from Future Modern
 * itself, cooperative partners, or portfolio clients who want first-look access
 * to the member pool before going to public boards.
 */
import type { Job } from "@/lib/types";

export const MOCK_JOBS: Job[] = [
  {
    id: "j_001",
    title: "Senior full-stack engineer — platform",
    description:
      "Build and scale the $BUILD.Store platform. Next.js + Drizzle + Postgres, ERC-6551 wallet integration, governance tooling.",
    industry: "stem",
    skillsRequired: ["TypeScript", "Next.js", "Postgres", "web3"],
    compensation: "$150k–$180k + $BUILD tokens",
    location: "Remote (US)",
    employmentType: "full-time",
    postedBy: "internal_futuremodern",
    postedByLabel: "Future Modern",
    status: "open",
    createdAt: "2026-04-10T00:00:00Z",
  },
  {
    id: "j_002",
    title: "Creative director — Afrofuturist studio",
    description:
      "Lead creative direction across film, editorial, and brand work for in-house and client engagements. Hands-on and strategic.",
    industry: "creative-media",
    skillsRequired: ["direction", "brand", "film", "editorial"],
    compensation: "$130k–$160k",
    location: "Hybrid (NYC)",
    employmentType: "full-time",
    postedBy: "internal_futuremodern",
    postedByLabel: "Future Modern",
    status: "open",
    createdAt: "2026-04-08T00:00:00Z",
  },
  {
    id: "j_003",
    title: "Enterprise account executive — MSP vertical",
    description:
      "Sell Direct Connect Global's managed-services offerings into mid-market and Fortune 1000 accounts. Our partner's posting, open to our members first.",
    industry: "professional-services",
    skillsRequired: ["enterprise sales", "MSP", "account management"],
    compensation: "$120k base + commission",
    location: "Remote",
    employmentType: "full-time",
    postedBy: "partner_dcg",
    postedByLabel: "Direct Connect Global (partner)",
    status: "open",
    createdAt: "2026-04-14T00:00:00Z",
  },
  {
    id: "j_004",
    title: "Video editor — part-time, recurring",
    description:
      "Edit long-form artist profiles and brand films on a monthly cadence. Ongoing engagement, not project-based.",
    industry: "creative-media",
    skillsRequired: ["Premiere", "DaVinci Resolve", "motion graphics"],
    compensation: "$75/hr, ~20 hrs/week",
    location: "Remote",
    employmentType: "part-time",
    postedBy: "partner_url_media",
    postedByLabel: "URL Media (partner)",
    status: "open",
    createdAt: "2026-03-28T00:00:00Z",
  },
  {
    id: "j_005",
    title: "Smart-contract engineer — contract-to-hire",
    description:
      "Three-month engagement on the $BUILD token + governance stack, with path to full-time if both sides want it.",
    industry: "stem",
    skillsRequired: ["solidity", "foundry", "ERC-6551"],
    compensation: "$140/hr; salary negotiable on conversion",
    location: "Remote",
    employmentType: "contract-to-hire",
    postedBy: "internal_buildstore",
    postedByLabel: "$BUILD.Store",
    status: "open",
    createdAt: "2026-04-01T00:00:00Z",
  },
];
