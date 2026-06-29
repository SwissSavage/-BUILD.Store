/**
 * Copy shared across the three signup-intent pages.
 *
 * Kept in one file so the chooser hub (`/signup`) and the three deep
 * pages stay in sync on the blurb text and card labels.
 */
export type SignupIntent = "hire_talent" | "build_a_team" | "join_as_talent";

export const INTENT_COPY: Record<
  SignupIntent,
  { label: string; headline: string; blurb: string; route: string }
> = {
  hire_talent: {
    label: "Hire talent",
    headline: "Hire talent — post a JD",
    blurb:
      "You have a specific role or opportunity for hire. Describe the JD — scope, seniority, timeline, compensation — and we route it to vetted contributors in the matching pillar. Skip the cold-pitch sift; the cooperative has already done the vetting.",
    route: "/signup/hire",
  },
  build_a_team: {
    label: "$BUILD a team",
    headline: "$BUILD a team",
    blurb:
      "You need a cross-pillar team assembled for a defined engagement — brand + build + GTM, or retrofit + financing + community, etc. Tell us the scope and we pull the right mix of STEM, Creative Media, and Professional Services members into a working squad.",
    route: "/signup/build-team",
  },
  join_as_talent: {
    label: "Join as talent",
    headline: "Join as talent",
    blurb:
      "You want to contribute work through the cooperative. Drop a link to your resume or portfolio, tell us which pillar you fit into, and we start the vetting conversation. Approved talent gets access to incoming RFPs, JDs, and direct client contracts.",
    route: "/signup/join",
  },
};

export const INTENT_ORDER: SignupIntent[] = [
  "hire_talent",
  "build_a_team",
  "join_as_talent",
];
