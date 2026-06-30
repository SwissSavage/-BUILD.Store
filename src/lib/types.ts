/**
 * Canonical domain types for $BUILD.Store.
 *
 * Shapes intentionally mirror the Drizzle schema in the legacy Replit
 * backend (`buildstore-backend-Replit-replit-agent/shared/schema.ts`)
 * so that when a real developer swaps mock data for a Postgres/Drizzle
 * layer, component-level types do not change.
 *
 * Industry nomenclature is fixed: STEM / Creative Media / Professional Services.
 */

export type Industry = "stem" | "creative-media" | "professional-services";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  stem: "STEM",
  "creative-media": "Creative Media",
  "professional-services": "Professional Services",
};

export type MembershipTier = "viewer" | "prospect" | "partner" | "member";

export const TIER_LABELS: Record<MembershipTier, string> = {
  viewer: "Viewer",
  prospect: "Prospect",
  partner: "Partner",
  member: "Member",
};

/**
 * Public display name. First-name only on any surface an outsider could reach
 * — the cooperative policy is to prevent circumvention (direct contact that
 * bypasses the platform). Full names are retained on the User record for
 * admin/legal/internal purposes only.
 */
export function publicName(u: Pick<User, "firstName"> | null | undefined): string {
  return u?.firstName?.trim() || "Member";
}

/**
 * Full name, used only in admin surfaces and on the signed-in user's own
 * dashboard/profile. Never leak this to public pages.
 */
export function adminName(u: Pick<User, "firstName" | "lastName"> | null | undefined): string {
  if (!u) return "Unknown";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Unknown";
}

