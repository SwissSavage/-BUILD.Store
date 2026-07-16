/**
 * Drizzle schema — canonical shape mirroring `src/lib/types.ts`.
 *
 * Design conventions:
 *   - Table names are snake_case Postgres-native; TypeScript field names
 *     mirror the interface exactly so query results shape 1:1 to the
 *     domain interfaces.
 *   - ID columns are text (not uuid) so the existing mock IDs (u_bbg,
 *     p_001, etc.) migrate verbatim into Postgres. Production can flip
 *     to uuid at a later pass without touching call sites.
 *   - Money amounts use numeric(12,2). Token amounts use numeric(18,8)
 *     to match the Drizzle numeric shape referenced across types.ts.
 *   - ISO date strings use timestamp with `mode: "string"` so the
 *     driver returns ISO strings — keeps the domain interfaces stable
 *     during activation.
 *   - Union-type fields (MembershipTier, Industry, OrderStatus, etc.)
 *     use text columns with `enum: [...]` constraints so Drizzle types
 *     stay literal-narrow without requiring runtime pgEnum migrations.
 *   - Composite substructures (OrderLineItem[], ProposedBuilder[],
 *     FeaturedWorkEntry[], etc.) use jsonb — the sandbox stores them
 *     as arrays of objects and the app never queries into them
 *     structurally. If perf demands, Tolgay can normalize into join
 *     tables during activation without changing the reader interfaces.
 *
 * When a reader eventually swaps from `MOCK_XXX` to `db.select().from(xxx)`
 * the row shape should equal the interface. Any drift shows up at
 * typecheck time; that's the safety net.
 */
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "@auth/core/adapters";

// ──────────────────────────────────────────────────────────────────────
//  Auth.js canonical tables + FM-extended user
// ──────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),

  // Auth.js canonical fields
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "string", withTimezone: true }),
  image: text("image"),

  // FM cooperative extension (mirrors User interface in types.ts)
  handle: text("handle").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  avatarPortraitUrl: text("avatar_portrait_url"),
  membershipTier: text("membership_tier", {
    enum: ["viewer", "prospect", "partner", "member"],
  }).notNull().default("viewer"),
  primaryIndustry: text("primary_industry", {
    enum: ["stem", "creative-media", "professional-services"],
  }),
  secondaryIndustries: jsonb("secondary_industries")
    .$type<string[]>()
    .notNull()
    .default([]),
  dataParticipation: boolean("data_participation").notNull().default(false),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  discipline: text("discipline"),
  profileMode: text("profile_mode", {
    enum: ["contributor", "epk"],
  }).notNull().default("contributor"),
  bio: text("bio"),
  portfolioUrl: text("portfolio_url"),
  buildTokenBalance: numeric("build_token_balance", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  isAdmin: boolean("is_admin").notNull().default(false),
  talentTags: jsonb("talent_tags").$type<string[]>().notNull().default([]),
  profilePublic: boolean("profile_public").notNull().default(true),
  suspendedAt: timestamp("suspended_at", { mode: "string", withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  walletAddress: text("wallet_address"),
  connectedWalletAddress: text("connected_wallet_address"),
  connectedWalletProvider: text("connected_wallet_provider"),
  walletConnectedAt: timestamp("wallet_connected_at", { mode: "string", withTimezone: true }),
  stripeAccountId: text("stripe_account_id"),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "string", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "string", withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// ──────────────────────────────────────────────────────────────────────
//  Projects + associated ledgers
// ──────────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  industry: text("industry", {
    enum: ["stem", "creative-media", "professional-services"],
  }).notNull(),
  skillsRequired: jsonb("skills_required").$type<string[]>().notNull().default([]),
  budget: numeric("budget", { precision: 12, scale: 2 }).notNull(),
  status: text("status", {
    enum: ["open", "in_progress", "completed", "cancelled"],
  }).notNull(),
  clientId: text("client_id").notNull(),
  assignedMemberIds: jsonb("assigned_member_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  kind: text("kind", { enum: ["contract", "internal"] }).notNull(),
  isRfp: boolean("is_rfp").notNull().default(false),
  rfpApprovedAt: timestamp("rfp_approved_at", { mode: "string", withTimezone: true }),
  rfpAdminNote: text("rfp_admin_note"),
  hubspotStage: text("hubspot_stage", {
    enum: ["discovery", "proposal_sent", "negotiation", "closed_won", "closed_lost"],
  }),
  hubspotDealId: text("hubspot_deal_id"),
  collectedRevenue: numeric("collected_revenue", { precision: 12, scale: 2 }),
  collectedAt: timestamp("collected_at", { mode: "string", withTimezone: true }),
  adminUserIds: jsonb("admin_user_ids").$type<string[]>().notNull().default([]),
  talentBaseAmount: numeric("talent_base_amount", { precision: 12, scale: 2 }),
  talentBonusAmount: numeric("talent_bonus_amount", { precision: 12, scale: 2 }),
  bonusGate: jsonb("bonus_gate"),
  pmEngagementRating: integer("pm_engagement_rating"),
  bonusDecision: text("bonus_decision", {
    enum: ["pending", "released", "reclaimed"],
  }),
  bonusDecidedAt: timestamp("bonus_decided_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const engagementRecoveryPools = pgTable("engagement_recovery_pools", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  balanceUsd: numeric("balance_usd", { precision: 12, scale: 2 }).notNull(),
  drawnUsd: numeric("drawn_usd", { precision: 12, scale: 2 }).notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { mode: "string", withTimezone: true }),
});

