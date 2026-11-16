/**
 * Setup coach — what a new member is asked to fill in, and where it is.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-11-16)
 *
 * Jamar had to send Ari Kamlani an email with four numbered steps and
 * two screenshots, one of them with the edit pencils circled in red,
 * to explain how to fill in a profile. The email was correct and
 * well-written and it should not have had to exist. A product that
 * needs a hand-written diagram mailed to each new member has not
 * finished onboarding them.
 *
 * Jamar: "The tour needs to be an overlay that directs them to the
 * setup like a video game tutorial." So this is not another page
 * explaining the app. It points at the real control, on the real
 * page, and waits.
 *
 * WHY THE STEPS ARE DERIVED, NOT TRACKED
 *
 * Nothing here records that a member "did" a step. `outstandingSteps`
 * reads the profile and returns what is still empty. Fill in a
 * tagline and the tagline step is gone on the next render, whether it
 * was filled through the coach, the editor, or an admin doing it for
 * them.
 *
 * The alternative was walkthrough_progress, which is how /walkthrough
 * works and is right for a tour of surfaces: "have you seen the
 * wallet" has no answer except a stored one. But "do you have a
 * tagline" does, and storing it separately means the two can
 * disagree. A checkmark against an empty field is worse than no
 * checkmark.
 *
 * The one thing that cannot be derived is "I saw this and I do not
 * want it", which is users.setupCoachDismissedAt.
 *
 * WHY data-coach RATHER THAN CSS SELECTORS
 *
 * The overlay has to find the element it is pointing at. Selecting on
 * class names would mean Bayu's design pass silently breaks the tour,
 * and nothing would fail loudly enough to notice. A data attribute is
 * a declared contract: grep finds every anchor, and removing one
 * degrades to the centered fallback card instead of highlighting the
 * wrong thing.
 *
 * NO DATABASE IMPORTS IN THIS FILE. It is shared with the client
 * component, and check-client-boundary rejects a "use client" module
 * that can reach src/db/client.ts, type-only imports included.
 * ─────────────────────────────────────────────────────────────
 */

/** Anchors. Every value appears as data-coach="..." in exactly one place. */
export const COACH_ANCHORS = {
  profileMenu: "profile-menu",
  identity: "profile-identity",
  tags: "profile-tags",
  portfolio: "profile-portfolio",
  payout: "profile-payout",
} as const;

export type CoachAnchor =
  (typeof COACH_ANCHORS)[keyof typeof COACH_ANCHORS];

export interface SetupCoachStep {
  id: string;
  /** data-coach value to spotlight. */
  anchor: CoachAnchor;
  /**
   * Path the anchor lives on, or null when it is in the chrome and
   * therefore on every page. Null steps never offer "Take me there",
   * because there is nowhere to go.
   */
  route: string | null;
  title: string;
  body: string;
  /** Where the step is actually completed. */
  href: string;
  ctaLabel: string;
}

/**
 * What the coach needs to know about a member, as plain booleans.
 *
 * A flat snapshot rather than the User type on purpose: this crosses
 * into a client component, and a shape that cannot carry an email
 * address or a Stripe id cannot leak one.
 */
export interface SetupSnapshot {
  hasName: boolean;
  hasTagline: boolean;
  hasPhoto: boolean;
  hasDiscipline: boolean;
  hasSkills: boolean;
  hasPortfolio: boolean;
}

/**
 * Ordered, and the order is the argument.
 *
 * Name first because it is the one with downstream consequences: a
 * blank name is why a real settlement showed "Unknown Contributor"
 * against a live invoice. Payout last because it is the only step
 * that sends someone to a third party, and asking for bank details
 * before a member has typed their own name reads as a payment screen
 * rather than a profile.
 */
