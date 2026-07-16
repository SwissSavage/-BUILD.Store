/**
 * Seed script — pushes every MOCK_* array from src/lib/mock-data into
 * the corresponding Drizzle table.
 *
 * Idempotent: uses ON CONFLICT (id) DO NOTHING so re-running against
 * an already-seeded database is a no-op. Delete the row first if you
 * want to re-seed a specific row.
 *
 * Ordering is dependency-first so foreign keys resolve:
 *   users (no FK dependencies)
 *   → projects, invite_links, portfolio, mvp_scores, notifications, etc.
 *   → quotes, receipts, cooperative_quotes, invoices (reference projects)
 *   → meeting_minutes (reference calendar_meetings)
 *   → chat_messages (reference chat_threads)
 *   → attribution_entries, revenue_splits (reference projects + users)
 *
 * Run via:
 *   npm run db:seed
 *
 * Requires DATABASE_URL in env. Drizzle will use the pool defined in
 * client.ts.
 */
import "./env-loader";
import { db, pool } from "./client";
import * as schema from "./schema";

import { MOCK_USERS } from "../lib/mock-data/users";
import { MOCK_PROJECTS } from "../lib/mock-data/projects";
import { MOCK_INVITE_LINKS } from "../lib/mock-data/invite-links";
import { MOCK_PORTFOLIO } from "../lib/mock-data/portfolio";
import { MOCK_MVP_SCORES, MOCK_MVP_PENALTIES } from "../lib/mock-data/mvp-scores";
import { MOCK_APPLICATIONS } from "../lib/mock-data/applications";
import { MOCK_TRANSACTIONS } from "../lib/mock-data/tokens";
import { MOCK_NOTIFICATIONS } from "../lib/mock-data/notifications";
import { MOCK_AUDIT_LOG } from "../lib/mock-data/audit-log";
import { MOCK_JOBS } from "../lib/mock-data/jobs";
import {
  MOCK_WHITELIST_TIERS,
  MOCK_WHITELIST_PURCHASES,
  MOCK_CONSULTATION_REQUESTS,
} from "../lib/mock-data/whitelist";
import { MOCK_MEDIA_ASSETS } from "../lib/mock-data/media-assets";
import { MOCK_STORE_CATEGORIES } from "../lib/mock-data/store-categories";
import { MOCK_PRODUCTS } from "../lib/mock-data/products";
import { MOCK_SELLER_APPLICATIONS } from "../lib/mock-data/seller-applications";
import { MOCK_ORDERS } from "../lib/mock-data/orders";
import { MOCK_INVOICES } from "../lib/mock-data/invoices";
import {
  SERVICE_PARTNERS,
  ECOSYSTEM_PARTNERS,
  PRODUCT_AFFILIATES,
} from "../lib/mock-data/partners";
import { MOCK_ARTIST_EPKS } from "../lib/mock-data/artist-epk";
import { MOCK_PEER_REVIEWS } from "../lib/mock-data/peer-reviews";
import { MOCK_CUSTOMER_FEEDBACK } from "../lib/mock-data/customer-feedback";
import {
  MOCK_AVAILABILITY,
  MOCK_BLOCKS,
  MOCK_MEETINGS,
} from "../lib/mock-data/calendar";
import { MOCK_MEETING_MINUTES } from "../lib/mock-data/meeting-minutes";
import { MOCK_PROJECT_MILESTONES } from "../lib/mock-data/project-milestones";
import { MOCK_PROJECT_APPLICATIONS } from "../lib/mock-data/project-applications";
import { MOCK_PROSPECTIVE_CONTRIBUTIONS } from "../lib/mock-data/prospective-contributions";
import { MOCK_QUOTES } from "../lib/mock-data/quotes";
import { MOCK_PROPOSALS } from "../lib/mock-data/proposals";
import { MOCK_COOPERATIVE_QUOTES } from "../lib/mock-data/cooperative-quotes";
import { MOCK_COOPERATIVE_RECEIPTS } from "../lib/mock-data/cooperative-receipts";
import { MOCK_RECOVERY_POOLS } from "../lib/mock-data/engagement-recovery-pools";
import { MOCK_ATTRIBUTION } from "../lib/mock-data/attribution";
import { MOCK_SPLITS } from "../lib/mock-data/splits";
import { MOCK_CANONIZATIONS } from "../lib/mock-data/canonizations";
import { MOCK_COHORT_SPOTLIGHTS } from "../lib/mock-data/cohort-spotlights";
import { MOCK_FUTURE_MODERNIST_RECOGNITIONS } from "../lib/mock-data/future-modernist-recognitions";
import {
  MOCK_WALKTHROUGH_STEPS,
  MOCK_WALKTHROUGH_PROGRESS,
} from "../lib/mock-data/walkthroughs";
import { MOCK_FEEDBACK } from "../lib/mock-data/feedback";
import { MOCK_INBOUND_SUBMISSIONS } from "../lib/mock-data/inbound-submissions";
// chat.ts uses an in-memory function-based store, no seed data to pull.
// chat_threads + chat_messages tables stay empty until real traffic
// populates them via the app's chat rail.

/**
 * Generic bulk-insert helper. Handles zero-row arrays silently and
 * reports counts for each table so the seed output is legible.
 */
async function seedTable<T>(name: string, table: any, rows: T[]) {
  if (!rows || rows.length === 0) {
    console.log(`  ${name}: (empty)`);
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows as any).onConflictDoNothing();
    console.log(`  ${name}: ${rows.length} rows`);
  } catch (err) {
    console.error(`  ${name}: FAILED —`, (err as Error).message);
    throw err;
  }
}