export const attributionEntries = pgTable("attribution_entries", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().references(() => projects.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role", {
    enum: ["introducer", "contributor", "delivery_lead", "advisor"],
  }).notNull(),
  weight: numeric("weight", { precision: 4, scale: 3 }).notNull(),
  notes: text("notes"),
  loggedBy: text("logged_by").notNull().references(() => users.id),
  loggedAt: timestamp("logged_at", { mode: "string", withTimezone: true }).notNull(),
});

export const revenueSplits = pgTable("revenue_splits", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().references(() => projects.id),
  recipientId: text("recipient_id").notNull().references(() => users.id),
  pool: text("pool", { enum: ["contributor", "admin", "reserve"] }).notNull(),
  sharePct: numeric("share_pct", { precision: 6, scale: 3 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  auto: boolean("auto").notNull().default(false),
  decidedBy: text("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { mode: "string", withTimezone: true }),
  payoutStatus: text("payout_status", {
    enum: ["pending", "queued", "sent", "failed"],
  }).notNull(),
  payoutSentAt: timestamp("payout_sent_at", { mode: "string", withTimezone: true }),
  stripeTransferId: text("stripe_transfer_id"),
  notes: text("notes"),
});

// ──────────────────────────────────────────────────────────────────────
//  Quote sheets (RFP bids) + client proposals + cooperative quotes
// ──────────────────────────────────────────────────────────────────────

export const quoteSheets = pgTable("quote_sheets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  userId: text("user_id").notNull().references(() => users.id),
  price: text("price").notNull(),
  timeline: text("timeline").notNull(),
  workSamples: jsonb("work_samples").notNull().default([]),
  memberNote: text("member_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  approvedAt: timestamp("approved_at", { mode: "string", withTimezone: true }),
  approvedPrice: text("approved_price"),
  approvedTimeline: text("approved_timeline"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  rejectedAt: timestamp("rejected_at", { mode: "string", withTimezone: true }),
  rejectionNote: text("rejection_note"),
});

export const clientProposals = pgTable("client_proposals", {
  id: text("id").primaryKey(),
  quoteSheetId: text("quote_sheet_id").notNull().references(() => quoteSheets.id),
  contractId: text("contract_id").notNull().references(() => projects.id),
  token: text("token").notNull().unique(),
  sentAt: timestamp("sent_at", { mode: "string", withTimezone: true }).notNull(),
  lastViewedAt: timestamp("last_viewed_at", { mode: "string", withTimezone: true }),
  viewCount: integer("view_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
});

/**
 * CooperativeQuote — the outbound proposal Jamar sends to clients.
 * Per-Builder pricing (Tier 21) lives inside `proposed_builders` jsonb
 * as ProposedBuilder[] entries; scope is a nested jsonb block.
 */
export const cooperativeQuotes = pgTable("cooperative_quotes", {
  id: text("id").primaryKey(),
  clientToken: text("client_token").notNull().unique(),
  projectId: text("project_id").notNull().references(() => projects.id),
  clientDisplayName: text("client_display_name").notNull(),
  proposedBuilders: jsonb("proposed_builders").notNull().default([]),
  scope: jsonb("scope").notNull(),
  status: text("status", {
    enum: ["draft", "sent", "viewed", "approved", "declined"],
  }).notNull(),
  sentAt: timestamp("sent_at", { mode: "string", withTimezone: true }),
  viewedAt: timestamp("viewed_at", { mode: "string", withTimezone: true }),
  decidedAt: timestamp("decided_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  selectedLeadUserId: text("selected_lead_user_id").references(() => users.id),
});

export const cooperativeReceipts = pgTable("cooperative_receipts", {
  id: text("id").primaryKey(),
  clientToken: text("client_token").notNull().unique(),
  projectId: text("project_id").notNull().references(() => projects.id),
  cashFlowPct: numeric("cash_flow_pct", { precision: 5, scale: 2 }).notNull(),
  timeToMatchHours: integer("time_to_match_hours").notNull(),
  milestonesHit: integer("milestones_hit").notNull(),
  milestonesTotal: integer("milestones_total").notNull(),
  crewPeerReviewOvrDelta: numeric("crew_peer_review_ovr_delta", { precision: 6, scale: 2 }).notNull(),
  subsequentProjectIds: jsonb("subsequent_project_ids").$type<string[]>().notNull().default([]),
  generatedAt: timestamp("generated_at", { mode: "string", withTimezone: true }).notNull(),
  collaboratorCardTokenId: text("collaborator_card_token_id"),
});

// ──────────────────────────────────────────────────────────────────────
//  Portfolio + MVP + recognition
// ──────────────────────────────────────────────────────────────────────

export const portfolioItems = pgTable("portfolio_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  projectUrl: text("project_url"),
  industry: text("industry", {
    enum: ["stem", "creative-media", "professional-services"],
  }).notNull(),
  technologies: jsonb("technologies").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }),
  publishedTitle: text("published_title"),
  publishedDescription: text("published_description"),
  hideProjectUrl: boolean("hide_project_url").notNull().default(false),
  rejectedAt: timestamp("rejected_at", { mode: "string", withTimezone: true }),
  rejectionNote: text("rejection_note"),
});

export const mvpScores = pgTable("mvp_scores", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  ovr: integer("ovr").notNull(),
  subRatings: jsonb("sub_ratings").notNull(),
  activePenalties: jsonb("active_penalties").notNull().default([]),
  periodStart: timestamp("period_start", { mode: "string", withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { mode: "string", withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }).notNull(),
  isProvisional: boolean("is_provisional").notNull().default(true),
});

export const mvpCompliancePenalties = pgTable("mvp_compliance_penalties", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  appliedAt: timestamp("applied_at", { mode: "string", withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
  ovrImpact: integer("ovr_impact").notNull(),
  reason: text("reason").notNull(),
});

export const futureModernistRecognitions = pgTable("future_modernist_recognitions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  periodKind: text("period_kind", { enum: ["month", "year"] }).notNull(),
  periodLabel: text("period_label").notNull(),
  periodKey: text("period_key").notNull(),
  narrative: text("narrative").notNull(),
  selectedByUserId: text("selected_by_user_id").notNull().references(() => users.id),
  selectedAt: timestamp("selected_at", { mode: "string", withTimezone: true }).notNull(),
});

export const memberCanonizations = pgTable("member_canonizations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  year: integer("year").notNull(),
  tier: text("tier", {
    enum: ["standard", "probation", "good_standing", "promotion_eligible", "future_modernist", "champion"],
  }).notNull(),
  ovr: integer("ovr"),
  recognitionIds: jsonb("recognition_ids").$type<string[]>().notNull().default([]),
  caption: text("caption"),
  frozenAt: timestamp("frozen_at", { mode: "string", withTimezone: true }).notNull(),
  tokenId: text("token_id"),
  tbaAddress: text("tba_address"),
}, (t) => ({
  yearUserUnique: uniqueIndex("member_canonizations_year_user").on(t.year, t.userId),
}));

export const cohortSpotlights = pgTable("cohort_spotlights", {
  id: text("id").primaryKey(),
  periodKey: text("period_key").notNull().unique(),
  periodLabel: text("period_label").notNull(),
  userIds: jsonb("user_ids").$type<string[]>().notNull().default([]),
  headline: text("headline").notNull(),
  narrative: text("narrative").notNull(),
  paragraphSlug: text("paragraph_slug"),
  publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }).notNull(),
  selectedByUserId: text("selected_by_user_id").notNull().references(() => users.id),
});

