/**
 * Walkthrough steps + per-user progress.
 *
 * REPLACE WITH: Postgres tables — `walkthrough_steps` (admin-editable
 * content, seeded from this file) and `walkthrough_progress` (per-user
 * completion log). Shapes here mirror the future Drizzle schema.
 *
 * The walkthrough exists to make sure beta members hit every surface
 * intentionally — left to themselves they'd skim the dashboard, never
 * try the marketplace, and never give us feedback. The tour is the
 * forcing function. Steps are tagged by tier (and optionally by
 * pillar) so each member sees a path that's relevant to them.
 */
import type { WalkthroughProgress, WalkthroughStep } from "@/lib/types";

/**
 * Canonical walkthrough script. Order within a tier is the `order` field.
 * Steps with `pillar: null` are shown to all pillars in that tier.
 *
 * Naming convention: `wts_<tier>_<short-id>`.
 */
export const MOCK_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  // ── Prospect tier — onlooker, not yet a member ──────────────────────
  {
    id: "wts_prospect_intro",
    order: 1,
    tier: "prospect",
    pillar: null,
    title: "Welcome — what to expect this week",
    blurb:
      "You're in the beta as a prospect. We'll walk you through what the cooperative looks like before you decide whether to apply for membership.",
    surface: "/dashboard",
    surfaceLabel: "Open your dashboard",
    whatToTry: [
      "Glance at the open RFPs we're routing right now",
      "Check the recent activity feed",
    ],
    feedbackPrompt: null,
  },
  {
    id: "wts_prospect_showcase",
    order: 2,
    tier: "prospect",
    pillar: null,
    title: "See the work members are putting up",
    blurb:
      "The Showcase is what an outside client sees when they evaluate the cooperative. This is the bar.",
    surface: "/showcase",
    surfaceLabel: "Browse the Showcase",
    whatToTry: [
      "Pick a piece you'd like to be next to",
      "Notice we don't publish last names or external links by default",
    ],
    feedbackPrompt:
      "Does the work in the showcase look like company you'd want to keep?",
  },
  {
    id: "wts_prospect_store",
    order: 3,
    tier: "prospect",
    pillar: null,
    title: "Marketplace — vetted goods, services, SaaS",
    blurb:
      "Members list product across five categories. Subdomains (men., saas., energy., studio., wear.) are filtered views of the same store.",
    surface: "/store",
    surfaceLabel: "Browse the Store",
    whatToTry: [
      "Filter by a category that matches your work",
      "Imagine your own listing — what would it sell?",
    ],
    feedbackPrompt: "What's the first product you'd want to list here?",
  },
  {
    id: "wts_prospect_locker",
    order: 4,
    tier: "prospect",
    pillar: null,
    title: "Content locker — members-only artist drops",
    blurb:
      "Mux-hosted video and audio from cooperative artists. Streams stay inside the platform; nothing click-offs to YouTube or Spotify. Browse what's open to your tier.",
    surface: "/locker",
    surfaceLabel: "Open the Content Locker",
    whatToTry: [
      "Filter by artist or pillar",
      "Try a piece that's gated above your tier — note the upgrade prompt",
    ],
    feedbackPrompt:
      "Did the locker feel like a reason to upgrade — or just another list?",
  },
  {
    id: "wts_prospect_whitelist",
    order: 5,
    tier: "prospect",
    pillar: null,
    title: "Whitelist — earned access, not for sale",
    blurb:
      "Three earned paths in: invitation, application + vetting, or contribution. The donation lane is optional and explicitly does not grant access. Read the framing before you apply for membership.",
    surface: "/whitelist",
    surfaceLabel: "See how access works",
    whatToTry: [
      "Read the 'Not for sale' framing under the hero",
      "Open the donation section — note the split routing (50% Treasury / 50% LP, $0 to ops, $0 to anyone individual — war-chest mode until salaries start)",
    ],
    feedbackPrompt:
      "Does 'access is earned, not sold' read clearly here, or does it still feel like a paywall in disguise?",
  },
  {
    id: "wts_prospect_apply",
    order: 6,
    tier: "prospect",
    pillar: null,
    title: "Apply for membership when you're ready",
    blurb:
      "Membership unlocks the wallet, the contracts surface, and the 85% contributor split. We vet for fit, not credentials.",
    surface: "/membership",
    surfaceLabel: "Open membership upgrade",
    whatToTry: [
      "Read the partner vs member tier difference",
      "If you're sure, hit Apply — we'll route to admin review",
    ],
    feedbackPrompt:
      "Is anything stopping you from applying right now? (No wrong answer.)",
  },

  // ── Partner tier — committed but still earning into membership ─────
  {
    id: "wts_partner_intro",
    order: 1,
    tier: "partner",
    pillar: null,
    title: "Partners run point on individual deals",
    blurb:
      "You can take RFPs, run quote sheets, log attribution, and earn into the contributor pool. Membership is the next step up.",
    surface: "/dashboard",
    surfaceLabel: "Open your dashboard",
    whatToTry: [
      "Look for matching open RFPs in your pillar(s)",
      "Note the HubSpot deal stage on your active contracts",
    ],
    feedbackPrompt: null,
  },
  {
    id: "wts_partner_quote",
    order: 2,
    tier: "partner",
    pillar: null,
    title: "Submit a quote sheet on an open RFP",
    blurb:
      "Price + timeline + work samples + an internal note to admin. Admin frames you to the client — you don't have to undersell or overclaim.",
    surface: "/projects",
    surfaceLabel: "Find an open RFP",
    whatToTry: [
      "Pick one and submit a quote (sandbox — won't actually send)",
      "Write the internal note like you would to a teammate",
    ],
    feedbackPrompt: "Did anything in the quote form trip you up?",
  },
  {
    id: "wts_partner_payout",
    order: 3,
    tier: "partner",
    pillar: null,
    title: "Hook up Stripe Connect for payouts",
    blurb:
      "Optional but unblocks payouts when a contract you're on settles. Mercury is the default rail; Stripe handles credit-card opt-ins and Express payouts.",
    surface: "/profile",
    surfaceLabel: "Open your profile",
    whatToTry: [
      "Find the payouts section",
      "Walk through the (mock) Stripe onboarding stub",
    ],
    feedbackPrompt:
      "Was the payouts section easy to find? Anything you'd word differently?",
  },
  {
    id: "wts_partner_wallet",
    order: 4,
    tier: "partner",
    pillar: null,
    title: "Your $BUILD balance + token activity",
    blurb:
      "Tokens accrue from contributions, governance, and admin grants. The wallet view also shows your ERC-6551 token-bound account.",
    surface: "/wallet",
    surfaceLabel: "Open your wallet",
    whatToTry: [
      "Check your balance + recent transactions",
      "Note your wallet address (token-bound account)",
    ],
    feedbackPrompt:
      "Does the wallet make sense as a member-of-a-co-op concept?",
  },
  {
    // Phase 2.7 — feedback rail surfaced for the partner track too.
    // Partners ride the same peer-review + testimonial rails as
    // members, so they should see how it lands before broader use.
    id: "wts_partner_feedback",
    order: 5,
    tier: "partner",
    pillar: null,
    title: "Feedback rail — peer reviews + customer testimonials",
    blurb:
      "Multi-person engagements collect a short anonymous review from each teammate at wrap-up. Customer feedback comes in via magic-link (clients) or your /orders page (buyers); admin curates a single quote per testimonial and attaches it to one contributor on their profile.",
    surface: "/u/aliza",
    surfaceLabel: "See the rail on a member profile",
    whatToTry: [
      "Read the Reputation section on Aliza's profile (members-only)",
      "Open /projects/p_103 to see how the peer-review form sits between 'About this work' and the team list",
      "If you submit a buyer review on /orders/ord_002, it lands in the admin testimonials queue, not auto-published",
    ],
    feedbackPrompt:
      "Anonymous-to-reviewee plus admin-curated testimonials — does that posture feel right, or do you want more raw signal coming through?",
  },
  {
    id: "wts_partner_orders",
    order: 6,
    tier: "partner",
    pillar: null,
    title: "Buyer order history",
    blurb:
      "Anything you've bought through the cooperative store lives here. Open an order to see line items, the split preview, and tracking once the seller marks it shipped.",
    surface: "/orders",
    surfaceLabel: "Open my orders",
    whatToTry: [
      "Click into a recent order",
      "Note the split breakdown (85% seller / 12% ops / 1.5% Treasury / 1.5% LP)",
    ],
    feedbackPrompt:
      "Was it obvious where the money goes — or do we need to surface that earlier in checkout?",
  },

  // ── Member tier — full access, can list product, gets full split ───
  {
    id: "wts_member_intro",
    order: 1,
    tier: "member",
    pillar: null,
    title: "You're a full member — here's what's yours",
    blurb:
      "Members can list product, take internal projects, run contracts end-to-end, vote on governance, and pull from the full 85% contributor pool.",
    surface: "/dashboard",
    surfaceLabel: "Open your dashboard",
    whatToTry: [
      "Skim every card on the dashboard once",
      "Note what's empty for you — that's where to invest first",
    ],
    feedbackPrompt: null,
  },
  {
    id: "wts_member_portfolio",
    order: 2,
    tier: "member",
    pillar: null,
    title: "Build out your portfolio",
    blurb:
      "Public profile is the surface clients land on after a quote sheet. Admin scrubs PII / external links before publishing — drop everything you've got.",
    surface: "/profile",
    surfaceLabel: "Open your profile",
    whatToTry: [
      "Add at least one portfolio item",
      "Write a description like you would for a peer, not a recruiter",
    ],
    feedbackPrompt:
      "What kind of portfolio item is hardest for you to add? (image? caption? link?)",
  },
  {
    id: "wts_member_store",
    order: 3,
    tier: "member",
    pillar: "creative-media",
    title: "List something in the Marketplace",
    blurb:
      "Apply for a category — clothing, creative-services, goods, etc. Vetted within 48h in real life; instant in sandbox.",
    surface: "/store",
    surfaceLabel: "Open the Store",
    whatToTry: [
      "Find the seller application path",
      "Mock-list a single product to see the shape",
    ],
    feedbackPrompt:
      "Where did the seller flow lose you? (Or: did it feel obvious?)",
  },
  {
    id: "wts_member_store_stem",
    order: 3,
    tier: "member",
    pillar: "stem",
    title: "List a SaaS or tooling product",
    blurb:
      "STEM members usually list SaaS, infra tooling, or research deliverables. Same vetting flow, different category.",
    surface: "/store",
    surfaceLabel: "Open the Store",
    whatToTry: [
      "Filter to SaaS",
      "Apply for the SaaS seller category",
    ],
    feedbackPrompt: "What category do you wish existed but doesn't yet?",
  },
  {
    id: "wts_member_internal",
    order: 4,
    tier: "member",
    pillar: null,
    title: "Apply to an internal cooperative project",
    blurb:
      "Help-wanted on Future Modern's own initiatives. No client, no commission split — these run on $BUILD token rewards + governance weight. We've seeded one open ask (component-library cleanup) so you can submit a real application end-to-end. Admin reviews; decision lands in your inbox.",
    surface: "/projects/p_101",
    surfaceLabel: "Open the seeded apply form",
    whatToTry: [
      "Read the project brief on the right rail",
      "Fill the apply form — proposed role, short pitch, hours/week, optional portfolio link",
      "Watch the inbox strip on /projects light up when the decision posts",
    ],
    feedbackPrompt:
      "Did the apply form ask the right questions, or are there fields you'd add or drop?",
  },
  {
    id: "wts_member_fulfillment",
    order: 5,
    tier: "member",
    pillar: null,
    title: "Run an order through fulfillment",
    blurb:
      "If you list product, this is your control room. Advance an order through placed → paid → fulfilling → shipped → delivered. Save tracking inline. Split distributes once admin marks delivered orders settled.",
    surface: "/profile/seller/orders",
    surfaceLabel: "Open the seller dashboard",
    whatToTry: [
      "Find a 'fulfilling' order and add a tracking number",
      "Advance one to 'shipped' — watch the buyer-side notification rail update in /orders",
    ],
    feedbackPrompt:
      "What status transition felt out of place — or what's missing between two of them?",
  },
  {
    id: "wts_member_locker",
    order: 6,
    tier: "member",
    pillar: "creative-media",
    title: "Drop a piece in the locker",
    blurb:
      "Mux-hosted re-uploads only — you grant distribution rights, we host the stream. The player stays inside the platform; nothing click-offs to YouTube or Spotify.",
    surface: "/locker",
    surfaceLabel: "Open the Content Locker",
    whatToTry: [
      "Find the contributor upload path",
      "Note how tier-gating works on each piece (prospect/partner/member/admin-only)",
    ],
    feedbackPrompt:
      "Do the gating tiers feel right for an artist's catalog — or too coarse?",
  },
  {
    // Phase 2.7 — peer review on a wrapped multi-person internal
    // project. The seeded fixture (p_103) is Chibu + Trevor on
    // governance tooling. The form only renders for teammates, so
    // walkers who aren't on the team see the section description and
    // are nudged to use the admin "View site as" picker (Chibu or
    // Trevor) to see the form fully.
    id: "wts_member_peer_review",
    order: 7,
    tier: "member",
    pillar: null,
    title: "Peer review — rate teammates on a wrapped engagement",
    blurb:
      "When a multi-person engagement closes, each teammate gets a short anonymous questionnaire. Reviews land attributed to admin on the reviewee's surface — calibration only admin sees the reviewer. Solo engagements skip this rail entirely.",
    surface: "/projects/p_103",
    surfaceLabel: "Open the seeded wrapped project",
    whatToTry: [
      "Read the peer-review section between 'About this work' and the team list",
      "If you're not on the team, flip to Chibu or Trevor via Admin → View site as to see the form rendered",
      "Note the four sliders: overall, collaboration, craft, reliability",
    ],
    feedbackPrompt:
      "Are the four dimensions the right ones, or is there one missing that you'd want to rate teammates on?",
  },
  {
    // Phase 2.7 — reputation block on the public profile. Members-only
    // gate: signed-in viewers see aggregate peer rating + sub-dims +
    // published testimonials. Anonymous web sees portfolio + bio only.
    id: "wts_member_reputation",
    order: 8,
    tier: "member",
    pillar: null,
    title: "See how your reputation reads to other members",
    blurb:
      "Your public profile shows aggregate peer rating, three sub-dimensions, and any customer testimonials admin has promoted. The whole reputation block is members-only — anonymous web only ever sees portfolio + bio.",
    surface: "/u/aliza",
    surfaceLabel: "View Aliza's profile",
    whatToTry: [
      "Scroll to the Reputation section under the portfolio grid",
      "Note the published testimonial pulled from a real client engagement (admin-curated, PII-scrubbed)",
      "Sign out via the nav and revisit the same URL — the reputation block disappears for anonymous viewers",
    ],
    feedbackPrompt:
      "Is the reputation block doing enough, doing too much, or missing something that would matter for an outside member sizing you up?",
  },
  // ── Admin track — orthogonal to tier; surfaced to anyone with
  // `isAdmin`. Admins see this section under their regular tier
  // walkthrough on /walkthrough so they hit every admin surface
  // intentionally instead of stumbling into them.
  {
    id: "wts_admin_intro",
    order: 1,
    tier: "admin",
    pillar: null,
    title: "Admin tour — the operator console",
    blurb:
      "The admin home (/admin) tiles up every operational queue: members, applications, projects, RFPs, quotes, contracts (AR/AP), tokens, marketplace, whitelist, team, beta feedback, testimonials. Skim the counts to know what needs your attention before walking through each surface below.",
    surface: "/admin",
    surfaceLabel: "Open admin home",
    whatToTry: [
      "Note the count on each tile — those numbers are live against the seeded fixtures",
      "Use the Admin dropdown in the nav to jump straight to subsurfaces without coming back here",
    ],
    feedbackPrompt:
      "Anything missing from the home tiles that you'd want at-a-glance before you start triaging?",
  },
  {
    id: "wts_admin_view_as",
    order: 2,
    tier: "admin",
    pillar: null,
    title: "View site as — see what each tier sees",
    blurb:
      "The Admin dropdown has a 'View site as' picker that swaps the session cookie to a viewer, a prospect, a partner, a member, or another admin. A pink banner stays at the top until you flip back so you can't forget you're impersonating.",
    surface: "/admin",
    surfaceLabel: "Open admin home",
    whatToTry: [
      "Open Admin → View site as → pick a member",
      "Browse a couple of surfaces, note what disappears (admin tiles, etc.)",
      "Use the pink banner's flip-back to return to your own session",
    ],
    feedbackPrompt:
      "Was the flip-back affordance obvious enough, or did you forget you were viewing as someone else?",
  },
  {
    id: "wts_admin_applications",
    order: 3,
    tier: "admin",
    pillar: null,
    title: "Project applications — approve members onto internal work",
    blurb:
      "Members pitch themselves into internal cooperative projects via the apply form on /projects/[id]. Decisions land here. Approve auto-adds them to the team and fires an inbox ping; decline fires a softer 'not this round' notification.",
    surface: "/admin/projects/applications",
    surfaceLabel: "Open the applications queue",
    whatToTry: [
      "Open a pending row and read the pitch + portfolio link",
      "Approve or decline with an admin note — the note ships in the applicant's inbox",
      "Note the 'All projects' link in the dropdown if you need cooperative-wide oversight",
    ],
    feedbackPrompt:
      "Are the application fields giving you enough to decide, or do you need something else upstream of approve/decline?",
  },
  {
    id: "wts_admin_rfps",
    order: 4,
    tier: "admin",
    pillar: null,
    title: "RFP intake — vet client briefs before they hit the contributor feed",
    blurb:
      "External clients submit RFPs at /contracts/new. Those land here as drafts behind admin vetting. Approve scrubs PII and routes the brief to the public contracts feed; reject keeps it private with an admin note for follow-up.",
    surface: "/admin/rfps",
    surfaceLabel: "Open the RFP intake queue",
    whatToTry: [
      "Open a pending RFP and read the client brief",
      "Approve to publish to /contracts (members see it filtered to their pillar)",
      "Note that contributors only see admin-vetted RFPs — pre-approval intake is admin-only",
    ],
    feedbackPrompt:
      "What's missing from the intake form that you'd want before approving a client brief into the contributor feed?",
  },
  {
    id: "wts_admin_quotes",
    order: 5,
    tier: "admin",
    pillar: null,
    title: "Quote sheets — frame contributor proposals before they go to the client",
    blurb:
      "Contributors submit structured quote sheets on /contracts/[id]/quote. You can edit, approve, or reject before the magic-link proposal goes to the client. Approval generates the client-facing proposal URL automatically.",
    surface: "/admin/quotes",
    surfaceLabel: "Open the quote-sheet queue",
    whatToTry: [
      "Open a pending quote and read the contributor's framing",
      "Edit the price or the internal note before approving — the contributor doesn't undersell to admin, that's your job to mediate",
      "Approve to generate the magic link the client opens",
    ],
    feedbackPrompt:
      "Is the contributor → admin → client framing clear in the quote rail, or does the editing surface need work?",
  },
  {
    id: "wts_admin_contracts",
    order: 6,
    tier: "admin",
    pillar: null,
    title: "Contract operations — AR/AP + attribution + revenue split",
    blurb:
      "The deepest admin surface. Per-contract you'll see attribution ledger (who introduced, who delivered), invoice/AR/AP status against Mercury references, and the revenue split engine that distributes the 85/15 across contributor pool + house pool. Marked-delivered orders settle through the same engine.",
    surface: "/admin/contracts",
    surfaceLabel: "Open contract operations",
    whatToTry: [
      "Open a contract with outstanding AR — note the contributor read-only view of the same data",
      "On a completed contract, check the split engine's drag-slider for the 80%-of-15% house pool allocation",
      "Confirm the attribution ledger immutability — entries log who and when, never edit",
    ],
    feedbackPrompt:
      "What's the slowest decision in this surface for you? That's where we should push UX next.",
  },
  {
    id: "wts_admin_marketplace",
    order: 7,
    tier: "admin",
    pillar: null,
    title: "Marketplace review — seller apps + product listings",
    blurb:
      "Two queues here: contributors applying for marketplace seller access, and seller-submitted product listings awaiting first-time review. Approving a seller unlocks the listing form for them; approving a listing publishes it to /store.",
    surface: "/admin/marketplace",
    surfaceLabel: "Open marketplace review",
    whatToTry: [
      "Open a pending seller application and read the contributor's pitch",
      "Approve a product listing — note it surfaces immediately on the public /store",
      "Force-distribute splits on a delivered order if you need to override the auto-settle path",
    ],
    feedbackPrompt:
      "Are the seller-app and listing-review flows distinct enough, or do they want to consolidate?",
  },
  {
    id: "wts_admin_whitelist",
    order: 8,
    tier: "admin",
    pillar: null,
    title: "Whitelist — earned access + consultation requests + donation log",
    blurb:
      "Three lanes: invitation queue (admin sends a magic link), application + vetting queue (members applying through the public surface), and the donation log (which is purely audit — donations explicitly do not grant access, route 50/50 to Treasury/LP with no ops cut while we build the war chest). Consultation requests for paid scoping calls land here too.",
    surface: "/admin/whitelist",
    surfaceLabel: "Open whitelist admin",
    whatToTry: [
      "Send a sandbox invitation magic link — note the email body preview",
      "Open a pending vetting application and approve or decline",
      "Read the consultation request lane — those are paid scoping calls separate from donation",
    ],
    feedbackPrompt:
      "Does the 'access is earned, not sold' posture come through clearly in this surface, or does the donation log accidentally read like a paywall?",
  },
  {
    id: "wts_admin_testimonials",
    order: 9,
    tier: "admin",
    pillar: null,
    title: "Testimonials — promote a customer quote to a member's profile",
    blurb:
      "Customer feedback (from the magic-link contract surface or from /orders/[id] for buyers) lands here as a pending row. You read the full prose, pull a single quote (PII-scrubbed, edited as needed), pick ONE contributor or seller to attach it to, and publish. The contributor gets an inbox ping with a link to their newly updated profile.",
    surface: "/admin/testimonials",
    surfaceLabel: "Open the testimonials queue",
    whatToTry: [
      "Open a pending row and read the full customer prose",
      "Trim the published quote down to one strong line — the input pre-fills with the original prose so you edit, not retype",
      "Pick the contributor with the strongest claim on the work — only one per testimonial",
      "Hit Publish; cross-check on the attributed contributor's /u/[handle] that the testimonial now renders in their reputation block",
    ],
    feedbackPrompt:
      "Is the 'one quote, one contributor' constraint right, or do some testimonials want multi-attribution?",
  },
  {
    id: "wts_admin_feedback",
    order: 10,
    tier: "admin",
    pillar: null,
    title: "Beta feedback — triage in-app submissions from members",
    blurb:
      "Every walkthrough step + the dashboard prompt + standalone surfaces drop here. Each row carries the surface URL, the prompt that fired it, the member's note, and tier/pillar context. Mark triaged once you've decided what to do; the row stays in the audit log.",
    surface: "/admin/feedback",
    surfaceLabel: "Open the feedback inbox",
    whatToTry: [
      "Filter by surface to see which step is generating the most pushback",
      "Mark a row triaged — the new count drops on the admin home tile",
      "Cross-reference with /admin/testimonials so you don't lose external client signal in the noise",
    ],
    feedbackPrompt:
      "What slice of the inbox is hardest to triage right now, and what filter or grouping would fix it?",
  },
  {
    id: "wts_admin_outro",
    order: 11,
    tier: "admin",
    pillar: null,
    title: "Operator wrap — anything missing from the admin surface?",
    blurb:
      "You've seen every admin queue in the sandbox. Before broader use, name the one operational decision that's still painful — that's where Phase 3 (production backend) work should land first.",
    surface: "/admin",
    surfaceLabel: "Back to admin home",
    whatToTry: [
      "Think about which queue would slow you down with 50 contributors instead of 5",
      "Drop the answer in the prompt below — admin walkthrough feedback gets its own surface tag in /admin/feedback",
    ],
    feedbackPrompt:
      "Which admin queue would break first at 10x the volume, and what would unbreak it?",
  },
  {
    id: "wts_member_outro",
    order: 9,
    tier: "member",
    pillar: null,
    title: "Last thing — leave us your unfiltered take",
    blurb:
      "We're 4–5 years into this. Honest feedback right now lands more than polished feedback in three months.",
    surface: "/dashboard",
    surfaceLabel: "Back to dashboard",
    whatToTry: [
      "Drop a note from the feedback prompt on your dashboard",
      "Or DM Jamar — same effect",
    ],
    feedbackPrompt:
      "What's the one thing that, if we fixed it, would make you actually use this every week?",
  },
];

