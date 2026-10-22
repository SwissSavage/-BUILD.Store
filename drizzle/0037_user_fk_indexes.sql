-- Index every foreign key that points at users.id.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-21)
--
-- Bayu: "Currently it takes hours to delete one user, could you
-- diagnose and audit the prod database, see what might be the issue."
--
-- 59 foreign key constraints reference users.id. 51 of the referencing
-- columns had no index.
--
-- Postgres indexes the referenced primary key, not the referencing
-- column. So DELETE FROM users WHERE id = $1 has to prove that no row
-- in any referencing table still points at that id, and for every
-- unindexed foreign key that proof is a sequential scan of the entire
-- table. Fifty-one of them, one after another, for a single row.
--
-- This is also why the admin hard-delete path and the seed purge both
-- feel like they have hung. They have not; they are scanning.
--
-- WHY PLAIN CREATE INDEX AND NOT CONCURRENTLY
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and
-- scripts/migrate.mjs wraps each migration file in BEGIN/COMMIT so a
-- failure rolls back cleanly. A concurrent build would error out of
-- that runner immediately.
--
-- A plain build takes an exclusive write lock for the duration. At
-- current volumes — low hundreds of rows per table — that is
-- milliseconds each and nobody will see it. If any of these tables
-- reaches six figures, this file is the wrong tool and the indexes
-- want building out of band with CONCURRENTLY.
--
-- IF NOT EXISTS throughout, so re-running is free and so is landing
-- this on a database where somebody has already added one by hand.
-- ─────────────────────────────────────────────────────────────

-- Auth.js. accounts is read on every sign-in; sessions on session
-- lookup by user rather than by token.
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint

-- Money and attribution. These are the rows a delete must not orphan,
-- and the tables that grow fastest.
CREATE INDEX IF NOT EXISTS "attribution_entries_user_id_idx" ON "attribution_entries" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attribution_entries_logged_by_idx" ON "attribution_entries" ("logged_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revenue_splits_decided_by_idx" ON "revenue_splits" ("decided_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "build_vouchers_issued_by_user_id_idx" ON "build_vouchers" ("issued_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reserve_pool_ledger_actor_user_id_idx" ON "reserve_pool_ledger" ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whitelist_purchases_buyer_id_idx" ON "whitelist_purchases" ("buyer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whitelist_purchases_referrer_id_idx" ON "whitelist_purchases" ("referrer_id");--> statement-breakpoint

-- Quotes and SOWs.
CREATE INDEX IF NOT EXISTS "quote_sheets_user_id_idx" ON "quote_sheets" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cooperative_quotes_created_by_user_id_idx" ON "cooperative_quotes" ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cooperative_quotes_selected_lead_user_id_idx" ON "cooperative_quotes" ("selected_lead_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cooperative_quote_versions_created_by_idx" ON "cooperative_quote_versions" ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sows_created_by_user_id_idx" ON "sows" ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sow_versions_created_by_user_id_idx" ON "sow_versions" ("created_by_user_id");--> statement-breakpoint

-- Projects and delivery.
CREATE INDEX IF NOT EXISTS "project_milestones_owner_user_id_idx" ON "project_milestones" ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_applications_reviewed_by_idx" ON "project_applications" ("reviewed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prospective_contributions_reviewed_by_idx" ON "prospective_contributions" ("reviewed_by");--> statement-breakpoint

-- Membership, standing and review.
CREATE INDEX IF NOT EXISTS "membership_applications_user_id_idx" ON "membership_applications" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_applications_reviewed_by_idx" ON "membership_applications" ("reviewed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mvp_scores_user_id_idx" ON "mvp_scores" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mvp_compliance_penalties_user_id_idx" ON "mvp_compliance_penalties" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_canonizations_user_id_idx" ON "member_canonizations" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "future_modernist_recognitions_user_id_idx" ON "future_modernist_recognitions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "future_modernist_recognitions_selected_by_idx" ON "future_modernist_recognitions" ("selected_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cohort_spotlights_selected_by_user_id_idx" ON "cohort_spotlights" ("selected_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "walkthrough_progress_user_id_idx" ON "walkthrough_progress" ("user_id");--> statement-breakpoint

-- Store.
CREATE INDEX IF NOT EXISTS "products_seller_id_idx" ON "products" ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_buyer_id_idx" ON "orders" ("buyer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_seller_id_idx" ON "orders" ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_applications_user_id_idx" ON "seller_applications" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_applications_reviewed_by_idx" ON "seller_applications" ("reviewed_by");--> statement-breakpoint

-- Profile, media, EPK.
CREATE INDEX IF NOT EXISTS "artist_epks_user_id_idx" ON "artist_epks" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_uploader_id_idx" ON "media_assets" ("uploader_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_reviewed_by_idx" ON "media_assets" ("reviewed_by");--> statement-breakpoint

-- Calendar.
CREATE INDEX IF NOT EXISTS "calendar_availability_user_id_idx" ON "calendar_availability" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_blocks_user_id_idx" ON "calendar_blocks" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_meetings_organizer_id_idx" ON "calendar_meetings" ("organizer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_meetings_pm_user_id_idx" ON "calendar_meetings" ("pm_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_minutes_captured_by_user_id_idx" ON "meeting_minutes" ("captured_by_user_id");--> statement-breakpoint

-- Intake, chat, feedback, referrals.
CREATE INDEX IF NOT EXISTS "inbound_submissions_assigned_admin_id_idx" ON "inbound_submissions" ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_assigned_admin_id_idx" ON "chat_threads" ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consultation_requests_assigned_to_idx" ON "consultation_requests" ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_entries_user_id_idx" ON "feedback_entries" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_entries_triaged_by_idx" ON "feedback_entries" ("triaged_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_feedback_captured_by_admin_idx" ON "customer_feedback" ("captured_by_admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_feedback_published_for_user_idx" ON "customer_feedback" ("published_for_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_referrals_referrer_user_id_idx" ON "partner_referrals" ("referrer_user_id");--> statement-breakpoint

-- Invites and agreements.
CREATE INDEX IF NOT EXISTS "invite_links_created_by_user_id_idx" ON "invite_links" ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_links_consumed_by_user_id_idx" ON "invite_links" ("consumed_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agreements_created_by_idx" ON "agreements" ("created_by");