export interface User {
  id: string;
  email: string;
  /**
   * URL-safe slug used in public routes like `/u/[handle]`. Must be unique.
   * By policy we derive the default handle from the first name (lowercased,
   * deduped with a suffix if needed) so nothing identifying leaks into URLs.
   */
  handle: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  membershipTier: MembershipTier;
  /**
   * Primary pillar — the one the member most identifies with. Drives which
   * RFPs and jobs land on the dashboard by default.
   */
  primaryIndustry: Industry | null;
  /**
   * Additional pillars a member contributes to. A sales-leaning consultant
   * might sit in Professional Services primary + Creative Media secondary,
   * for example. Empty array = single-pillar member.
   */
  secondaryIndustries: Industry[];
  /**
   * Tier-2 data participation opt-in. False by default.
   *
   * When true, the member has agreed to the cooperative's Data Use
   * Policy authorizing aggregated, anonymized labor-value research and
   * inputs to collective-bargaining tooling. Tier-1 operational data
   * use (internal pricing, matching, calibration) is governed by the
   * baseline registration T&C and does not depend on this flag.
   *
   * Toggleable from /profile at any time. Opt-out stops new collection
   * for Tier-2 purposes; already-published anonymized aggregates are
   * non-revocable in effect by design and remain published.
   *
   * REPLACE WITH: a `users.data_participation` Drizzle column with an
   * audit trail of opt-in / opt-out events for governance.
   */
  dataParticipation: boolean;
  skills: string[];
  /**
   * Primary discipline — what the member self-identifies as in one line
   * ("Rapper, Producer", "Brand Designer", "RevOps Specialist"). Surfaced
   * on every profile as a tag below the name. Free text rather than enum
   * for v1; admin can curate as a follow-up if disciplines proliferate.
   */
  discipline: string | null;
  /**
   * Controls how `/u/[handle]` renders for this user.
   *   - "contributor" (default): cooperative-contributor profile (portfolio,
   *     peer rating, testimonials). Used for everyone unless flipped.
   *   - "epk": Electronic Press Kit shell, designed for artists. Public
   *     viewers see hero + featured work + press + track record + booking
   *     CTA. Members still see the cooperative depth below the EPK shell.
   *
   * Flipping to "epk" is admin-gated and only meaningful when an
   * `ArtistEpk` row exists for the user. See [`ArtistEpk`].
   */
  profileMode: "contributor" | "epk";
  bio: string | null;
  portfolioUrl: string | null;
  buildTokenBalance: string; // string to match Drizzle numeric(18,8)
  isAdmin: boolean;
  /**
   * Talent semantic tags. Populated automatically by the onboarding
   * keyword-scrubber (`lib/talent-match.ts`) from resume / portfolio
   * text + skills + bio, then surfaced to admins for curation. Drives
   * the agentic match scorer that powers `/admin/inbound`'s
   * "Suggested talent" column so the cooperative can route
   * opportunities even when the inbound submitter uses different
   * vocabulary than the talent did at onboarding.
   *
   * Production swap moves this into a `talent_tags` join table with
   * (userId, tag, source, confidence, addedAt). Sandbox keeps a flat
   * string[] for simplicity.
   */
  talentTags: string[];
  walletAddress: string | null; // ERC-6551 token-bound account address
  /**
   * User's externally-controlled EOA (MetaMask / Coinbase Wallet /
   * WalletConnect / etc.) that they connected to claim ownership of
   * their TBA. Null until the user runs the connect flow.
   *
   * Production swap:
   *   - Connect flow signs a SIWE message; backend verifies and writes
   *     this field.
   *   - On disconnect we clear the field but never the TBA address.
   *   - Multiple external wallets per user is a Phase 2 extension; for
   *     now we keep a single primary.
   */
  connectedWalletAddress: string | null;
  /** Wallet provider label captured at connect time. Display-only. */
  connectedWalletProvider: string | null;
  /** ISO timestamp the user last successfully connected a wallet. */
  walletConnectedAt: string | null;
  /**
   * Stripe Connect Express account ID (`acct_*`). Null until the contributor
   * completes Stripe-hosted onboarding via /profile/payouts. We never store
   * bank credentials directly — Stripe holds the banking relationship; we
   * only retain the tokenized account reference.
   */
  stripeAccountId: string | null;
  /**
   * True when Stripe has confirmed the Express account is fully onboarded
   * (KYC complete, payouts enabled). Mirrors Stripe's `details_submitted` +
   * `payouts_enabled` flags. Synced via webhook.
   */
  stripePayoutsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * All pillars a user is active in, primary first. Convenience for match filters.
 */
export function userPillars(
  u: Pick<User, "primaryIndustry" | "secondaryIndustries"> | null | undefined,
): Industry[] {
  if (!u) return [];
  const all: Industry[] = [];
  if (u.primaryIndustry) all.push(u.primaryIndustry);
  for (const s of u.secondaryIndustries) {
    if (!all.includes(s)) all.push(s);
  }
  return all;
}

/**
 * Posture (locked 2026-04-27): the DM rail is a one-way send privilege.
 * Cooperative members and admins can compose direct messages to anyone
 * (including viewers, prospects, and partners). Recipients of any tier
 * can read what's sent to them and acknowledge it from /notifications,
 * but only members + admins can initiate. Non-members never get a
 * compose surface — keeps the cooperative voice gated to vetted senders
 * and stops the DM rail from becoming a backchannel for outsiders.
 *
 * Production swap: keep the same predicate; `User` shape stays stable.
 */
export function canSendDirectMessage(
  u: Pick<User, "membershipTier" | "isAdmin"> | null | undefined,
): boolean {
  if (!u) return false;
  return u.isAdmin || u.membershipTier === "member";
}

/**
 * True if the user is active in `industry` as either primary or secondary.
 * Use this for RFP/job matching instead of direct equality on a single field.
 */
export function userHasPillar(
  u: Pick<User, "primaryIndustry" | "secondaryIndustries"> | null | undefined,
  industry: Industry | null | undefined,
): boolean {
  if (!u || !industry) return false;
  if (u.primaryIndustry === industry) return true;
  return u.secondaryIndustries.includes(industry);
}

/**
 * HubSpot deal stage mirror. Synced via webhook from HubSpot's `deal.stage`
 * property. Contributors see it on their dashboard so they know where the
 * client is in the funnel without seeing PII. Drives no logic on our side —
 * it's purely a status indicator.
 */
export type HubspotStage =
  | "discovery"
  | "proposal_sent"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export const HUBSPOT_STAGE_LABELS: Record<HubspotStage, string> = {
  discovery: "Discovery",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  closed_won: "Closed-won",
  closed_lost: "Closed-lost",
};

export interface Project {
  id: string;
  title: string;
  description: string;
  industry: Industry;
  skillsRequired: string[];
  budget: string; // numeric(12,2)
  status: "open" | "in_progress" | "completed" | "cancelled";
  clientId: string;
  assignedMemberIds: string[];
  /**
   * Which surface owns this record:
   *   - "contract" → one-off external client work. Lives on /contracts.
   *   - "internal" → cooperative contributions / help wanted on our own
   *     initiatives. Lives on /projects.
   */
  kind: "contract" | "internal";
  isRfp: boolean;
  /**
   * When an external-client RFP was vetted by an admin and opened for member
   * bidding. Null = still in the admin intake queue. Internal co-op projects
   * (`kind="internal"`) are always implicitly approved — admins create them.
   */
  rfpApprovedAt: string | null;
  /**
   * Internal notes from the admin vetting pass — redaction reasons, routing
   * decisions, who to notify. Never shown to the client or contributors.
   */
  rfpAdminNote: string | null;
  /**
   * Mirror of the HubSpot deal stage. Null for internal projects (no deal).
   * Updated by the webhook handler at /api/hooks/hubspot/stage.
   */
  hubspotStage: HubspotStage | null;
  /**
   * HubSpot deal ID — kept for the webhook to find the row. Never shown to
   * contributors (could leak account-level info if combined with other data).
   */
  hubspotDealId: string | null;
  /**
   * Closed-contract revenue — the cash actually collected from the client.
   * Drives the 85/15 split engine when populated. Null while the contract
   * is open or before payment lands.
   */
  collectedRevenue: string | null;
  collectedAt: string | null;
  /**
   * Admins on this contract — users who share the 80%-of-commission admin
   * pool when the contract settles. This is "Admin" in the spreadsheet
   * sense (referrers, deal owners, anyone growing the business on this
   * deal), NOT platform admin permission. A contract can have any number
   * of admins; the admin pool is split evenly by default and overridable
   * at settlement.
   *
   * NOTE: a user can be both a contract admin AND a contributor (e.g. Rob
   * on the DCG GTM contract — he introduced the deal and also did delivery
   * work). The two pools are independent.
   */
  adminUserIds: string[];
  /**
   * Compensation structure — base + performance ceiling (locked 2026-06-29).
   *
   * Talent comp on external client engagements is structured as guaranteed
   * floor + earned ceiling, not flat above-asking. See `future-modern.md`
   * "Compensation structure" section for the full principle.
   *
   * `talentBaseAmount` — guaranteed floor (low end of talent's asking range
   *    or below, with consent). Released on standard milestone schedule.
   *    Stored as USD string to match Drizzle numeric(12,2). Null = not yet
   *    structured under base+bonus (legacy engagements predate the locked
   *    structure).
   *
   * `talentBonusAmount` — earnable ceiling (delta to upper-end-of-asking +
   *    any above-asking earnings, within the 85% talent allocation against
   *    engagement revenue). Released at engagement close IF the bonus gate
   *    clears. Stored as USD string. Null = no bonus tier on this contract.
   *
   * `bonusGate` — settlement-time gate config. Sandbox default is null,
   *    which the split engine treats as the canonical gate from memory:
   *    client rating ≥ 4 primary, PM 0.6 + peer 0.4 composite fallback at
   *    30 days, default-release on internal-procedural-failure.
   */
  talentBaseAmount: string | null;
  talentBonusAmount: string | null;
  bonusGate: BonusReleaseGate | null;
  /**
   * PM engagement rating captured by the account-owning admin at
   * settlement time. 1-5 scale, admin-only visibility. Feeds the
   * composite fallback when client rating is absent. Null until
   * captured.
   */
  pmEngagementRating: number | null;
  /**
   * Bonus-release decision status. Null = contract has no comp structure
   * (legacy / internal). "pending" = structure set, decision pending at
   * settlement. "released" = bonus paid to talent. "reclaimed" = bonus
   * moved to engagement recovery pool.
   */
  bonusDecision: BonusDecisionStatus | null;
  /** ISO timestamp the bonus decision was recorded. */
  bonusDecidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BonusDecisionStatus = "pending" | "released" | "reclaimed";

/**
 * Bonus-release gate config for a Project. Per locked memory in
 * `future-modern.md`, the canonical gate is:
 *   1. Client rating ≥ `clientRatingThreshold` (default 4 on 5-star scale)
 *      → release bonus.
 *   2. If no client rating within `silenceWindowDays` (default 30) →
 *      fallback to internal composite (PM rating × `pmWeight` + peer-review
 *      average × `peerWeight`). Composite ≥ `compositeThreshold` → release.
 *   3. If no client rating AND no internal signal → release by default
 *      (talent doesn't pay for FM's internal procedural failure).
 *
 * Per-contract overrides allowed but expected to be rare.
 */
export interface BonusReleaseGate {
  clientRatingThreshold: number; // default 4
  silenceWindowDays: number; // default 30
  pmWeight: number; // default 0.6
  peerWeight: number; // default 0.4
  compositeThreshold: number; // default 4 (same as client)
}

/**
 * Default bonus-release gate per the canonical memory lock.
 */
export const CANONICAL_BONUS_GATE: BonusReleaseGate = {
  clientRatingThreshold: 4,
  silenceWindowDays: 30,
  pmWeight: 0.6,
  peerWeight: 0.4,
  compositeThreshold: 4,
};

/**
 * Engagement Recovery Pool — destination ledger for reclaimed bonus when
 * the gate fails. Scoped to a single project. Drawable to pay corrective
 * hires for the same client engagement that disappointed. Residue at
 * engagement close folds back to treasury.
 *
 * Per locked memory: "we billed the upper end, this person didn't earn
 * their pay, so they got the minimum and we used the extra to hire someone
 * else." This ledger captures that extra.
 */
export interface EngagementRecoveryPool {
  id: string;
  projectId: string;
  /** USD reclaimed from unearned bonus. Numeric(12,2) shape. */
  balanceUsd: string;
  /** USD already drawn against the pool for corrective hires. */
  drawnUsd: string;
  /** Pool lifecycle. `open` = engagement still active; `closed` = residue
   *  folded back to treasury, no more draws permitted. */
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
}

/**
 * One row in the attribution ledger for a given contract. Records WHO did
 * WHAT, so compensation can be computed (or recomputed) at any time without
 * relying on memory. Append-only — corrections happen via offsetting entries,
 * never edits, so the historical record stays intact.
 *
 * Roles map to which payout pool the entry belongs to:
 *   - introducer    → ADMIN pool (referral commission). Suggests adding the
 *                     user to `Project.adminUserIds`.
 *   - contributor   → CONTRIBUTOR pool. Did substantive delivery work.
 *   - delivery_lead → CONTRIBUTOR pool. Owned coordination + final QA.
 *   - advisor       → ADMIN pool. Provided guidance/review/deal-side help
 *                     without owning a piece of the deliverable.
 *
 * `weight` is a 0–1 suggestion the revenue split engine uses as a starting
 * point for the contributor pool; the admin can adjust the actual share at
 * settlement. Admin-pool roles document the relationship but the actual
 * admin payout list is `Project.adminUserIds` (the spreadsheet's "Admin"
 * column), which the settle page seeds from these entries as a default.
 */
export type AttributionRole =
  | "introducer"
  | "contributor"
  | "delivery_lead"
  | "advisor";

export const ATTRIBUTION_ROLE_LABELS: Record<AttributionRole, string> = {
  introducer: "Introducer",
  contributor: "Contributor",
  delivery_lead: "Delivery lead",
  advisor: "Advisor",
};

/**
 * Which payout pool a given attribution role feeds. Contributor-pool roles
 * (delivery_lead, contributor) drive the 85% slice. Admin-pool roles
 * (introducer, advisor) suggest who should be on the contract's admin list
 * for the 80%-of-commission admin slice.
 */
export function rolePool(role: AttributionRole): "contributor" | "admin" {
  if (role === "delivery_lead" || role === "contributor") return "contributor";
  return "admin"; // introducer, advisor
}

export interface AttributionEntry {
  id: string;
  contractId: string;
  userId: string;
  role: AttributionRole;
  weight: number; // 0–1 default share suggestion
  notes: string | null;
  loggedBy: string; // admin userId who recorded the entry
  loggedAt: string;
}

/**
 * Result of running the 85 / 15 split engine on a closed contract.
 *
 * Three pools, mirroring the spreadsheet's settled-engagements model:
 *   - "contributor" → 85% of revenue. Goes to the people who delivered the
 *     work (seeded from attribution ledger entries with role
 *     `delivery_lead` / `contributor`).
 *   - "admin"       → 80% of the 15% commission (= 12% of revenue). Goes
 *     to the deal's admins — referrers, deal owners, anyone growing the
 *     business on this contract. Sourced from `Project.adminUserIds`.
 *     Even split by default, overridable. N admins supported.
 *   - "reserve"     → 20% of the 15% commission (= 3% of revenue). Auto-
 *     routed 50/50 between Treasury and the Liquidity Pool — the LP
 *     deposit is what manufactures token value (not market price), so it
 *     is structurally non-negotiable.
 *
 * Payout state is tracked per row so a failure on one recipient doesn't
 * block the others — Stripe Connect transfers are issued one at a time.
 */
export type SplitPool = "contributor" | "admin" | "reserve";

export type PayoutStatus = "pending" | "queued" | "sent" | "failed";

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: "Pending decision",
  queued: "Queued for transfer",
  sent: "Sent",
  failed: "Failed",
};

export interface RevenueSplit {
  id: string;
  contractId: string;
  recipientId: string;
  pool: SplitPool;
  /** Percentage of the pool this row receives. Stored as a string to mirror Drizzle numeric. */
  sharePct: string;
  /** Computed dollar amount at settlement time (pool size * sharePct / 100). */
  amount: string;
  /** True when the engine wrote this row automatically (e.g. the 20%-of-15% house reserve). */
  auto: boolean;
  decidedBy: string | null;
  decidedAt: string | null;
  payoutStatus: PayoutStatus;
  payoutSentAt: string | null;
  /** Stripe Connect transfer ID once the payout is dispatched. */
  stripeTransferId: string | null;
  notes: string | null;
}

/**
 * Magic-link proposal record. When an admin approves a QuoteSheet for a
 * client, we generate a signed token and send the client a link to a
 * read-only proposal view at /proposals/[token]. Tracking views lets us
 * surface engagement to the contributor without exposing PII.
 *
 * In production, `token` is a short-lived signed JWT or random ID with an
 * indexed lookup. In sandbox, it's just a random string.
 */
export interface ClientProposal {
  id: string;
  quoteSheetId: string;
  contractId: string;
  token: string;
  /** When the email actually went out (or "send simulated" in sandbox). */
  sentAt: string;
  /** Most recent view by the client. Null = unopened. */
  lastViewedAt: string | null;
  viewCount: number;
  expiresAt: string;
}

/**
 * A full-time (or part-time) employment posting. Distinct from a Project/Contract
 * — a Job is an ongoing role, not a scoped deliverable.
 */
export interface Job {
  id: string;
  title: string;
  description: string;
  industry: Industry;
  skillsRequired: string[];
  /** Compensation range, e.g. "$120k–$150k + equity" */
  compensation: string;
  /** "Remote", city name, or hybrid descriptor. */
  location: string;
  employmentType: "full-time" | "part-time" | "contract-to-hire";
  /** Who's hiring — Future Modern, a partner, or a portfolio client. */
  postedBy: string;
  /** Friendly label for `postedBy` (what members see on the card). */
  postedByLabel: string;
  status: "open" | "filled" | "closed";
  createdAt: string;
}

/**
 * A work sample in a member's portfolio. Two layers live on the same record:
 *
 *   1. The RAW submission the member uploaded (`title`, `description`,
 *      `projectUrl`, etc.) — this is what the member sees when they edit
 *      their portfolio, and what admins see in the review queue.
 *
 *   2. The PUBLISHED overlay that admins control (`publishedAt`,
 *      `publishedTitle`, `publishedDescription`, `hideProjectUrl`) — this is
 *      what renders on public surfaces like `/u/[handle]` and `/showcase`.
 *      Overlay fields default to null, meaning "use the raw value verbatim";
 *      admins override them to scrub personal branding, client names, or
 *      direct-contact vectors without destroying the member's original text.
 *
 * An item is only visible on public surfaces once `publishedAt` is set.
 * Rejections capture admin feedback without publishing.
 */
export interface PortfolioItem {
  id: string;
  userId: string;

  // Raw submission (what the member typed)
  title: string;
  description: string | null;
  imageUrl: string | null;
  projectUrl: string | null;
  industry: Industry;
  technologies: string[];
  featured: boolean;
  createdAt: string;

