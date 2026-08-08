CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agreement_type" text NOT NULL,
	"version" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"provider" text NOT NULL,
	"external_ref" text,
	"storage_url" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artist_epks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"hero_image_url" text,
	"tagline" text,
	"bio_short" text NOT NULL,
	"bio_long" text,
	"featured_work" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"press" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"track_record" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"social_handles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"web3_profiles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_note" text,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"admin_revision_note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attribution_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"weight" numeric(4, 3) NOT NULL,
	"notes" text,
	"logged_by" text NOT NULL,
	"logged_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_role_snapshot" text NOT NULL,
	"action" text NOT NULL,
	"resource_kind" text NOT NULL,
	"resource_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_hint" text,
	"session_hint" text,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "build_vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"source_type" text NOT NULL,
	"source_ref_id" text,
	"swap_status" text DEFAULT 'unswapped' NOT NULL,
	"swapped_to_tx_hash" text,
	"swapped_at" timestamp with time zone,
	"issued_at" timestamp with time zone NOT NULL,
	"notes" text,
	"issued_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"organizer_id" text NOT NULL,
	"attendee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_by_attendee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"external_client_name" text,
	"external_client_email" text,
	"project_id" text,
	"pm_user_id" text,
	"notes_preview" text,
	"recording_url" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender" text NOT NULL,
	"sender_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_token" text NOT NULL,
	"visitor_name" text NOT NULL,
	"visitor_email" text NOT NULL,
	"status" text NOT NULL,
	"assigned_admin_id" text,
	"admin_note" text,
	"created_at" timestamp with time zone NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"admin_last_read_at" timestamp with time zone,
	"visitor_last_read_at" timestamp with time zone,
	CONSTRAINT "chat_threads_visitor_token_unique" UNIQUE("visitor_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_sheet_id" text NOT NULL,
	"contract_id" text NOT NULL,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "client_proposals_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cohort_spotlights" (
	"id" text PRIMARY KEY NOT NULL,
	"period_key" text NOT NULL,
	"period_label" text NOT NULL,
	"user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headline" text NOT NULL,
	"narrative" text NOT NULL,
	"paragraph_slug" text,
	"published_at" timestamp with time zone NOT NULL,
	"selected_by_user_id" text NOT NULL,
	CONSTRAINT "cohort_spotlights_period_key_unique" UNIQUE("period_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consultation_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tier_id" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"company" text,
	"scope_buckets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"briefing" text NOT NULL,
	"budget_hint" text,
	"status" text NOT NULL,
	"assigned_to" text,
	"admin_note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cooperative_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_token" text NOT NULL,
	"project_id" text NOT NULL,
	"client_display_name" text NOT NULL,
	"proposed_builders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope" jsonb NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"created_by_user_id" text NOT NULL,
	"selected_lead_user_id" text,
	CONSTRAINT "cooperative_quotes_client_token_unique" UNIQUE("client_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cooperative_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"client_token" text NOT NULL,
	"project_id" text NOT NULL,
	"cash_flow_pct" numeric(5, 2) NOT NULL,
	"time_to_match_hours" integer NOT NULL,
	"milestones_hit" integer NOT NULL,
	"milestones_total" integer NOT NULL,
	"crew_peer_review_ovr_delta" numeric(6, 2) NOT NULL,
	"subsequent_project_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"collaborator_card_token_id" text,
	CONSTRAINT "cooperative_receipts_client_token_unique" UNIQUE("client_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"context_kind" text NOT NULL,
	"context_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"overall_stars" integer NOT NULL,
	"met_expectations" integer NOT NULL,
	"communication" integer NOT NULL,
	"would_hire_again" boolean NOT NULL,
	"prose" text NOT NULL,
	"contributor_shoutout" text,
	"attribution_consent" text,
	"google_review_opt_in" text,
	"google_review_followup_status" text,
	"google_review_followup_sent_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_quote" text,
	"published_for_user_id" text,
	"captured_by_admin_user_id" text,
	"capture_context" text,
	"meeting_minute_id" text,
	"client_confirmation_status" text,
	"client_confirmation_token" text,
	"client_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_feedback_client_confirmation_token_unique" UNIQUE("client_confirmation_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ecosystem_partners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"website_url" text,
	"affiliate_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_recovery_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"balance_usd" numeric(12, 2) NOT NULL,
	"drawn_usd" numeric(12, 2) NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"surface" text NOT NULL,
	"surface_label" text NOT NULL,
	"walkthrough_step_id" text,
	"sentiment" text NOT NULL,
	"note" text NOT NULL,
	"pillar" text,
	"tier" text NOT NULL,
	"status" text NOT NULL,
	"admin_note" text,
	"triaged_by" text,
	"triaged_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "future_modernist_recognitions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_kind" text NOT NULL,
	"period_label" text NOT NULL,
	"period_key" text NOT NULL,
	"narrative" text NOT NULL,
	"selected_by_user_id" text NOT NULL,
	"selected_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"submitter" text NOT NULL,
	"submitter_email" text,
	"submitter_company" text,
	"pillar_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keyword_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_admin_id" text,
	"triage_note" text,
	"deep_link_href" text,
	"linked_resource_id" text,
	"derived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_links" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"target_email" text NOT NULL,
	"target_tier" text NOT NULL,
	"target_name" text,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "invite_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"direction" text DEFAULT 'coop_to_client' NOT NULL,
	"document_kind" text DEFAULT 'invoice' NOT NULL,
	"contract_id" text,
	"source_ref_id" text,
	"source_invoice_ids" jsonb,
	"issuer_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"number" text NOT NULL,
	"client_token" text,
	"status" text NOT NULL,
	"payment_method" text,
	"accepts_card" boolean DEFAULT false NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"processing_fee" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"mercury_reference" text,
	"stripe_payment_intent_id" text,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_client_token_unique" UNIQUE("client_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"industry" text NOT NULL,
	"skills_required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compensation" text NOT NULL,
	"location" text NOT NULL,
	"employment_type" text NOT NULL,
	"posted_by" text NOT NULL,
	"posted_by_label" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"uploader_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"industry" text NOT NULL,
	"tier_gate" text NOT NULL,
	"playback_url" text NOT NULL,
	"poster_url" text,
	"duration" text,
	"status" text NOT NULL,
	"admin_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_minutes" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"format" text NOT NULL,
	"routing" text NOT NULL,
	"body" text,
	"recording_url" text,
	"uploaded_file" jsonb,
	"captured_by_user_id" text NOT NULL,
	"corrections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_canonizations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"tier" text NOT NULL,
	"ovr" integer,
	"recognition_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"caption" text,
	"frozen_at" timestamp with time zone NOT NULL,
	"token_id" text,
	"tba_address" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_tier" text NOT NULL,
	"current_tier" text NOT NULL,
	"status" text NOT NULL,
	"application_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mvp_compliance_penalties" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ovr_impact" integer NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mvp_scores" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ovr" integer NOT NULL,
	"sub_ratings" jsonb NOT NULL,
	"active_penalties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"is_provisional" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"buyer_id" text,
	"buyer_email" text NOT NULL,
	"buyer_name" text NOT NULL,
	"seller_id" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"house_fee" numeric(12, 2) NOT NULL,
	"processing_fee" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"stripe_payment_intent_id" text,
	"shipping_address" text,
	"tracking_number" text,
	"internal_note" text,
	"placed_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"split_distributed_at" timestamp with time zone,
	"admin_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"partner_kind" text NOT NULL,
	"referrer_user_id" text NOT NULL,
	"lead_contact_name" text NOT NULL,
	"lead_contact_email" text NOT NULL,
	"lead_company" text,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"converted_amount_usd" numeric(12, 2),
	"revshare_earned_usd" numeric(12, 2),
	"converted_at" timestamp with time zone,
	"decline_reason" text,
	"declined_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "peer_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"context_kind" text NOT NULL,
	"context_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewee_id" text NOT NULL,
	"stars" integer NOT NULL,
	"collaboration" integer NOT NULL,
	"craft" integer NOT NULL,
	"reliability" integer NOT NULL,
	"prose" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolio_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"project_url" text,
	"industry" text NOT NULL,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"published_title" text,
	"published_description" text,
	"hide_project_url" boolean DEFAULT false NOT NULL,
	"rejected_at" timestamp with time zone,
	"rejection_note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_affiliates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"affiliate_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"inventory_count" integer,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"proposed_role" text NOT NULL,
	"pitch" text NOT NULL,
	"hours_per_week" integer DEFAULT 0 NOT NULL,
	"portfolio_link" text,
	"status" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"admin_note" text,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_user_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"blocker_note" text,
	"completed_at" timestamp with time zone,
	"last_due_soon_notice_at" timestamp with time zone,
	"last_overdue_notice_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"industry" text NOT NULL,
	"skills_required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget" numeric(12, 2) NOT NULL,
	"status" text NOT NULL,
	"client_id" text NOT NULL,
	"assigned_member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kind" text NOT NULL,
	"is_rfp" boolean DEFAULT false NOT NULL,
	"rfp_approved_at" timestamp with time zone,
	"rfp_admin_note" text,
	"hubspot_stage" text,
	"hubspot_deal_id" text,
	"collected_revenue" numeric(12, 2),
	"collected_at" timestamp with time zone,
	"admin_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"talent_base_amount" numeric(12, 2),
	"talent_bonus_amount" numeric(12, 2),
	"bonus_gate" jsonb,
	"pm_engagement_rating" integer,
	"bonus_decision" text,
	"bonus_decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prospective_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"proposed_role" text NOT NULL,
	"pitch" text NOT NULL,
	"hours_per_week" integer DEFAULT 0 NOT NULL,
	"portfolio_link" text,
	"status" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_sheets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"price" text NOT NULL,
	"timeline" text NOT NULL,
	"work_samples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"member_note" text,
	"created_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_price" text,
	"approved_timeline" text,
	"strengths" text,
	"weaknesses" text,
	"rejected_at" timestamp with time zone,
	"rejection_note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reserve_pool_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" text NOT NULL,
	"credit_reason" text,
	"debit_reason" text,
	"recipient_id" text,
	"actor_user_id" text,
	"rationale" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text,
	"source_kind" text DEFAULT 'contract_settlement' NOT NULL,
	"source_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"pool" text NOT NULL,
	"share_pct" numeric(6, 3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"payout_status" text NOT NULL,
	"payout_sent_at" timestamp with time zone,
	"stripe_transfer_id" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pitch" text NOT NULL,
	"status" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_partners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"website_url" text,
	"affiliate_url" text,
	"pillar_hint" text,
	"shipped_together" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"vertical" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "store_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"type" text NOT NULL,
	"project_id" text,
	"description" text,
	"transaction_hash" text,
	"comp_stage" text,
	"withhold_reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "triangulated_composites" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"contributor_user_id" text NOT NULL,
	"admin_rating" numeric(3, 2),
	"peer_rating" numeric(3, 2),
	"client_rating" numeric(3, 2),
	"effective_weights" jsonb NOT NULL,
	"weighted_composite" numeric(4, 3) NOT NULL,
	"bonus_release_fraction" numeric(4, 3) NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"handle" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"profile_image_url" text,
	"avatar_portrait_url" text,
	"membership_tier" text DEFAULT 'viewer' NOT NULL,
	"primary_industry" text,
	"secondary_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_participation" boolean DEFAULT false NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discipline" text,
	"profile_mode" text DEFAULT 'contributor' NOT NULL,
	"bio" text,
	"portfolio_url" text,
	"build_token_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"talent_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"profile_public" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"wallet_address" text,
	"connected_wallet_address" text,
	"connected_wallet_provider" text,
	"wallet_connected_at" timestamp with time zone,
	"stripe_account_id" text,
	"stripe_payouts_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walkthrough_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"step_id" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walkthrough_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"order" integer NOT NULL,
	"tier" text NOT NULL,
	"pillar" text,
	"title" text NOT NULL,
	"blurb" text NOT NULL,
	"surface" text NOT NULL,
	"surface_label" text NOT NULL,
	"what_to_try" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feedback_prompt" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whitelist_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"tier_id" text NOT NULL,
	"buyer_id" text,
	"buyer_email" text NOT NULL,
	"buyer_name" text NOT NULL,
	"rail" text NOT NULL,
	"amount_usd" numeric(12, 2) NOT NULL,
	"processing_fee" numeric(12, 2) NOT NULL,
	"stripe_payment_intent_id" text,
	"crypto_tx_hash" text,
	"referrer_id" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"split_distributed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whitelist_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"blurb" text NOT NULL,
	"price_usd" numeric(12, 2) NOT NULL,
	"seat_cap" integer,
	"seats_claimed" integer DEFAULT 0 NOT NULL,
	"accent" text NOT NULL,
	"is_donation" boolean DEFAULT false NOT NULL,
	"is_consultation" boolean DEFAULT false NOT NULL,
	"perks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "whitelist_tiers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agreements" ADD CONSTRAINT "agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artist_epks" ADD CONSTRAINT "artist_epks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attribution_entries" ADD CONSTRAINT "attribution_entries_contract_id_projects_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attribution_entries" ADD CONSTRAINT "attribution_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attribution_entries" ADD CONSTRAINT "attribution_entries_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "build_vouchers" ADD CONSTRAINT "build_vouchers_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_availability" ADD CONSTRAINT "calendar_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_blocks" ADD CONSTRAINT "calendar_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_meetings" ADD CONSTRAINT "calendar_meetings_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_meetings" ADD CONSTRAINT "calendar_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_meetings" ADD CONSTRAINT "calendar_meetings_pm_user_id_users_id_fk" FOREIGN KEY ("pm_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_proposals" ADD CONSTRAINT "client_proposals_quote_sheet_id_quote_sheets_id_fk" FOREIGN KEY ("quote_sheet_id") REFERENCES "public"."quote_sheets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_proposals" ADD CONSTRAINT "client_proposals_contract_id_projects_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cohort_spotlights" ADD CONSTRAINT "cohort_spotlights_selected_by_user_id_users_id_fk" FOREIGN KEY ("selected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_tier_id_whitelist_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."whitelist_tiers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cooperative_quotes" ADD CONSTRAINT "cooperative_quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cooperative_quotes" ADD CONSTRAINT "cooperative_quotes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cooperative_quotes" ADD CONSTRAINT "cooperative_quotes_selected_lead_user_id_users_id_fk" FOREIGN KEY ("selected_lead_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cooperative_receipts" ADD CONSTRAINT "cooperative_receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_published_for_user_id_users_id_fk" FOREIGN KEY ("published_for_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_captured_by_admin_user_id_users_id_fk" FOREIGN KEY ("captured_by_admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engagement_recovery_pools" ADD CONSTRAINT "engagement_recovery_pools_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_walkthrough_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("walkthrough_step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_triaged_by_users_id_fk" FOREIGN KEY ("triaged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "future_modernist_recognitions" ADD CONSTRAINT "future_modernist_recognitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "future_modernist_recognitions" ADD CONSTRAINT "future_modernist_recognitions_selected_by_user_id_users_id_fk" FOREIGN KEY ("selected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_submissions" ADD CONSTRAINT "inbound_submissions_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_consumed_by_user_id_users_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_calendar_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."calendar_meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_canonizations" ADD CONSTRAINT "member_canonizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mvp_compliance_penalties" ADD CONSTRAINT "mvp_compliance_penalties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mvp_scores" ADD CONSTRAINT "mvp_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "peer_reviews" ADD CONSTRAINT "peer_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "peer_reviews" ADD CONSTRAINT "peer_reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospective_contributions" ADD CONSTRAINT "prospective_contributions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospective_contributions" ADD CONSTRAINT "prospective_contributions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_sheets" ADD CONSTRAINT "quote_sheets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_sheets" ADD CONSTRAINT "quote_sheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reserve_pool_ledger" ADD CONSTRAINT "reserve_pool_ledger_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reserve_pool_ledger" ADD CONSTRAINT "reserve_pool_ledger_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "revenue_splits" ADD CONSTRAINT "revenue_splits_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "triangulated_composites" ADD CONSTRAINT "triangulated_composites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "triangulated_composites" ADD CONSTRAINT "triangulated_composites_contributor_user_id_users_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whitelist_purchases" ADD CONSTRAINT "whitelist_purchases_tier_id_whitelist_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."whitelist_tiers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whitelist_purchases" ADD CONSTRAINT "whitelist_purchases_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whitelist_purchases" ADD CONSTRAINT "whitelist_purchases_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_canonizations_year_user" ON "member_canonizations" USING btree ("year","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "peer_reviews_unique" ON "peer_reviews" USING btree ("context_kind","context_id","reviewer_id","reviewee_id");