// ──────────────────────────────────────────────────────────────────────
//  Memberships, invites, tokens
// ──────────────────────────────────────────────────────────────────────

export const membershipApplications = pgTable("membership_applications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  requestedTier: text("requested_tier", {
    enum: ["prospect", "partner", "member"],
  }).notNull(),
  currentTier: text("current_tier", {
    enum: ["viewer", "prospect", "partner", "member"],
  }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
  applicationData: jsonb("application_data").notNull().default({}),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const inviteLinks = pgTable("invite_links", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  targetEmail: text("target_email").notNull(),
  targetTier: text("target_tier", {
    enum: ["viewer", "prospect", "partner", "member"],
  }).notNull(),
  targetName: text("target_name"),
  note: text("note"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { mode: "string", withTimezone: true }),
  consumedByUserId: text("consumed_by_user_id").references(() => users.id),
  revokedAt: timestamp("revoked_at", { mode: "string", withTimezone: true }),
  revokedReason: text("revoked_reason"),
});

export const tokenTransactions = pgTable("token_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  type: text("type", {
    enum: ["project_completion", "referral", "collaboration", "governance", "admin_grant"],
  }).notNull(),
  projectId: text("project_id").references(() => projects.id),
  description: text("description"),
  transactionHash: text("transaction_hash"),
  compStage: text("comp_stage", {
    enum: ["base", "bonus_released", "bonus_withheld"],
  }),
  withholdReason: text("withhold_reason"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Notifications + audit log
// ──────────────────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  readAt: timestamp("read_at", { mode: "string", withTimezone: true }),
});