  // Admin publishing layer
  publishedAt: string | null;
  publishedTitle: string | null;
  publishedDescription: string | null;
  /**
   * When true, the external `projectUrl` is NOT rendered on public surfaces —
   * primary anti-circumvention lever. Members can still keep the URL on file
   * (useful for admins and attribution), but clients can't bypass the platform.
   */
  hideProjectUrl: boolean;
  rejectedAt: string | null;
  rejectionNote: string | null;
}

/**
 * Returns the version of a portfolio item that should render on public
 * surfaces. Returns null if the item has not been published.
 */
export function publicPortfolioView(item: PortfolioItem): {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  projectUrl: string | null;
  industry: Industry;
  technologies: string[];
  featured: boolean;
  publishedAt: string;
} | null {
  if (!item.publishedAt) return null;
  return {
    id: item.id,
    userId: item.userId,
    title: item.publishedTitle ?? item.title,
    description: item.publishedDescription ?? item.description,
    imageUrl: item.imageUrl,
    projectUrl: item.hideProjectUrl ? null : item.projectUrl,
    industry: item.industry,
    technologies: item.technologies,
    featured: item.featured,
    publishedAt: item.publishedAt,
  };
}

/**
 * A single line in a quote sheet — a sample of the contributor's work plus a
 * caption explaining why it's relevant to the RFP. Mirrors the columns in
 * URL Media's "service provider proposal" template.
 */
export interface QuoteSheetSample {
  url: string;
  caption: string;
}

/**
 * A contributor's structured response to an RFP.
 *
 * The member only submits the objective part (price, timeline, work samples,
 * plus an internal note to admin). Narrative positioning — strengths and
 * weaknesses — is admin-authored during review; the admin frames the
 * contributor for the client consistently across sheets rather than relying
 * on each member to undersell or overclaim themselves.
 *
 * Admin may also override `price`/`timeline` (via `approvedPrice` /
 * `approvedTimeline`) to scrub any direct-contact info the member included
 * inline. `null` overlay values mean "send the raw value." PII scrubbing is
 * never a rejection reason — admins just remove it in place.
 *
 * A sheet is only shown to the client once `approvedAt` is set.
 */
export interface QuoteSheet {
  id: string;
  projectId: string; // FK to Project (the RFP)
  userId: string; // FK to User (the contributor)

  // Member-submitted
  price: string; // free-form, allows "TBD", ranges, "$25,000 fixed"
  timeline: string; // free-form, e.g. "8 weeks" or "6–10 weeks"
  workSamples: QuoteSheetSample[];
  /**
   * Internal note from member to admin — context the client should NOT see
   * (e.g. "I know the lead from a past gig at DCG, can fast-track intro").
   */
  memberNote: string | null;
  createdAt: string;

  // Admin review layer
  approvedAt: string | null;
  /** PII-scrubbed overrides for member-submitted fields. Null = send raw. */
  approvedPrice: string | null;
  approvedTimeline: string | null;
  /**
   * Admin-authored positioning narratives. Optional — if an admin approves a
   * sheet without filling these, the client simply sees no strengths/
   * weaknesses block. Members never write here.
   */
  strengths: string | null;
  weaknesses: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
}

/**
 * Returns the version of a quote sheet that should be sent to the client.
 * Returns null if the sheet has not been admin-approved.
 */
export function clientQuoteView(sheet: QuoteSheet): {
  id: string;
  projectId: string;
  userId: string;
  price: string;
  timeline: string;
  strengths: string | null;
  weaknesses: string | null;
  workSamples: QuoteSheetSample[];
  approvedAt: string;
} | null {
  if (!sheet.approvedAt) return null;
  return {
    id: sheet.id,
    projectId: sheet.projectId,
    userId: sheet.userId,
    price: sheet.approvedPrice ?? sheet.price,
    timeline: sheet.approvedTimeline ?? sheet.timeline,
    strengths: sheet.strengths,
    weaknesses: sheet.weaknesses,
    workSamples: sheet.workSamples,
    approvedAt: sheet.approvedAt,
  };
}

export interface MembershipApplication {
  id: string;
  userId: string;
  requestedTier: Exclude<MembershipTier, "viewer">;
  currentTier: MembershipTier;
  status: "pending" | "approved" | "rejected";
  applicationData: Record<string, unknown>;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  amount: string; // numeric(18,8)
  type:
    | "project_completion"
    | "referral"
    | "collaboration"
    | "governance"
    | "admin_grant";
  projectId: string | null;
  description: string | null;
  transactionHash: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  External partners                                                  */
/*                                                                     */
/*  Three distinct partnership tiers, each rendered as its own section */
/*  on /partners. Source of truth is `mock-data/partners.ts` until a   */
/*  Payload collection lands.                                          */
/* ------------------------------------------------------------------ */

export interface ServicePartner {
  id: string;
  name: string;
  /** What they bring to FM engagements. */
  capabilities: string[];
  /**
   * Bare partner site (internal reference only — NOT rendered on the
   * public partners page). Public links go through `affiliateUrl` so
   * the cooperative captures attribution.
   */
  websiteUrl: string | null;
  /**
   * FM-controlled affiliate / referral / tracked URL. Rendered on the
   * public partners page when set. Drop a UTM-tagged or ref-coded link
   * here to get attribution credit on the click-through.
   */
  affiliateUrl: string | null;
  /** Which FM pillar this partner most aligns with. STEM / Creative Media / Professional Services. */
  pillarHint: Industry | null;
  /** Has FM and this org actually shipped together. */
  shippedTogether: boolean;
}

export interface EcosystemPartner {
  id: string;
  name: string;
  /** One-line role in the FM ecosystem. */
  role: string;
  /** Internal reference — not rendered. See `affiliateUrl`. */
  websiteUrl: string | null;
  /** FM-controlled affiliate link. Rendered when set. */
  affiliateUrl: string | null;
}

export interface ProductAffiliate {
  id: string;
  name: string;
  /** Internal reference — not rendered. See `affiliateUrl`. */
  websiteUrl: string | null;
  /** FM-controlled affiliate link. Rendered when set. */
  affiliateUrl: string | null;
}

// ──────────────────────────────────────────────────────────────────────
//  AR / AP layer (Phase 1.5 revised — Mercury-default, Stripe opt-in)
// ──────────────────────────────────────────────────────────────────────

/**
 * Payment rails the platform tracks. Mercury is the default for ACH and
 * wires (we mark received once Mercury's UI confirms the funds landed);
 * `cc_stripe` is the opt-in path that triggers a processor-fee markup;
 * `check` and `other` are escape hatches for one-off engagements where the
 * client insists on a specific arrangement.
 */
export type PaymentMethod =
  | "ach_mercury"
  | "wire_mercury"
  | "cc_stripe"
  | "check"
  | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ach_mercury: "ACH (Mercury)",
  wire_mercury: "Wire (Mercury)",
  cc_stripe: "Credit card (Stripe)",
  check: "Check",
  other: "Other",
};

/**
 * Lifecycle for AR (an invoice). `issued` and `partially_received` exist
 * because real engagements often pay on milestones — we want to credit the
 * cooperative for what's landed without pretending the whole invoice is
 * paid. `void` covers cancellations after issue.
 */
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_received"
  | "received"
  | "void";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_received: "Partially received",
  received: "Received",
  void: "Void",
};

export interface InvoiceLineItem {
  /** Stable ID so admin edits can target a specific row. */
  id: string;
  description: string;
  /** numeric(12,2) — kept as string to match Drizzle's numeric serialization. */
  amount: string;
  /**
   * True when the line is generated by the processing-fee calculator.
   * Used to lock the row in the UI (admins shouldn't edit it directly —
   * the calculator owns that math) and to surface it as the cause of the
   * markup to the client.
   */
  isProcessingFee?: boolean;
}

/**
 * Client invoice. The AR side of the ledger.
 *
 * Mercury-default flow:
 *   1. Admin issues the invoice → `status="issued"`, `paymentMethod` is
 *      one of `ach_mercury` / `wire_mercury`. Magic-link `clientToken` is
 *      generated for the client view (mirrors ClientProposal).
 *   2. Client pays out-of-band; admin marks `paidAmount` + `paidAt` +
 *      `mercuryReference`. If `paidAmount === total`, `status` flips to
 *      `received`; if less, `partially_received`.
 *   3. Settle page (Phase 1.6) reads the received amount as the engine's
 *      revenue input.
 *
 * CC-opt-in flow:
 *   - `acceptsCard=true`. The processing-fee calculator inserts a locked
 *     `isProcessingFee` line item that grosses up the subtotal so the
 *     cooperative nets the original amount. `paymentMethod` is `cc_stripe`.
 *   - On payment, Stripe webhook flips status; `mercuryReference` may be
 *     null and `stripePaymentIntentId` set instead.
 */