/**
 * Per-user completion log. Seeded with a handful of entries so the
 * walkthrough surface has resume-state to render.
 */
export const MOCK_WALKTHROUGH_PROGRESS: WalkthroughProgress[] = [
  // Jamar (admin/member) has tested through the first three member steps.
  {
    id: "wpr_001",
    userId: "u_jamar",
    stepId: "wts_member_intro",
    completedAt: "2026-04-22T15:10:00Z",
  },
  {
    id: "wpr_002",
    userId: "u_jamar",
    stepId: "wts_member_portfolio",
    completedAt: "2026-04-22T15:24:00Z",
  },
  {
    id: "wpr_003",
    userId: "u_jamar",
    stepId: "wts_member_store",
    completedAt: "2026-04-23T10:02:00Z",
  },
  // Aliza (partner) walked through the intro and quote-sheet step.
  {
    id: "wpr_004",
    userId: "u_aliza",
    stepId: "wts_partner_intro",
    completedAt: "2026-04-22T18:40:00Z",
  },
  {
    id: "wpr_005",
    userId: "u_aliza",
    stepId: "wts_partner_quote",
    completedAt: "2026-04-22T19:05:00Z",
  },
];

/**
 * Returns the steps for a given tier + pillar. Steps tagged with a
 * pillar are only shown if the user has that pillar; pillar-null steps
 * are shown to everyone in the tier. The "admin" lane is excluded —
 * admins get those steps via `stepsForAdmin()` rendered as a separate
 * Admin tour section. Sorted by `order`.
 */
export function stepsForUser(
  tier: Exclude<WalkthroughStep["tier"], "admin">,
  pillars: ReadonlyArray<NonNullable<WalkthroughStep["pillar"]>>,
): WalkthroughStep[] {
  return MOCK_WALKTHROUGH_STEPS.filter((s) => {
    if (s.tier !== tier) return false;
    if (s.pillar === null) return true;
    return pillars.includes(s.pillar);
  }).sort((a, b) => a.order - b.order);
}

/**
 * Returns the admin-tour steps. Surfaced on /walkthrough as a separate
 * section to any signed-in user with `isAdmin`, in addition to (not
 * instead of) their tier walkthrough.
 */
export function stepsForAdmin(): WalkthroughStep[] {
  return MOCK_WALKTHROUGH_STEPS.filter((s) => s.tier === "admin").sort(
    (a, b) => a.order - b.order,
  );
}

/**
 * Returns the set of stepIds the user has completed.
 */
export function completedStepIds(userId: string): Set<string> {
  return new Set(
    MOCK_WALKTHROUGH_PROGRESS.filter((p) => p.userId === userId).map(
      (p) => p.stepId,
    ),
  );
}