export const SETUP_COACH_STEPS: readonly SetupCoachStep[] = [
  {
    // Steps 2 and 3 of the email Jamar had to write by hand: "Click
    // the circle in the top corner", "Click Profile". Pointing at the
    // circle beats describing it, which is the entire idea.
    //
    // route null because the nav is on every page, so this works
    // wherever the member happens to land after signing in.
    id: "coach_where",
    anchor: COACH_ANCHORS.profileMenu,
    route: null,
    title: "Everything of yours is behind this circle",
    body:
      "Profile, notifications, wallet, your signed agreements, the jobs you are on. It is the one menu worth knowing. Open it and pick Profile, and we will keep going from there.",
    href: "/profile",
    ctaLabel: "Open my profile",
  },
  {
    id: "coach_identity",
    anchor: COACH_ANCHORS.identity,
    route: "/profile",
    title: "Start with your name",
    body:
      "Your name, photo and tagline. The tagline is the line a client reads first, under your name, before anything else on the page. Everywhere the app credits you, invoices you or pays you reads from here.",
    href: "/profile/edit/identity",
    ctaLabel: "Edit name, photo and tagline",
  },
  {
    id: "coach_tags",
    anchor: COACH_ANCHORS.tags,
    route: "/profile",
    title: "Say what you do",
    body:
      "Your discipline and your skills. These are not decoration. They are what the matcher reads when work comes in, so a blank set here means you are not considered for it.",
    href: "/profile/edit/talent-tags",
    ctaLabel: "Edit discipline and skills",
  },
  {
    id: "coach_portfolio",
    anchor: COACH_ANCHORS.portfolio,
    route: "/profile",
    title: "Show the work",
    body:
      "This page is the one a client lands on after a quote sheet, so the portfolio is doing the selling. Admin scrubs personal details and external links before anything publishes, so put up what you have.",
    href: "/profile/portfolio",
    ctaLabel: "Add work",
  },
  {
    id: "coach_payout",
    anchor: COACH_ANCHORS.payout,
    route: "/profile",
    title: "And this is where payouts live",
    body:
      "Nothing to do here today. You get paid on the default rail without connecting anything, and admin handles dispatch. Connecting Stripe is only worth it for card-paid invoices and marketplace sales. Worth knowing where the page is.",
    href: "/profile/payouts",
    ctaLabel: "Look at payouts",
  },
] as const;

/** Which steps are still outstanding, in order. Empty means done. */
export function outstandingSteps(
  snapshot: SetupSnapshot,
): SetupCoachStep[] {
  // Identity survives until all three are present. A member with a
  // name and no tagline is the common half-finished case, and it is
  // exactly the one worth still asking about.
  const identity =
    snapshot.hasName && snapshot.hasTagline && snapshot.hasPhoto;
  const tags = snapshot.hasDiscipline && snapshot.hasSkills;
  const portfolio = snapshot.hasPortfolio;

  const done: Record<string, boolean> = {
    // Orientation, not a field. Shown whenever anything else is
    // outstanding and never on its own, same rule as payout below.
    coach_where: identity && tags && portfolio,
    coach_identity: identity,
    coach_tags: tags,
    coach_portfolio: portfolio,
    // ─────────────────────────────────────────────────────────
    // PAYOUT IS NOT A COMPLETION GATE (2026-11-16)
    //
    // The obvious check is stripePayoutsEnabled, and it is wrong.
    // Stripe Connect is deliberately opt-in: the default rail is
    // ACH dispatched by an admin, and /profile/payouts spends three
    // paragraphs reassuring contributors that not connecting is the
    // normal state. Gating on it would nag every member who is
    // correctly on the default rail, permanently, to do a thing the
    // product does not want most of them to do.
    //
    // So it rides along as the closing card of a first run and
    // nothing more. Once the three real steps are filled in the
    // coach stops entirely, and payout never appears on its own.
    // ─────────────────────────────────────────────────────────
    coach_payout: identity && tags && portfolio,
  };
  return SETUP_COACH_STEPS.filter((s) => !done[s.id]);
}

/**
 * How far along, for the progress line in the overlay. Counts the
 * whole step list, not the outstanding ones, so "2 of 4" does not
 * silently become "2 of 2" as steps are completed.
 */
export function setupProgress(snapshot: SetupSnapshot): {
  done: number;
  total: number;
} {
  const total = SETUP_COACH_STEPS.length;
  return { done: total - outstandingSteps(snapshot).length, total };
}