export interface Invoice {
  id: string;
  contractId: string;
  /** Friendly invoice number — e.g. "FM-2026-0042". */
  number: string;
  /** Magic-link token for the client-facing /invoices/[token] view. */
  clientToken: string;
  status: InvoiceStatus;
  /** Default rail. CC switches when `acceptsCard` is true. */
  paymentMethod: PaymentMethod;
  /**
   * True when the admin has opted this invoice into CC payment. Drives the
   * processing-fee line item generator and unlocks the Stripe path on the
   * magic-link view.
   */
  acceptsCard: boolean;
  lineItems: InvoiceLineItem[];
  /** numeric(12,2) — sum of non-processing-fee line items. */
  subtotal: string;
  /** numeric(12,2) — sum of processing-fee line items (0 unless acceptsCard). */
  processingFee: string;
  /** numeric(12,2) — subtotal + processingFee. */
  total: string;
  issuedAt: string | null; // null when status="draft"
  dueAt: string | null;
  paidAt: string | null;
  /** numeric(12,2) — total received so far across one or more payments. */
  paidAmount: string;
  /** Mercury transaction reference once funds land. Null on CC. */
  mercuryReference: string | null;
  /** Stripe Payment Intent ID once funds land via CC. Null on Mercury. */
  stripePaymentIntentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns the version of an Invoice safe to show on a client magic-link
 * view. Strips internal admin notes.
 */
export function clientInvoiceView(invoice: Invoice): Omit<Invoice, "notes"> {
  return {
    id: invoice.id,
    contractId: invoice.contractId,
    number: invoice.number,
    clientToken: invoice.clientToken,
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    acceptsCard: invoice.acceptsCard,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    processingFee: invoice.processingFee,
    total: invoice.total,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
    paidAmount: invoice.paidAmount,
    mercuryReference: invoice.mercuryReference,
    stripePaymentIntentId: invoice.stripePaymentIntentId,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

// ──────────────────────────────────────────────────────────────────────
//  Marketplace (Phase 2.1 sandbox preview)
//
//  Vetted contributors list products across five categories. Category
//  subdomains (men.build.store, saas.build.store, energy.build.store,
//  etc.) are all filtered views of the same products table. Checkout
//  will route through Stripe Connect with the 15% house cut as the
//  application fee when real services are wired — for now we render the
//  browse and seller-vetting surfaces against MOCK_PRODUCTS.
// ──────────────────────────────────────────────────────────────────────

export type MarketplaceCategory =
  | "goods"
  | "saas"
  | "energy"
  | "creative-services"
  | "clothing";

export const MARKETPLACE_CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  goods: "Goods",
  saas: "SaaS",
  energy: "Energy",
  "creative-services": "Creative services",
  clothing: "Clothing",
};

/** Maps each category to its planned subdomain for Phase 2.1. */
export const MARKETPLACE_SUBDOMAINS: Record<MarketplaceCategory, string> = {
  goods: "goods.build.store",
  saas: "saas.build.store",
  energy: "energy.build.store",
  "creative-services": "studio.build.store",
  clothing: "wear.build.store",
};

/* ------------------------------------------------------------------ */
/*  StoreCategory — user-facing browse taxonomy                        */
/*                                                                     */
/*  CMS-editable taxonomy distinct from `MarketplaceCategory` (which   */
/*  stays as internal routing metadata for subdomains).                */
/*                                                                     */
/*  Surfaces:                                                          */
/*    - Hover dropdown on the Store nav link (categories listed in     */
/*      `displayOrder`, only `isActive` shown).                        */
/*    - Filter chips on /store.                                        */
/*    - Per-category landing at /store?category=<slug>.                */
/*    - Admin CRUD at /admin/categories.                               */
/*                                                                     */
/*  Products carry `categorySlugs: string[]` so a single product can   */
/*  land under multiple browse categories (a guitar amp can sit in     */
/*  both "Hardware" and "Music"). Products keep their `category:       */
/*  MarketplaceCategory` for subdomain routing.                        */
/*                                                                     */
/*  REPLACE WITH: a Payload collection or a `store_categories` Drizzle */
/*  table when CMS lands. The shape on the wire stays the same — admin */
/*  CRUD migrates to Payload's admin UI, this app reads via the same   */
/*  helper functions.                                                  */
/* ------------------------------------------------------------------ */
export interface StoreCategory {
  id: string;
  /** URL-safe slug, e.g. "hardware". Used in /store?category=<slug>. */
  slug: string;
  /** Display name for the dropdown and chip, e.g. "Hardware". */
  name: string;
  /** Optional one-line description, surfaced on the per-category page. */
  description: string | null;
  /** Lower number renders earlier in the dropdown. */
  displayOrder: number;
  /** CMS toggle. Inactive categories don't render; their products still exist. */
  isActive: boolean;
  /**
   * Optional internal hint about which `MarketplaceCategory` (subdomain
   * vertical) this browse-category belongs to in production. Doesn't
   * filter products — products carry their own subdomain `category`.
   * Just helps admin reason about overlap.
   */
  vertical: MarketplaceCategory | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "archived"
  | "rejected";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  active: "Active",
  archived: "Archived",
  rejected: "Rejected",
};

export interface Product {
  id: string;
  sellerId: string; // User.id
  category: MarketplaceCategory;
  title: string;
  description: string;
  /** numeric(12,2) — stored as string to match Drizzle pattern. */
  price: string;
  currency: "USD";
  /** Null for services + pure-digital. Non-null for physical inventory. */
  inventoryCount: number | null;
  imageUrls: string[];
  tags: string[];
  /**
   * Browse-category slugs (StoreCategory.slug) the product appears under
   * on the user-facing store. Distinct from `category` (the internal
   * subdomain vertical). A product may belong to multiple browse
   * categories — e.g. a guitar amp under both "Hardware" and "Music".
   * Empty array = uncategorized; admin should fix.
   */
  categorySlugs: string[];
  status: ProductStatus;
  /** Admin note on rejection or pending review. Not shown to public. */
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Seller vetting application. Admin approves before the member can list
 * product in the requested categories. Stored separately from User so
 * the audit trail is append-only and so a member can apply for multiple
 * categories over time.
 */
export type SellerApplicationStatus = "pending" | "approved" | "rejected";

export const SELLER_APPLICATION_STATUS_LABELS: Record<
  SellerApplicationStatus,
  string
> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export interface SellerApplication {
  id: string;
  userId: string;
  requestedCategories: MarketplaceCategory[];
  pitch: string;
  status: SellerApplicationStatus;
  reviewedBy: string | null; // admin User.id
  reviewedAt: string | null;
  adminNote: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────
//  Whitelist (Phase 2.3 pre-launch sandbox)
//
//  Workers' cooperative posture: ACCESS IS NOT FOR SALE. Membership
//  and tier standing are exclusively earned (invitation, vetting,
//  contribution). The exclusivity is part of the value.
//
//  WhitelistTier rows in this module exist for two non-access purposes:
//
//   1. `isDonation: true`  → optional financial support of the
//      cooperative. Does NOT grant access, perks, or standing. 100% of
//      the donation routes to operating costs, the Liquidity Pool, and
//      the Treasury — no individual contributor share. We surface this
//      so people who want to back the work can, without compromising
//      the earned-access principle.
//
//   2. `isConsultation: true` → an external client booking a scoping
//      call for custom work. This is normal contract intake, not
//      access purchase.
//
//  Donations and consultations both run cash (Stripe) and crypto
//  (on-chain USDC) rails. The donation split bypasses the contributor
//  pool entirely — see whitelist-splits.ts.
// ──────────────────────────────────────────────────────────────────────

export type WhitelistRail = "cash" | "crypto";

export const WHITELIST_RAIL_LABELS: Record<WhitelistRail, string> = {
  cash: "Cash (USD · Stripe)",
  crypto: "Crypto (USDC · wallet)",
};

/**
 * Whitelist tier configuration. Two non-access shapes:
 *
 *   - `isDonation: true`     — optional financial support of the
 *     cooperative. Buyer gets a thank-you and a transparent breakdown
 *     of where the money lands. Does NOT grant access, perks, or
 *     standing. Donations bypass the contributor pool entirely.
 *
 *   - `isConsultation: true` — external client booking a scoping call
 *     for custom work. $0, routes to an intake form, becomes a normal
 *     contract intake.
 *
 * One row should set exactly one of these flags. Setting neither (or
 * both) is a config error — the page will render the row in the
 * donation lane with a warning in dev.
 */
export interface WhitelistTier {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  /** numeric(12,2) — stored as string. $0 for consultation tiers. */
  priceUsd: string;
  /** Total seats available. Null = unlimited (donation/consultation). */
  seatCap: number | null;
  /** Donation count or consultation request count — admin increments. */
  seatsClaimed: number;
  /** Accent color on the card + CTA. */
  accent: string;
  /**
   * Donation tier — voluntary support, no access perks. The split
   * engine (whitelist-splits.ts) routes 100% to ops/LP/Treasury with
   * no individual contributor share.
   */
  isDonation: boolean;
  /** Consultation tier routes to a scoping intake instead of checkout. */
  isConsultation: boolean;
  /**
   * Human-readable lines rendered as bullets. For donations these
   * describe where the money goes (NOT perks granted).
   */
  perks: string[];
  /** Open for contributions right now? Admin can flip. */
  active: boolean;
}

export type WhitelistPurchaseStatus =
  | "initiated"
  | "paid"
  | "split_distributed"
  | "refunded"
  | "failed";

export const WHITELIST_PURCHASE_STATUS_LABELS: Record<
  WhitelistPurchaseStatus,
  string
> = {
  initiated: "Initiated",
  paid: "Paid",
  split_distributed: "Split distributed",
  refunded: "Refunded",
  failed: "Failed",
};

/**
 * A single whitelist purchase. When paid, the split engine writes the
 * same contributor/admin/reserve rows we use on contract settlement:
 *   - contributor pool (85%) — routes to the deal owner who closed it
 *     (referrer or sales lead).
 *   - admin pool (12%) — operating share for the cooperative.
 *   - reserve pool (3%) — 50/50 Treasury + Liquidity Pool (non-negotiable).
 *
 * Cash purchases use Stripe payment intents; crypto purchases use an
 * on-chain tx hash on a USDC payment to the cooperative treasury
 * wallet. Either way, the split automation is identical.
 */
export interface WhitelistPurchase {
  id: string;
  tierId: string; // WhitelistTier.id
  buyerId: string | null; // User.id once a member claims; null before signup
  buyerEmail: string;
  buyerName: string;
  rail: WhitelistRail;
  /**
   * numeric(12,2) — donor-intended amount (matches the tier price).
   * The donation split engine (60/20/20) runs against THIS, never
   * against `amountUsd + processingFee`. Crypto donors pay this
   * exactly; cash (Stripe) donors pay `amountUsd + processingFee` so
   * the cooperative still routes the full amount.
   */
  amountUsd: string;
  /**
   * numeric(12,2) — Stripe markup added on cash rail to keep the
   * donation whole after Stripe's 2.9% + $0.30. "0.00" for crypto.
   * See `lib/payments-fees.ts`.
   */
  processingFee: string;
  /** Stripe payment intent ID, null for crypto. */
  stripePaymentIntentId: string | null;
  /** On-chain tx hash (USDC transfer), null for cash. */
  cryptoTxHash: string | null;
  /** Deal owner / referrer — gets the 85% contributor split. */
  referrerId: string | null;
  status: WhitelistPurchaseStatus;
  createdAt: string;
  paidAt: string | null;
  splitDistributedAt: string | null;
}

/**
 * Consultation intake — "book a scoping call for a custom build."
 * Admin triages in the whitelist queue, routes qualifying requests to
 * a quote sheet or project kickoff.
 */
export type ConsultationStatus =
  | "new"
  | "scheduled"
  | "quoted"
  | "won"
  | "declined";

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  new: "New",
  scheduled: "Scheduled",
  quoted: "Quoted",
  won: "Won",
  declined: "Declined",
};

export interface ConsultationRequest {
  id: string;
  tierId: string;
  contactName: string;
  contactEmail: string;
  company: string | null;
  /**
   * Short-form buckets. Drives initial triage (who on the cooperative
   * side picks this up).
   */
  scopeBuckets: Industry[];
  briefing: string;
  /** Estimated budget range (free-text). Optional. */
  budgetHint: string | null;
  status: ConsultationStatus;
  assignedTo: string | null; // admin User.id
  adminNote: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────
//  Mux content locker (Phase 2.2)
//
//  Members upload long-form work — case-study videos, performance reels,
//  process recordings, audio drops — that the cooperative gates by tier.
//  In production a real upload flow signs into Mux and returns a
//  playback ID; in the sandbox we let admins paste a URL placeholder
//  and the moderation queue is a status workflow over MOCK_MEDIA_ASSETS.
//
//  REPLACE WITH: a `media_assets` Postgres table + Mux upload pipeline.
//  Shapes here mirror what we'd query out of the future Drizzle schema.
// ──────────────────────────────────────────────────────────────────────

export type MediaAssetKind = "video" | "audio";

export const MEDIA_ASSET_KIND_LABELS: Record<MediaAssetKind, string> = {
  video: "Video",
  audio: "Audio",
};

/**
 * Tier gating for the content locker. We surface assets to the lowest
 * tier listed and up — i.e. an asset gated to "partner" is visible to
 * partners, members, and admins, but not prospects or signed-out viewers.
 * "viewer" = public clip (lives on the showcase too).
 */
export type MediaTierGate = MembershipTier;

export type MediaAssetStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export const MEDIA_ASSET_STATUS_LABELS: Record<MediaAssetStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

export interface MediaAsset {
  id: string;
  uploaderId: string; // User.id
  kind: MediaAssetKind;
  title: string;
  description: string;
  /** Industry pillar the asset belongs to — drives showcase routing. */
  industry: Industry;
  /**
   * Tier gate. Most beta assets are partner+ to give Members & Partners
   * something to talk about; we'll publish trailers to viewers later.
   */
  tierGate: MediaTierGate;
  /**
   * In production: Mux playback ID. In sandbox: an arbitrary URL the
   * uploader pasted (YouTube, Vimeo, Mux, etc.). The locker player
   * treats the field as a tagged URL and renders accordingly.
   */
  playbackUrl: string;
  /** Optional poster / thumbnail. */
  posterUrl: string | null;
  /** Free-form duration label, e.g. "12:04" or "2 hr 14 min". */
  duration: string | null;
  status: MediaAssetStatus;
  /** Admin moderation note — visible to uploader on rejection. */
  adminNote: string | null;
  reviewedBy: string | null; // admin User.id
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns true if a viewer at `tier` can see an asset gated to `gate`.
 * Used by the locker page to filter what each tier sees.
 */
export function canViewMediaAsset(
  viewerTier: MembershipTier,
  gate: MediaTierGate,
): boolean {
  const order: MembershipTier[] = ["viewer", "prospect", "partner", "member"];
  return order.indexOf(viewerTier) >= order.indexOf(gate);
}

// ──────────────────────────────────────────────────────────────────────
//  Marketplace orders + fulfillment (Phase 2.1 cont.)
//
//  A buyer purchases a Product, the order moves through fulfillment,
//  and the 85/12/3 split runs against the order subtotal at delivery
//  confirmation. Sandbox-only — real Stripe Connect plumbing is
//  Chibu-blocked. Shapes mirror the future Drizzle schema so the
//  swap-in is a one-liner.
// ──────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "placed"
  | "paid"
  | "fulfilling"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  paid: "Paid",
  fulfilling: "Fulfilling",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/**
 * Which transitions are valid from a given status. The seller dashboard
 * reads this to decide which buttons to render — no jumping from
 * "placed" straight to "delivered" without going through paid/shipped.
 */
export const ORDER_NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  placed: ["paid", "cancelled"],
  paid: ["fulfilling", "cancelled", "refunded"],
  fulfilling: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export interface OrderLineItem {
  productId: string;
  /** Snapshot title at order time so future product edits don't rewrite history. */
  titleSnapshot: string;
  /** numeric(12,2) — snapshot price. */
  unitPrice: string;
  quantity: number;
  /** numeric(12,2) — unitPrice * quantity. */
  lineTotal: string;
}

export interface Order {
  id: string;
  /** Friendly number — "BS-ORD-2026-0042". */
  number: string;
  buyerId: string | null; // User.id; null for guest checkout
  buyerEmail: string;
  buyerName: string;
  sellerId: string; // User.id of the seller (for now: single-seller orders)
  category: MarketplaceCategory;
  status: OrderStatus;
  items: OrderLineItem[];
  /** numeric(12,2) — sum of lineTotal. Splits run against this. */
  subtotal: string;
  /** numeric(12,2) — house cut (15% of subtotal in production). */
  houseFee: string;
  /**
   * numeric(12,2) — Stripe markup added to the buyer's bill so the
   * cooperative nets the full subtotal after Stripe takes its cut.
   * See `lib/payments-fees.ts`. Always present; "0.00" if a future
   * non-card rail is wired in.
   */
  processingFee: string;
  /** numeric(12,2) — what the buyer paid (subtotal + processingFee). */
  total: string;
  /** Stripe payment intent — null in sandbox. */
  stripePaymentIntentId: string | null;
  /** Mailing address as a single block (sandbox). */
  shippingAddress: string | null;
  trackingNumber: string | null;
  /** Internal note from seller / admin. Not shown to buyer. */
  internalNote: string | null;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** Set when the split engine has run against this order. */
  splitDistributedAt: string | null;
}

// ──────────────────────────────────────────────────────────────────────
//  Walkthrough + in-app feedback (Phase 2.3 beta-prep)
//
//  The walkthrough is a per-tier guided tour that helps a beta member
//  hit every surface they'd otherwise miss. Progress is tracked per
//  user so they can resume mid-tour. Each step ends with a contextual
//  feedback prompt that lands in the same FeedbackEntry table the
//  admin slices in /admin/feedback.
//
//  REPLACE WITH: a `walkthrough_progress` + `feedback_entries` Postgres
//  table in Phase 1. Shapes here mirror the future Drizzle schema.
// ──────────────────────────────────────────────────────────────────────

/**
 * One step in a tier's walkthrough. `surface` is the URL the step
 * sends the member to (or showcases inline); `pillar` is optional —
 * if set, the step is tagged for that pillar's lens (e.g. an artist-
 * specific portfolio tip vs. a STEM-specific RFP tip).
 */
export interface WalkthroughStep {
  id: string;
  /** Order within the tier's walkthrough. Lower = earlier. */
  order: number;
  /**
   * Walkthrough lane. Membership tiers (prospect/partner/member) gate
   * by the user's `membershipTier`. The `"admin"` lane is orthogonal —
   * surfaced to anyone with `isAdmin`, regardless of their tier — and
   * renders in its own "Admin tour" section under the tier walkthrough
   * so admins see both their tier path and the admin-only surfaces.
   */
  tier: Exclude<MembershipTier, "viewer"> | "admin";
  /** Optional pillar lens — null = shown to all pillars in this tier. */
  pillar: Industry | null;
  title: string;
  /** Short body shown in the step card before they click through. */
  blurb: string;
  /** Where to send the member when they click "Take me there". */
  surface: string;
  /** Friendly label for `surface` (what the button shows). */
  surfaceLabel: string;
  /** What they should look for / try on that surface. 1–3 bullets. */
  whatToTry: string[];
  /**
   * Optional feedback prompt — if set, the step renders an inline
   * mini feedback form after the "I tried it" CTA. If null, no
   * feedback is solicited (intro/outro steps).
   */
  feedbackPrompt: string | null;
}

/**
 * Per-user progress through the walkthrough. One row per (user, step).
 * `completedAt` null = not yet done. The walkthrough surface filters
 * by tier and renders steps in `order`, marking completed ones with a
 * checkmark and resuming at the first incomplete step.
 */
export interface WalkthroughProgress {
  id: string;
  userId: string;
  stepId: string;
  completedAt: string;
}

/**
 * Sentiment buckets for a feedback entry. Three buckets keeps the
 * triage cheap; admins can add a free-text note for nuance.
 */
export type FeedbackSentiment = "positive" | "confused" | "blocker";

export const FEEDBACK_SENTIMENT_LABELS: Record<FeedbackSentiment, string> = {
  positive: "Positive",
  confused: "Confused / wants more",
  blocker: "Blocker / broken",
};

/**
 * One submitted feedback entry. Captured from contextual prompts on
 * member surfaces or from walkthrough step completions. `surface` is
 * the URL the member was on when they submitted; `pillar` and `tier`
 * are denormalized from the user at submit time so historical slice-
 * and-dice keeps working even if the user changes pillars later.
 */
export type FeedbackStatus = "new" | "triaged" | "resolved";

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  triaged: "Triaged",
  resolved: "Resolved",
};

export interface FeedbackEntry {
  id: string;
  userId: string;
  /** URL/route the member was on. Drives the surface filter in admin. */
  surface: string;
  /** Friendly label for the surface (e.g. "Wallet"). */
  surfaceLabel: string;
  /** Optional walkthrough step this came from. Null = ad-hoc prompt. */
  walkthroughStepId: string | null;
  sentiment: FeedbackSentiment;
  note: string;
  /** Denormalized from the user at submit time. */
  pillar: Industry | null;
  tier: MembershipTier;
  status: FeedbackStatus;
  /** Admin reply / triage note. */
  adminNote: string | null;
  triagedBy: string | null; // admin User.id
  triagedAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Project applications                                               */
/* ------------------------------------------------------------------ */

/**
 * Where a member's application to join an internal project sits.
 *
 *   - "pending"   → submitted, waiting on admin review
 *   - "approved"  → admin accepted; the user has been added to
 *     `Project.assignedMemberIds` and can pick up the work
 *   - "rejected"  → admin declined (with optional adminNote)
 *   - "withdrawn" → the applicant pulled the request before a decision
 *
 * Internal projects use this lane (no client, no quote sheet — just
 * "I can take this on, here's why"). External CONTRACT projects keep
 * using QuoteSheet on /contracts because the client needs structured
 * pricing + a vetting pass.
 */
export type ProjectApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export const PROJECT_APPLICATION_STATUS_LABELS: Record<
  ProjectApplicationStatus,
  string
> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not this time",
  withdrawn: "Withdrawn",
};

/**
 * One member's application to contribute on an internal project.
 *
 * `proposedRole` is a free-text label the applicant picks (e.g. "lead
 * designer", "back-end pair", "voice direction") — not constrained to
 * the AttributionRole enum because internal contributions don't yet
 * need ledger-grade categorization.
 *
 * `pitch` is the substantive ask: what the member would contribute,
 * relevant past work, time they can commit. Surfaced verbatim to
 * admins on the review queue.
 *
 * `hoursPerWeek` is a soft commitment number used by admins for
 * capacity planning — not enforced.
 *
 * REPLACE WITH: `project_applications` Drizzle table. Approve action
 * runs in a transaction with the corresponding update to
 * `projects.assignedMemberIds`.
 */
export interface ProjectApplication {
  id: string;
  projectId: string;
  userId: string;
  proposedRole: string;
  pitch: string;
  /** Estimated weekly availability the applicant can commit. */
  hoursPerWeek: number;
  /** Optional URL to relevant past work (overrides their Profile portfolio link). */
  portfolioLink: string | null;
  status: ProjectApplicationStatus;
  /** Admin who approved/rejected. Null while pending or after withdraw. */
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Admin note shown to the applicant alongside the decision. */
  adminNote: string | null;
  /** When the applicant withdrew. Null unless status="withdrawn". */
  withdrawnAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Prospective contribution (Phase 2.8 sandbox, opened 2026-04-27)    */
/* ------------------------------------------------------------------ */

/**
 * Status lifecycle for an outside-the-cooperative contribution offer.
 *
 *   new        → just submitted, untouched
 *   contacted  → admin has reached out (email, intro call, etc.)
 *   converted  → resulted in a real engagement (member invite, project
 *                contributor add, contract bid pickup, etc.)
 *   dismissed  → not a fit; admin closes with a note
 */
export type ProspectiveContributionStatus =
  | "new"
  | "contacted"
  | "converted"
  | "dismissed";

export const PROSPECTIVE_CONTRIBUTION_STATUS_LABELS: Record<
  ProspectiveContributionStatus,
  string
> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  dismissed: "Dismissed",
};

/**
 * An offer to contribute on an internal project from someone WITHOUT
 * a cooperative account. The /whitelist Path 3 ("contribute to a
 * project") CTA lands them on /projects (publicly readable), they pick
 * a specific open initiative, and submit this form on /projects/[id].
 *
 * Posture: this is a triage signal, not an automatic seat at the table.
 * Admin reviews each row and decides whether to (a) reach out, (b) treat
 * it as a path to membership/talent application, or (c) close it. The
 * "contribute to a project" path is real, but standing still has to be
 * earned the same way it is for everyone else — see /whitelist for the
 * full posture.
 *
 * No userId field by design — submitters are unauthenticated. If a
 * logged-in member happens to use this form, gate them out at the page
 * level and route them to the proper /projects/[id] apply form instead.
 *
 * REPLACE WITH: `prospective_contributions` Drizzle table. Convert
 * action runs in a transaction with either a `users` insert + invite
 * email, or a `project_applications` row create on behalf of the
 * person once they sign in.
 */
export interface ProspectiveContribution {
  id: string;
  projectId: string;
  contactName: string;
  contactEmail: string;
  /** Free-text role label, same shape as ProjectApplication.proposedRole. */
  proposedRole: string;
  pitch: string;
  /** Soft availability number, 0 if blank. */
  hoursPerWeek: number;
  portfolioLink: string | null;
  status: ProspectiveContributionStatus;
  /** Admin who acted on the row. Null while status="new". */
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Admin note shown on the queue; never sent to the contributor automatically. */
  adminNote: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Peer review + customer feedback (Phase 2.7 sandbox)                */
/* ------------------------------------------------------------------ */

/**
 * Peer review of one cooperative member by another, fired when a
 * project (internal or external contract) lands in `status: "completed"`
 * AND the team had >1 contributor. One-person projects skip this rail
 * entirely — there is no peer to review.
 *
 * Anonymity posture (locked 2026-04-25): reviewee sees stars + prose
 * but never the reviewer's identity. Admin sees attribution for
 * accountability/calibration. Public-to-members surfaces only show the
 * aggregate.
 *
 * The four star fields are a short questionnaire — overall plus three
 * dimensions cooperators care about (collaboration, craft, reliability).
 * Aggregate display rolls them up into a single mean star score so the
 * profile surface stays scannable.
 *
 * REPLACE WITH: `peer_reviews` Drizzle table. Unique index on
 * (contextKind, contextId, reviewerId, revieweeId) so a reviewer can't
 * double-rate the same teammate on the same engagement.
 */
export type ReviewContextKind = "contract" | "internal_project";

export interface PeerReview {
  id: string;
  contextKind: ReviewContextKind;
  /** Project.id for both contract and internal_project contexts. */
  contextId: string;
  reviewerId: string;
  revieweeId: string;
  /** Overall 1–5. */
  stars: number;
  /** Sub-dimensions, all 1–5. */
  collaboration: number;
  craft: number;
  reliability: number;
  /** Free-text. Visible to reviewee + admin. */
  prose: string;
  createdAt: string;
}

/**
 * Customer feedback on a completed engagement — external contract or
 * marketplace order. Admin-gated by default; admin can selectively pull
 * a quote and publish it as a testimonial on the contributor/seller's
 * public-to-members profile.
 *
 * Customer side: contracts get a magic-link surface (no auth — the
 * customer never had a /signin); marketplace orders use the existing
 * order detail page when the buyer has an account, magic-link otherwise.
 *
 * REPLACE WITH: `customer_feedback` Drizzle table. `published_quote`
 * lives there too so the testimonial source is traceable.
 */
export type CustomerFeedbackContextKind = "contract" | "marketplace_order";

/**
 * How the customer consents to being attributed if a quote is published
 * externally (testimonial on /u/[handle], Google Review starter, marketing
 * pull-quote, etc.). Default-deny: if the field is missing on a row,
 * admin UI must treat it as `internal_only`.
 */
export type AttributionConsent =
  | "name_and_org"
  | "org_only"
  | "anonymized"
  | "internal_only";

export const ATTRIBUTION_CONSENT_LABELS: Record<AttributionConsent, string> = {
  name_and_org: "Name + organization",
  org_only: "Organization only",
  anonymized: "Anonymized (\"a client\")",
  internal_only: "Internal only — do not publish",
};

/**
 * Customer's stated willingness to leave a public Google Review.
 * `yes_send_link` queues a follow-up email; admin verifies and personalizes
 * before the queued send fires.
 */
export type GoogleReviewOptIn = "yes_send_link" | "ask_me_later" | "no";

export const GOOGLE_REVIEW_OPTIN_LABELS: Record<GoogleReviewOptIn, string> = {
  yes_send_link: "Yes, send the link",
  ask_me_later: "Ask me again in a few weeks",
  no: "No",
};

/**
 * Tracks the state of the Google Review follow-up email for a feedback row
 * where the customer opted in. `pending_review` is the default after submit
 * — admin verifies before the send fires. `sent` flips when the email goes
 * out (or is queued for the production Postmark/Resend infra). `declined`
 * is the admin's escape hatch if the prose isn't quote-worthy after all.
 */
export type GoogleReviewFollowupStatus =
  | "pending_review"
  | "sent"
  | "declined";

export const GOOGLE_REVIEW_FOLLOWUP_LABELS: Record<
  GoogleReviewFollowupStatus,
  string
> = {
  pending_review: "Pending admin review",
  sent: "Follow-up sent",
  declined: "Declined by admin",
};

export interface CustomerFeedback {
  id: string;
  contextKind: CustomerFeedbackContextKind;
  /** Project.id (contract) or Order.id (marketplace_order). */
  contextId: string;
  customerName: string;
  customerEmail: string;
  /** Overall 1–5. */
  overallStars: number;
  /** Sub-dimensions, all 1–5. */
  metExpectations: number;
  communication: number;
  /** Honest "would you hire/buy again?" boolean. */
  wouldHireAgain: boolean;
  prose: string;
  /**
   * Optional contributor recognition. Customer names someone whose work
   * stood out so admin can land attribution on the right person when a
   * quote gets promoted. Free text — admin reconciles to a User row.
   */
  contributorShoutout: string | null;
  /**
   * Customer consent for external attribution. Default-deny: rows missing
   * this field must be treated as `internal_only` by admin UI.
   */
  attributionConsent: AttributionConsent | null;
  /**
   * Customer's stated willingness to leave a public Google Review.
   * Drives whether the follow-up rail surfaces a "send the link" button.
   */
  googleReviewOptIn: GoogleReviewOptIn | null;
  /**
   * State of the Google Review follow-up email for opted-in rows. Null
   * when the customer didn't opt in.
   */
  googleReviewFollowupStatus: GoogleReviewFollowupStatus | null;
  /** ISO timestamp the follow-up email actually went out. */
  googleReviewFollowupSentAt: string | null;
  /**
   * Admin gate: null until promoted. When set, the testimonial appears
   * on the relevant contributor / seller's public-to-members profile.
   */
  publishedAt: string | null;
  /**
   * The single quote admin chose to publish. May be a substring of
   * `prose` after PII scrub, never longer than the original.
   */
  publishedQuote: string | null;
  /**
   * Which contributor's profile gets the testimonial. For contracts
   * with multiple contributors, admin picks one or fans to all. Null
   * until published.
   */
  publishedForUserId: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Artist EPK (Electronic Press Kit)                                 */
/* ------------------------------------------------------------------ */

/**
 * EPKs follow the same self-managed-then-curated pattern as memberships,
 * project applications, sellers, etc. Artist edits a draft → submits for
 * admin review → admin approves (and User.profileMode flips to "epk") OR
 * sends back with revision notes. Re-submission resets to "submitted".
 *
 * `published` is the only state that renders on `/u/[handle]` to public
 * viewers. `needs_revision` keeps the previously published EPK live (if
 * any) while the artist iterates on the next version — same posture as
 * marketplace product edits.
 */
export type ArtistEpkStatus =
  | "draft"
  | "submitted"
  | "published"
  | "needs_revision";

export const ARTIST_EPK_STATUS_LABELS: Record<ArtistEpkStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  published: "Published",
  needs_revision: "Needs revision",
};

/**
 * A single embedded work — music release, music video, NFT drop, etc.
 * `embedUrl` is whatever the artist pastes; the renderer detects the
 * platform from the host (audius.co, catalog.works, market.zora.co,
 * youtube.com, bandcamp.com, glass.xyz) to pick an iframe + thumbnail
 * strategy. `contractAddress` is set for on-chain releases so the
 * cooperative-side surfaces can deep-link to chain explorers later.
 */
export interface FeaturedWorkEntry {
  id: string;
  title: string;
  embedUrl: string;
  /** Detected from host or selected explicitly when host is ambiguous. */
  platform:
    | "audius"
    | "catalog"
    | "zora"
    | "youtube"
    | "bandcamp"
    | "glass"
    | "soundcloud"
    | "spotify"
    | "vimeo"
    | "other";
  releaseDate: string | null;
  /** ERC-721/ERC-6551/etc. contract address when the release is on-chain. */
  contractAddress: string | null;
  /** Optional one-liner that surfaces under the title in the EPK card. */
  context: string | null;
}

/**
 * A press hit — pull quote + outlet + source URL. Hand-curated; admin
 * scrubs anything misattributed during the approval pass. Logos are
 * derived from outlet name when the renderer recognizes it (Needle Drop,
 * KQED, Complex, Coinbase, etc.); unknown outlets fall back to a text
 * tag rather than a missing image.
 */
export interface PressClip {
  id: string;
  outlet: string;
  quote: string;
  url: string;
  date: string | null;
}

/**
 * Onesheet-style platform metrics block. Each metric is captured with a
 * source-of-truth tag + a snapshot timestamp so admins can spot stale
 * numbers. Production swap pulls these from a daily metrics-refresh
 * worker (Spotify for Artists API, Audius public API, Apple Music for
 * Artists, social platform endpoints, on-chain indexers). Sandbox keeps
 * them artist-editable so we can seed real values from screenshots.
 */
export interface ArtistMetricSnapshot {
  /** Platform / data source for this metric. */
  platform:
    | "spotify"
    | "audius"
    | "apple_music"
    | "soundcloud"
    | "bandcamp"
    | "youtube"
    | "tiktok"
    | "instagram"
    | "twitter"
    | "twitch"
    | "discord"
    | "opensea"
    | "zora"
    | "catalog"
    | "sound_xyz"
    | "foundation"
    | "rarible"
    | "other";
  /** What the number represents. Free text; keep it Onesheet-short. */
  metric: string;
  /** Display value. Pre-formatted so commas / k / M shorthand stay. */
  value: string;
  /** ISO timestamp the snapshot was captured. */
  capturedAt: string;
}

/**
 * Web3 marketplace presence. Hand-curated until the production indexer
 * is in place. Used to deep-link from the EPK to the artist's
 * marketplace storefront so collectors hit live listings.
 */
export interface Web3MarketplaceProfile {
  platform:
    | "opensea"
    | "zora"
    | "catalog"
    | "sound_xyz"
    | "foundation"
    | "rarible"
    | "manifold"
    | "objkt"
    | "other";
  /** Profile / storefront URL on that marketplace. */
  url: string;
  /** Display handle on that marketplace (without leading @). */
  handle: string | null;
  /** ERC-721/1155 contract for a primary collection, when relevant. */
  contractAddress: string | null;
  /** Free-text role: collection, single editions, curator, etc. */
  context: string | null;
}

/**
 * Social handle row. Distinct from `ArtistMetricSnapshot` — this is the
 * profile pointer; the snapshot is the metric. Both can coexist (the
 * link plus the follower count).
 */
export interface ArtistSocialHandle {
  platform:
    | "instagram"
    | "twitter"
    | "tiktok"
    | "youtube"
    | "twitch"
    | "discord"
    | "audius"
    | "spotify"
    | "soundcloud"
    | "apple_music"
    | "bandcamp"
    | "linktree"
    | "personal_site"
    | "other";
  url: string;
  handle: string | null;
}

export interface ArtistEpk {
  /** One EPK per user. PK on userId. */
  userId: string;
  status: ArtistEpkStatus;
  /** Hero image displayed at the top of the EPK. Press-photo or cover art. */
  heroImageUrl: string | null;
  /** One-liner under the name. "Rapper · Producer · NYC", etc. */
  tagline: string | null;
  /** EPK card bio — short. Renders alongside featured work above the fold. */
  bioShort: string;
  /** Optional long-form bio for the deeper read. */
  bioLong: string | null;
  featuredWork: FeaturedWorkEntry[];
  press: PressClip[];
  /** Hand-written highlight bullets. ("HEEMS DRAKE OBAMA covered by The Needle Drop.") */
  trackRecord: string[];
  /**
   * Social + DSP profile handles. Links only. For follower counts and
   * monthly listeners, see `metrics`.
   */
  socialHandles: ArtistSocialHandle[];
  /**
   * Web3 marketplace profiles. Audius is treated as both a streaming
   * platform (handle + monthly listeners metric) and a music-NFT
   * marketplace (storefront), so it can appear in both lists.
   */
  web3Profiles: Web3MarketplaceProfile[];
  /**
   * Onesheet-style metrics block. Spotify monthly listeners, Audius
   * followers, OpenSea volume, TikTok followers, etc. Treated as a
   * snapshot — admins refresh as they go.
   */
  metrics: ArtistMetricSnapshot[];
  /**
   * One-line note shown to bookers / clients above the booking CTA so
   * they can pre-qualify themselves. ("Booking via Future Modern only,
   * no direct DMs.") Optional.
   */
  bookingNote: string | null;
  /** ISO timestamp the artist last submitted this EPK for review. */
  submittedAt: string | null;
  /** ISO timestamp admin most recently approved + published this EPK. */
  publishedAt: string | null;
  /** Admin note attached when sending the EPK back for revision. */
  adminRevisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

/**
 * The kinds of events that surface in /notifications. Each maps to a
 * specific feedback rail (order, contract, invoice, etc.) so the UI
 * can render an icon + a deep link without a switch on the message.
 */
export type NotificationKind =
  | "order_status"
  | "order_tracking"
  | "split_distributed"
  | "contract_stage"
  | "invoice_received"
  | "rfp_status"
  | "membership_decision"
  | "seller_application"
  | "whitelist_decision"
  | "direct_message"
  | "project_application"
  | "project_application_decision"
  | "prospective_contribution"
  | "peer_review_requested"
  | "customer_feedback_received"
  | "customer_review_optin"
  | "testimonial_published"
  | "epk_submitted"
  | "epk_published"
  | "epk_revision_requested"
  | "milestone_due_soon"
  | "milestone_overdue"
  | "milestone_status_changed"
  | "milestone_blocked";

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  order_status: "Order update",
  order_tracking: "Tracking added",
  split_distributed: "Split distributed",
  contract_stage: "Contract stage",
  invoice_received: "Invoice received",
  rfp_status: "RFP update",
  membership_decision: "Membership",
  seller_application: "Seller application",
  whitelist_decision: "Whitelist",
  direct_message: "Direct message",
  project_application: "Project application",
  project_application_decision: "Project decision",
  prospective_contribution: "Outside contributor",
  peer_review_requested: "Peer review",
  customer_feedback_received: "Customer feedback",
  customer_review_optin: "Google review opt-in",
  testimonial_published: "Testimonial",
  epk_submitted: "EPK submitted",
  epk_published: "EPK published",
  epk_revision_requested: "EPK revision requested",
  milestone_due_soon: "Milestone due soon",
  milestone_overdue: "Milestone overdue",
  milestone_status_changed: "Milestone status",
  milestone_blocked: "Milestone blocked",
};

/* ------------------------------------------------------------------ */
/*  Project milestones (Domino's-tracker style)                        */
/*                                                                     */
/*  Per-project ordered list of milestones with owners, due dates, and */
/*  status. Drives three surfaces:                                     */
/*    1. Admin PM view at /admin/contracts/[id]/tracker — full CRUD.   */
/*    2. Public client view at /contracts/[id]/tracker?token=... —    */
/*       read-only Domino's-style progress strip with current state.  */
/*    3. Talent view inline on /projects/[id] — owner can flip status */
/*       and flag blockers on their own milestones.                    */
/*                                                                     */
/*  Sweep cadence (admin manual button OR cron in production): looks  */
/*  for milestones due within DUE_SOON_DAYS and fires `milestone_due_  */
/*  soon` to the owner; flips overdue rows and fans `milestone_       */
/*  overdue` to admins.                                               */
/* ------------------------------------------------------------------ */

export type MilestoneStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed";

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

export interface ProjectMilestone {
  id: string;
  projectId: string;
  /** Display order in the tracker strip. Lower = earlier. */
  sequence: number;
  title: string;
  description: string | null;
  /** Owner. Usually a talent on the assignedMemberIds list. */
  ownerUserId: string;
  /** ISO date the milestone is due. */
  dueAt: string;
  status: MilestoneStatus;
  /** Filled when status === "blocked"; admin clears on resolve. */
  blockerNote: string | null;
  /** ISO timestamp when the milestone hit status "completed". */
  completedAt: string | null;
  /** Last time we fired a `milestone_due_soon` for this row (debounce). */
  lastDueSoonNoticeAt: string | null;
  /** Last time we flipped to overdue (debounce). */
  lastOverdueNoticeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Default window in days that triggers `milestone_due_soon` on sweep. */
export const MILESTONE_DUE_SOON_DAYS = 3;

/**
 * Single inbox entry for a member. The `href` field is the canonical
 * route the user should land on when clicking through; the renderer
 * can use kind to pick the icon. `readAt` is null until acknowledged.
 *
 * Production swap: a `notifications` table written by the same server
 * actions that mutate orders/contracts/etc. Sandbox writes nothing
 * dynamic — the seed list is enough to exercise the surface.
 */
export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  /** ISO timestamp the event happened. Sorts the inbox newest-first. */
  createdAt: string;
  /** ISO timestamp the user acknowledged the entry. Null = unread. */
  readAt: string | null;
}

/* --------------------------------------------------------------------
 * Live chat — visitor ↔ admin.
 *
 * Anonymous public-page widget. Visitor identifies once with name +
 * email, gets a `visitorToken` cookie, and converses with admin from
 * inside the platform. SSE pushes updates both directions; visitor
 * sends via POST, admin replies from /admin/chat.
 *
 * Note on the messaging-posture rule: admin DMs to members have NO
 * reply lane by design (circumvention vector). Visitor↔admin is a
 * different lane — visitors aren't members yet, so there's nothing to
 * circumvent toward. This is the FIRST reply-able conversation
 * surface in the codebase; member-side equivalents are intentionally
 * NOT included here (deferred per messaging-posture memory).
 *
 * REPLACE WITH: Drizzle `chat_threads` + `chat_messages` tables.
 * Cross-instance fanout via Postgres LISTEN/NOTIFY (Neon supports
 * it). Single-process sandbox uses an in-memory EventEmitter.
 * -------------------------------------------------------------------- */

export type ChatThreadStatus = "open" | "closed";

export interface ChatThread {
  id: string;
  /** Random UUID stored in a `chat_visitor_token` cookie. The visitor's
   *  re-identification key — never expose to other visitors. */
  visitorToken: string;
  visitorName: string;
  visitorEmail: string;
  status: ChatThreadStatus;
  /** Admin user id who picked up the thread, or null while unclaimed. */
  assignedAdminId: string | null;
  /** Admin-only note for triage. */
  adminNote: string | null;
  createdAt: string;
  /** ISO timestamp of the most recent message in either direction.
   *  Sorts the admin queue and drives `unread` math. */
  lastMessageAt: string;
  /** Last time admin opened the thread — drives the visitor-side
   *  "unread by admin" indicator and the admin-side queue badge. */
  adminLastReadAt: string | null;
  /** Last time visitor opened the thread — drives the admin's
   *  "visitor saw your reply" indicator. */
  visitorLastReadAt: string | null;
}

export type ChatSender = "visitor" | "admin";

export interface ChatMessage {
  id: string;
  threadId: string;
  sender: ChatSender;
  /** Admin user id when sender = "admin". Null for visitor messages. */
  senderId: string | null;
  body: string;
  createdAt: string;
}

export const CHAT_THREAD_STATUS_LABELS: Record<ChatThreadStatus, string> = {
  open: "Open",
  closed: "Closed",
};

/* ------------------------------------------------------------------ */
/*  Unified inbound submissions queue                                  */
/*                                                                     */
/*  Every public-facing form / surface pushes a row here so admins     */
/*  have a single place to see what's incoming. Drill-in links route   */
/*  to the deep-typed admin surface (RFP, quote, application, chat).   */
/*                                                                     */
/*  REPLACE WITH: `inbound_submissions` Drizzle table. Each writer     */
/*  (signup actions, RFP intake, chat creation, partner intake) gains  */
/*  a transactional insert in the same call where it writes its own    */
/*  domain row.                                                        */
/* ------------------------------------------------------------------ */

export type InboundSubmissionKind =
  | "hire_talent_signup"
  | "build_team_signup"
  | "join_talent_signup"
  | "rfp_intake"
  | "custom_quote_request"
  | "partner_application"
  | "chat_inquiry"
  | "store_inquiry"
  | "other";

export const INBOUND_SUBMISSION_KIND_LABELS: Record<InboundSubmissionKind, string> = {
  hire_talent_signup: "Hire talent signup",
  build_team_signup: "$BUILD a team signup",
  join_talent_signup: "Join as talent",
  rfp_intake: "RFP intake",
  custom_quote_request: "Custom quote request",
  partner_application: "Partner application",
  chat_inquiry: "Live chat inquiry",
  store_inquiry: "Store inquiry",
  other: "Other",
};

export type InboundSubmissionStatus =
  | "new"
  | "in_triage"
  | "needs_info"
  | "converted"
  | "closed_no_action";

export const INBOUND_SUBMISSION_STATUS_LABELS: Record<InboundSubmissionStatus, string> = {
  new: "New",
  in_triage: "In triage",
  needs_info: "Needs info",
  converted: "Converted",
  closed_no_action: "Closed",
};

/**
 * Unified inbound record. Each row is the canonical pointer for one
 * submission — the deep-typed record (Project, Quote, Application,
 * ChatThread) is referenced by `deepLinkHref` so admins can drill in.
 *
 * `source` matches the form / surface that created the row. Aggregated
 * derivations (e.g., RFP rows projected from MOCK_PROJECTS) set
 * `derived: true` so admins know the canonical write happened
 * elsewhere.
 */
export interface InboundSubmission {
  id: string;
  kind: InboundSubmissionKind;
  status: InboundSubmissionStatus;
  /** Display title — one-line summary the queue shows. */
  title: string;
  /** Submitter contact summary, e.g. "Maya Lin <maya@example.com>". */
  submitter: string;
  /** Submitter email when known. Drives reply-to in the admin view. */
  submitterEmail: string | null;
  /** Submitter company / org when known. */
  submitterCompany: string | null;
  /** Pillars relevant to this submission. Empty for non-pillar submissions. */
  pillarTags: Industry[];
  /** Hashtag-ish keywords pulled from the submission body — drives
   *  semantic match in `lib/talent-match.ts`. */
  keywordTags: string[];
  /** Long-form context the admin sees first when triaging. */
  body: string;
  /** Files attached (sandbox = metadata only). */
  attachments: Array<{ name: string; size: number; type: string }>;
  /** Admin id currently assigned, or null. */
  assignedAdminId: string | null;
  /** Internal triage note, admin-only. */
  triageNote: string | null;
  /** Deep-link to the typed admin surface for this submission. */
  deepLinkHref: string | null;
  /** True when this row was projected from another canonical store. */
  derived: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  MVP Score — cooperative compliance + recognition instrument        */
/*                                                                     */
/*  Full architectural memo lives in `future-modern.md` "MVP Score"    */
/*  section. Key contracts re-stated here so this file is self-        */
/*  documenting:                                                       */
/*                                                                     */
/*    - Single OVR 0-99, weighted average of seven sub-ratings.        */
/*    - 12-month rolling window; last 3 months weighted 2x in compute. */
/*    - Compliance penalty: -9 OVR per violation for 90 days, stacks.  */
/*    - Threshold ladder gates Champion's Court (top 10% AND ≥ 90),    */
/*      Future Modernist candidacy (80-89), Partner→Member promotion   */
/*      eligibility (75+ sustained), Member good standing (70-79),     */
/*      probation/removal review (65-70), accelerated removal (<65).   */
/*    - Visibility: self always, peer Members see OVR + violation      */
/*      trail (not sub-breakdown), admin sees everything, public no.   */
/*    - Recompute cadence: daily compute, weekly publish (frozen).     */
/*                                                                     */
/*  Sandbox computation is a deterministic stub against seeded inputs. */
/*  Production swap rebuilds from real attribution / peer review /     */
/*  client rating / milestone-hit data on the daily refresh job.       */
/* ------------------------------------------------------------------ */

/**
 * Sub-rating categories. Each scored 0-99; rolled into OVR via
 * `MVP_WEIGHTS` (see `lib/mvp-score.ts`).
 */
export type MvpSubRating =
  | "quality" // peer craft + client rating + brand-fit
  | "outcomes" // bonus-gate clear rate + attribution share
  | "reliability" // milestone-hit + deadline + minutes completeness
  | "hustle" // inbound response time + brief acceptance + volunteer
  | "collaboration" // peer collaboration sub-score
  | "attendance" // meeting attendance once minutes rail is live
  | "referrals_bd"; // referrer attributions converted to revenue

export const MVP_SUB_RATING_LABELS: Record<MvpSubRating, string> = {
  quality: "Quality",
  outcomes: "Outcomes",
  reliability: "Reliability",
  hustle: "Hustle",
  collaboration: "Collaboration",
  attendance: "Attendance",
  referrals_bd: "Referrals / BD",
};

/**
 * One stacked compliance penalty row. Each violation = -9 OVR for 90 days
 * from `appliedAt`. Penalties roll off independently. Stacks allowed.
 *
 * `reason` is admin-facing free-text; not surfaced to peers (the OVR drop
 * + count of active penalties is the peer-visible signal, per locked
 * visibility rules).
 */
export interface MvpCompliancePenalty {
  id: string;
  userId: string;
  appliedAt: string;
  /** Auto-computed: appliedAt + 90 days. Penalty inactive after this. */
  expiresAt: string;
  /** Always -9 in the canonical mechanic; field kept for future tuning. */
  ovrImpact: number;
  reason: string;
}

/**
 * MVP Score snapshot for a user, published weekly. Computed daily under
 * the hood from sub-rating inputs; the publish step freezes the score
 * for the week so cards don't jitter hourly.
 *
 * Provisional state: new Members start in "good standing — building
 * track record" mode rather than at a default OVR (default-99 inflates
 * unearned standing; default-0 punishes the act of being new). While
 * provisional, the threshold ladder doesn't apply (no Champion's Court
 * eligibility, no probation/removal review), compliance penalties don't
 * fire, and the talent-match scorer treats them at neutral 1.0
 * multiplier. Sub-ratings can still accumulate underneath; admin
 * promotes the member off provisional once they have enough signal
 * (~3 completed engagements + 2 peer reviews received in production;
 * admin button in sandbox).
 */
export interface MvpScore {
  userId: string;
  /** Composite 0-99. Computed from `subRatings` via `MVP_WEIGHTS`, then
   *  reduced by active compliance penalties. Not surfaced while
   *  `isProvisional === true`. */
  ovr: number;
  subRatings: Record<MvpSubRating, number>;
  /** Active penalties currently dragging OVR down. Empty array = clean. */
  activePenalties: MvpCompliancePenalty[];
  /** Period window the inputs were drawn from (rolling 12 months). */
  periodStart: string;
  periodEnd: string;
  /** When this snapshot was published. Frozen for the week. */
  publishedAt: string;
  /** Provisional flag. True = new Member, "good standing" surface only,
   *  no band / OVR / Court eligibility. False = scored standing applies. */
  isProvisional: boolean;
}

/**
 * Threshold bands for the MVP Score ladder. Champion's Court additionally
 * requires top-10% rank among Members; this enum captures only the OVR
 * gating.
 */
export type MvpStandingBand =
  | "champions_court_eligible" // OVR ≥ 90 (top 10% gate applied at recognition surface)
  | "future_modernist_pool" // 80-89
  | "promotion_eligible" // 75-79 sustained
  | "good_standing" // 70-79
  | "probation_review" // 65-70
  | "removal_accelerated"; // <65

export const MVP_STANDING_LABELS: Record<MvpStandingBand, string> = {
  champions_court_eligible: "Champion's Court eligible",
  future_modernist_pool: "Future Modernist pool",
  promotion_eligible: "Promotion eligible",
  good_standing: "Good standing",
  probation_review: "Probation / removal review",
  removal_accelerated: "Removal accelerated",
};

/**
 * Future Modernist recognition — periodic spotlight selected from the
 * MVP shortlist. Monthly winners + annual Constellation cohort, per
 * locked recognition rails in `future-modern.md`.
 *
 * Selection mechanism per locked phasing:
 *   Phase 1 (now)  : metric-driven shortlist (top 5 OVR in period) +
 *                    admin pick with editorial narrative.
 *   Phase 2 (later): same shortlist, Member vote replaces admin pick.
 *                    Member-count gated (~15-25 voting Members threshold).
 */
export type FutureModernistPeriodKind = "month" | "year";

export interface FutureModernistRecognition {
  id: string;
  userId: string;
  periodKind: FutureModernistPeriodKind;
  /** Display label for the period, e.g. "June 2026" or "2026". */
  periodLabel: string;
  /** Canonical period key for uniqueness — e.g. "2026-06" or "2026". */
  periodKey: string;
  /** Admin-authored narrative shown alongside the recognition. */
  narrative: string;
  /** Admin who selected — supports the upcoming vote-replaces-admin
   *  phasing without schema change. */
  selectedByUserId: string;
  selectedAt: string;
}