async function main() {
  console.log("=== $BUILD.Store seed run ===");
  console.log("Target:", process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":****@"));

  // Wave 1 — no domain FK dependencies
  console.log("\nWave 1 — root tables");
  await seedTable("users", schema.users, MOCK_USERS);
  await seedTable("store_categories", schema.storeCategories, MOCK_STORE_CATEGORIES);
  await seedTable("whitelist_tiers", schema.whitelistTiers, MOCK_WHITELIST_TIERS);
  await seedTable("jobs", schema.jobs, MOCK_JOBS);
  await seedTable("service_partners", schema.servicePartners, SERVICE_PARTNERS);
  await seedTable("ecosystem_partners", schema.ecosystemPartners, ECOSYSTEM_PARTNERS);
  await seedTable("product_affiliates", schema.productAffiliates, PRODUCT_AFFILIATES);
  await seedTable("walkthrough_steps", schema.walkthroughSteps, MOCK_WALKTHROUGH_STEPS);

  // Wave 2 — depend on users
  console.log("\nWave 2 — user-dependent");
  await seedTable("projects", schema.projects, MOCK_PROJECTS);
  await seedTable("invite_links", schema.inviteLinks, MOCK_INVITE_LINKS);
  await seedTable("portfolio_items", schema.portfolioItems, MOCK_PORTFOLIO);
  await seedTable("mvp_scores", schema.mvpScores, MOCK_MVP_SCORES);
  await seedTable("mvp_compliance_penalties", schema.mvpCompliancePenalties, MOCK_MVP_PENALTIES);
  await seedTable("membership_applications", schema.membershipApplications, MOCK_APPLICATIONS);
  await seedTable("notifications", schema.notifications, MOCK_NOTIFICATIONS);
  await seedTable("audit_log_entries", schema.auditLogEntries, MOCK_AUDIT_LOG);
  await seedTable("media_assets", schema.mediaAssets, MOCK_MEDIA_ASSETS);
  await seedTable("products", schema.products, MOCK_PRODUCTS);
  await seedTable("seller_applications", schema.sellerApplications, MOCK_SELLER_APPLICATIONS);
  await seedTable("artist_epks", schema.artistEpks, MOCK_ARTIST_EPKS);
  await seedTable("cohort_spotlights", schema.cohortSpotlights, MOCK_COHORT_SPOTLIGHTS);
  await seedTable("future_modernist_recognitions", schema.futureModernistRecognitions, MOCK_FUTURE_MODERNIST_RECOGNITIONS);
  await seedTable("member_canonizations", schema.memberCanonizations, MOCK_CANONIZATIONS);
  await seedTable("calendar_availability", schema.calendarAvailability, MOCK_AVAILABILITY);
  await seedTable("calendar_blocks", schema.calendarBlocks, MOCK_BLOCKS);
  await seedTable("inbound_submissions", schema.inboundSubmissions, MOCK_INBOUND_SUBMISSIONS);

  // Wave 3 — depend on users + projects
  console.log("\nWave 3 — project-dependent");
  await seedTable("token_transactions", schema.tokenTransactions, MOCK_TRANSACTIONS);
  await seedTable("engagement_recovery_pools", schema.engagementRecoveryPools, MOCK_RECOVERY_POOLS);
  await seedTable("attribution_entries", schema.attributionEntries, MOCK_ATTRIBUTION);
  await seedTable("revenue_splits", schema.revenueSplits, MOCK_SPLITS);
  await seedTable("quote_sheets", schema.quoteSheets, MOCK_QUOTES);
  await seedTable("cooperative_quotes", schema.cooperativeQuotes, MOCK_COOPERATIVE_QUOTES);
  await seedTable("cooperative_receipts", schema.cooperativeReceipts, MOCK_COOPERATIVE_RECEIPTS);
  await seedTable("invoices", schema.invoices, MOCK_INVOICES);
  await seedTable("project_milestones", schema.projectMilestones, MOCK_PROJECT_MILESTONES);
  await seedTable("project_applications", schema.projectApplications, MOCK_PROJECT_APPLICATIONS);
  await seedTable("prospective_contributions", schema.prospectiveContributions, MOCK_PROSPECTIVE_CONTRIBUTIONS);
  await seedTable("calendar_meetings", schema.calendarMeetings, MOCK_MEETINGS);
  await seedTable("peer_reviews", schema.peerReviews, MOCK_PEER_REVIEWS);
  await seedTable("customer_feedback", schema.customerFeedback, MOCK_CUSTOMER_FEEDBACK);
  await seedTable("orders", schema.orders, MOCK_ORDERS);
  await seedTable("whitelist_purchases", schema.whitelistPurchases, MOCK_WHITELIST_PURCHASES);
  await seedTable("consultation_requests", schema.consultationRequests, MOCK_CONSULTATION_REQUESTS);

  // Wave 4 — depend on wave-2/3 rows
  console.log("\nWave 4 — nested dependents");
  await seedTable("client_proposals", schema.clientProposals, MOCK_PROPOSALS);
  await seedTable("meeting_minutes", schema.meetingMinutes, MOCK_MEETING_MINUTES);
  await seedTable("walkthrough_progress", schema.walkthroughProgress, MOCK_WALKTHROUGH_PROGRESS);
  await seedTable("feedback_entries", schema.feedbackEntries, MOCK_FEEDBACK);

  console.log("\n=== seed complete ===");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