export const auditLogEntries = pgTable("audit_log_entries", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id"),
  actorRoleSnapshot: text("actor_role_snapshot", {
    enum: ["member", "partner", "prospect", "viewer", "admin", "system"],
  }).notNull(),
  action: text("action").notNull(),
  resourceKind: text("resource_kind").notNull(),
  resourceId: text("resource_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  ipHint: text("ip_hint"),
  sessionHint: text("session_hint"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Jobs
// ──────────────────────────────────────────────────────────────────────

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  industry: text("industry", {
    enum: ["stem", "creative-media", "professional-services"],
  }).notNull(),
  skillsRequired: jsonb("skills_required").$type<string[]>().notNull().default([]),
  compensation: text("compensation").notNull(),
  location: text("location").notNull(),
  employmentType: text("employment_type", {
    enum: ["full-time", "part-time", "contract-to-hire"],
  }).notNull(),
  postedBy: text("posted_by").notNull(),
  postedByLabel: text("posted_by_label").notNull(),
  status: text("status", { enum: ["open", "filled", "closed"] }).notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Whitelist + consultation
// ──────────────────────────────────────────────────────────────────────

export const whitelistTiers = pgTable("whitelist_tiers", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  blurb: text("blurb").notNull(),
  priceUsd: numeric("price_usd", { precision: 12, scale: 2 }).notNull(),
  seatCap: integer("seat_cap"),
  seatsClaimed: integer("seats_claimed").notNull().default(0),
  accent: text("accent").notNull(),
  isDonation: boolean("is_donation").notNull().default(false),
  isConsultation: boolean("is_consultation").notNull().default(false),
  perks: jsonb("perks").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export const whitelistPurchases = pgTable("whitelist_purchases", {
  id: text("id").primaryKey(),
  tierId: text("tier_id").notNull().references(() => whitelistTiers.id),
  buyerId: text("buyer_id").references(() => users.id),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name").notNull(),
  rail: text("rail", { enum: ["cash", "crypto"] }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  processingFee: numeric("processing_fee", { precision: 12, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  cryptoTxHash: text("crypto_tx_hash"),
  referrerId: text("referrer_id").references(() => users.id),
  status: text("status", {
    enum: ["initiated", "paid", "split_distributed", "refunded", "failed"],
  }).notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { mode: "string", withTimezone: true }),
  splitDistributedAt: timestamp("split_distributed_at", { mode: "string", withTimezone: true }),
});

export const consultationRequests = pgTable("consultation_requests", {
  id: text("id").primaryKey(),
  tierId: text("tier_id").notNull().references(() => whitelistTiers.id),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  company: text("company"),
  scopeBuckets: jsonb("scope_buckets").$type<string[]>().notNull().default([]),
  briefing: text("briefing").notNull(),
  budgetHint: text("budget_hint"),
  status: text("status", {
    enum: ["new", "scheduled", "quoted", "won", "declined"],
  }).notNull(),
  assignedTo: text("assigned_to").references(() => users.id),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Media locker
// ──────────────────────────────────────────────────────────────────────

export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  uploaderId: text("uploader_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["video", "audio"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  industry: text("industry", {
    enum: ["stem", "creative-media", "professional-services"],
  }).notNull(),
  tierGate: text("tier_gate", {
    enum: ["viewer", "prospect", "partner", "member"],
  }).notNull(),
  playbackUrl: text("playback_url").notNull(),
  posterUrl: text("poster_url"),
  duration: text("duration"),
  status: text("status", {
    enum: ["draft", "pending_review", "published", "rejected", "archived"],
  }).notNull(),
  adminNote: text("admin_note"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Marketplace: products, orders, categories, seller applications
// ──────────────────────────────────────────────────────────────────────

export const storeCategories = pgTable("store_categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  vertical: text("vertical", {
    enum: ["goods", "saas", "energy", "creative-services", "clothing"],
  }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull().references(() => users.id),
  category: text("category", {
    enum: ["goods", "saas", "energy", "creative-services", "clothing"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency", { enum: ["USD"] }).notNull().default("USD"),
  inventoryCount: integer("inventory_count"),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  categorySlugs: jsonb("category_slugs").$type<string[]>().notNull().default([]),
  status: text("status", {
    enum: ["draft", "pending_review", "active", "archived", "rejected"],
  }).notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

export const sellerApplications = pgTable("seller_applications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  requestedCategories: jsonb("requested_categories").$type<string[]>().notNull().default([]),
  pitch: text("pitch").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { mode: "string", withTimezone: true }),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  buyerId: text("buyer_id").references(() => users.id),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name").notNull(),
  sellerId: text("seller_id").notNull().references(() => users.id),
  category: text("category", {
    enum: ["goods", "saas", "energy", "creative-services", "clothing"],
  }).notNull(),
  status: text("status", {
    enum: ["placed", "paid", "fulfilling", "shipped", "delivered", "cancelled", "refunded"],
  }).notNull(),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  houseFee: numeric("house_fee", { precision: 12, scale: 2 }).notNull(),
  processingFee: numeric("processing_fee", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  shippingAddress: text("shipping_address"),
  trackingNumber: text("tracking_number"),
  internalNote: text("internal_note"),
  placedAt: timestamp("placed_at", { mode: "string", withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { mode: "string", withTimezone: true }),
  shippedAt: timestamp("shipped_at", { mode: "string", withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { mode: "string", withTimezone: true }),
  splitDistributedAt: timestamp("split_distributed_at", { mode: "string", withTimezone: true }),
});

// ──────────────────────────────────────────────────────────────────────
//  Invoices (AR)
// ──────────────────────────────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().references(() => projects.id),
  number: text("number").notNull().unique(),
  clientToken: text("client_token").notNull().unique(),
  status: text("status", {
    enum: ["draft", "issued", "partially_received", "received", "void"],
  }).notNull(),
  paymentMethod: text("payment_method", {
    enum: ["ach_mercury", "wire_mercury", "cc_stripe", "check", "other"],
  }).notNull(),
  acceptsCard: boolean("accepts_card").notNull().default(false),
  lineItems: jsonb("line_items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  processingFee: numeric("processing_fee", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  issuedAt: timestamp("issued_at", { mode: "string", withTimezone: true }),
  dueAt: timestamp("due_at", { mode: "string", withTimezone: true }),
  paidAt: timestamp("paid_at", { mode: "string", withTimezone: true }),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  mercuryReference: text("mercury_reference"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Partners
// ──────────────────────────────────────────────────────────────────────

export const servicePartners = pgTable("service_partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  websiteUrl: text("website_url"),
  affiliateUrl: text("affiliate_url"),
  pillarHint: text("pillar_hint", {
    enum: ["stem", "creative-media", "professional-services"],
  }),
  shippedTogether: boolean("shipped_together").notNull().default(false),
});

export const ecosystemPartners = pgTable("ecosystem_partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  websiteUrl: text("website_url"),
  affiliateUrl: text("affiliate_url"),
});

export const productAffiliates = pgTable("product_affiliates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  affiliateUrl: text("affiliate_url"),
});

// ──────────────────────────────────────────────────────────────────────
//  EPKs, peer reviews, customer feedback
// ──────────────────────────────────────────────────────────────────────

export const artistEpks = pgTable("artist_epks", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["draft", "submitted", "published", "needs_revision"],
  }).notNull(),
  heroImageUrl: text("hero_image_url"),
  tagline: text("tagline"),
  bioShort: text("bio_short").notNull(),
  bioLong: text("bio_long"),
  featuredWork: jsonb("featured_work").notNull().default([]),
  press: jsonb("press").notNull().default([]),
  trackRecord: jsonb("track_record").$type<string[]>().notNull().default([]),
  socialHandles: jsonb("social_handles").notNull().default([]),
  web3Profiles: jsonb("web3_profiles").notNull().default([]),
  metrics: jsonb("metrics").notNull().default([]),
  bookingNote: text("booking_note"),
  submittedAt: timestamp("submitted_at", { mode: "string", withTimezone: true }),
  publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }),
  adminRevisionNote: text("admin_revision_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

export const peerReviews = pgTable("peer_reviews", {
  id: text("id").primaryKey(),
  contextKind: text("context_kind", {
    enum: ["contract", "internal_project"],
  }).notNull(),
  contextId: text("context_id").notNull(),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  revieweeId: text("reviewee_id").notNull().references(() => users.id),
  stars: integer("stars").notNull(),
  collaboration: integer("collaboration").notNull(),
  craft: integer("craft").notNull(),
  reliability: integer("reliability").notNull(),
  prose: text("prose").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
}, (t) => ({
  uniqueReview: uniqueIndex("peer_reviews_unique").on(
    t.contextKind, t.contextId, t.reviewerId, t.revieweeId,
  ),
}));

export const customerFeedback = pgTable("customer_feedback", {
  id: text("id").primaryKey(),
  contextKind: text("context_kind", {
    enum: ["contract", "marketplace_order"],
  }).notNull(),
  contextId: text("context_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  overallStars: integer("overall_stars").notNull(),
  metExpectations: integer("met_expectations").notNull(),
  communication: integer("communication").notNull(),
  wouldHireAgain: boolean("would_hire_again").notNull(),
  prose: text("prose").notNull(),
  contributorShoutout: text("contributor_shoutout"),
  attributionConsent: text("attribution_consent", {
    enum: ["name_and_org", "org_only", "anonymized", "internal_only"],
  }),
  googleReviewOptIn: text("google_review_opt_in", {
    enum: ["yes_send_link", "ask_me_later", "no"],
  }),
  googleReviewFollowupStatus: text("google_review_followup_status", {
    enum: ["pending_review", "sent", "declined"],
  }),
  googleReviewFollowupSentAt: timestamp("google_review_followup_sent_at", { mode: "string", withTimezone: true }),
  publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }),
  publishedQuote: text("published_quote"),
  publishedForUserId: text("published_for_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Calendar, meeting minutes
// ──────────────────────────────────────────────────────────────────────

export const calendarAvailability = pgTable("calendar_availability", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const calendarBlocks = pgTable("calendar_blocks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { mode: "string", withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { mode: "string", withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const calendarMeetings = pgTable("calendar_meetings", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { mode: "string", withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { mode: "string", withTimezone: true }).notNull(),
  kind: text("kind", {
    enum: ["peer_internal", "external_client", "team_governance"],
  }).notNull(),
  organizerId: text("organizer_id").notNull().references(() => users.id),
  attendeeIds: jsonb("attendee_ids").$type<string[]>().notNull().default([]),
  confirmedByAttendeeIds: jsonb("confirmed_by_attendee_ids").$type<string[]>().notNull().default([]),
  status: text("status", {
    enum: ["pending", "confirmed", "declined", "cancelled"],
  }).notNull(),
  externalClientName: text("external_client_name"),
  externalClientEmail: text("external_client_email"),
  projectId: text("project_id").references(() => projects.id),
  pmUserId: text("pm_user_id").references(() => users.id),
  notesPreview: text("notes_preview"),
  recordingUrl: text("recording_url"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

export const meetingMinutes = pgTable("meeting_minutes", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull().references(() => calendarMeetings.id),
  format: text("format", {
    enum: ["notes", "recording", "transcript_upload"],
  }).notNull(),
  routing: text("routing", {
    enum: ["project_scoped", "team_governance", "peer_one_on_one"],
  }).notNull(),
  body: text("body"),
  recordingUrl: text("recording_url"),
  uploadedFile: jsonb("uploaded_file"),
  capturedByUserId: text("captured_by_user_id").notNull().references(() => users.id),
  corrections: jsonb("corrections").notNull().default([]),
  capturedAt: timestamp("captured_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Chat
// ──────────────────────────────────────────────────────────────────────

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  visitorToken: text("visitor_token").notNull().unique(),
  visitorName: text("visitor_name").notNull(),
  visitorEmail: text("visitor_email").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull(),
  assignedAdminId: text("assigned_admin_id").references(() => users.id),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  lastMessageAt: timestamp("last_message_at", { mode: "string", withTimezone: true }).notNull(),
  adminLastReadAt: timestamp("admin_last_read_at", { mode: "string", withTimezone: true }),
  visitorLastReadAt: timestamp("visitor_last_read_at", { mode: "string", withTimezone: true }),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  sender: text("sender", { enum: ["visitor", "admin"] }).notNull(),
  senderId: text("sender_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Project workflow — milestones, applications, prospective
// ──────────────────────────────────────────────────────────────────────

export const projectMilestones = pgTable("project_milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  dueAt: timestamp("due_at", { mode: "string", withTimezone: true }).notNull(),
  status: text("status", {
    enum: ["not_started", "in_progress", "blocked", "completed"],
  }).notNull(),
  blockerNote: text("blocker_note"),
  completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
  lastDueSoonNoticeAt: timestamp("last_due_soon_notice_at", { mode: "string", withTimezone: true }),
  lastOverdueNoticeAt: timestamp("last_overdue_notice_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

export const projectApplications = pgTable("project_applications", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  userId: text("user_id").notNull().references(() => users.id),
  proposedRole: text("proposed_role").notNull(),
  pitch: text("pitch").notNull(),
  hoursPerWeek: integer("hours_per_week").notNull().default(0),
  portfolioLink: text("portfolio_link"),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "withdrawn"],
  }).notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { mode: "string", withTimezone: true }),
  adminNote: text("admin_note"),
  withdrawnAt: timestamp("withdrawn_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const prospectiveContributions = pgTable("prospective_contributions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  proposedRole: text("proposed_role").notNull(),
  pitch: text("pitch").notNull(),
  hoursPerWeek: integer("hours_per_week").notNull().default(0),
  portfolioLink: text("portfolio_link"),
  status: text("status", {
    enum: ["new", "contacted", "converted", "dismissed"],
  }).notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { mode: "string", withTimezone: true }),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Walkthrough, feedback, inbound submissions
// ──────────────────────────────────────────────────────────────────────

export const walkthroughSteps = pgTable("walkthrough_steps", {
  id: text("id").primaryKey(),
  order: integer("order").notNull(),
  tier: text("tier", {
    enum: ["prospect", "partner", "member", "admin"],
  }).notNull(),
  pillar: text("pillar", {
    enum: ["stem", "creative-media", "professional-services"],
  }),
  title: text("title").notNull(),
  blurb: text("blurb").notNull(),
  surface: text("surface").notNull(),
  surfaceLabel: text("surface_label").notNull(),
  whatToTry: jsonb("what_to_try").$type<string[]>().notNull().default([]),
  feedbackPrompt: text("feedback_prompt"),
});

export const walkthroughProgress = pgTable("walkthrough_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stepId: text("step_id").notNull().references(() => walkthroughSteps.id),
  completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }).notNull(),
});

export const feedbackEntries = pgTable("feedback_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  surface: text("surface").notNull(),
  surfaceLabel: text("surface_label").notNull(),
  walkthroughStepId: text("walkthrough_step_id").references(() => walkthroughSteps.id),
  sentiment: text("sentiment", {
    enum: ["positive", "confused", "blocker"],
  }).notNull(),
  note: text("note").notNull(),
  pillar: text("pillar", {
    enum: ["stem", "creative-media", "professional-services"],
  }),
  tier: text("tier", {
    enum: ["viewer", "prospect", "partner", "member"],
  }).notNull(),
  status: text("status", {
    enum: ["new", "triaged", "resolved"],
  }).notNull(),
  adminNote: text("admin_note"),
  triagedBy: text("triaged_by").references(() => users.id),
  triagedAt: timestamp("triaged_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

export const inboundSubmissions = pgTable("inbound_submissions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: text("status", {
    enum: ["new", "in_triage", "needs_info", "converted", "closed_no_action"],
  }).notNull(),
  title: text("title").notNull(),
  submitter: text("submitter").notNull(),
  submitterEmail: text("submitter_email"),
  submitterCompany: text("submitter_company"),
  pillarTags: jsonb("pillar_tags").$type<string[]>().notNull().default([]),
  keywordTags: jsonb("keyword_tags").$type<string[]>().notNull().default([]),
  body: text("body").notNull(),
  attachments: jsonb("attachments").notNull().default([]),
  assignedAdminId: text("assigned_admin_id").references(() => users.id),
  triageNote: text("triage_note"),
  deepLinkHref: text("deep_link_href"),
  linkedResourceId: text("linked_resource_id"),
  derived: boolean("derived").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────
//  Full schema re-export bundle (drizzle-kit + client entry)
// ──────────────────────────────────────────────────────────────────────

export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  projects,
  engagementRecoveryPools,
  attributionEntries,
  revenueSplits,
  quoteSheets,
  clientProposals,
  cooperativeQuotes,
  cooperativeReceipts,
  portfolioItems,
  mvpScores,
  mvpCompliancePenalties,
  futureModernistRecognitions,
  memberCanonizations,
  cohortSpotlights,
  membershipApplications,
  inviteLinks,
  tokenTransactions,
  notifications,
  auditLogEntries,
  jobs,
  whitelistTiers,
  whitelistPurchases,
  consultationRequests,
  mediaAssets,
  storeCategories,
  products,
  sellerApplications,
  orders,
  invoices,
  servicePartners,
  ecosystemPartners,
  productAffiliates,
  artistEpks,
  peerReviews,
  customerFeedback,
  calendarAvailability,
  calendarBlocks,
  calendarMeetings,
  meetingMinutes,
  chatThreads,
  chatMessages,
  projectMilestones,
  projectApplications,
  prospectiveContributions,
  walkthroughSteps,
  walkthroughProgress,
  feedbackEntries,
  inboundSubmissions,
} as const;
