-- Payouts record what happened; they do not all claim to have caused it.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-03) — see task #113 for the full model.
--
-- Settlement assumed it initiates every payout. It does not. Money
-- leaves Found, which has no API, so the app records the movement
-- after the fact. Because that distinction did not exist in the
-- schema, the engine asserted things it never did:
--
--   * dispatchTransfer guards on `recipient && !stripePayoutsEnabled`.
--     house_treasury and house_liquidity_pool are sentinels, so
--     getUserById returns nothing, the guard is skipped, and both rows
--     are marked `sent` with a minted `tr_<uuid>`. The two rows that
--     need no transfer are the only ones claiming a successful one.
--   * Every human without Stripe Connect lands `failed`, which reads
--     as "something broke" when the truth is "we never tried, because
--     that is not how this person gets paid."
--
-- STATUSES
--   allocated        house pools. Terminal at settlement. Treasury
--                    funds business expenses, but that outflow is an
--                    expense ledger reconciled from the bank, not
--                    settlement's business.
--   awaiting_manual  a person on a record-mode method, not yet
--                    confirmed sent. Named in confirmManualPayout's
--                    docblock since it was written; never added here.
--   sent             confirmed, with date, reference and document.
--   failed           a routing method that actually tried and failed.
--
-- METHOD LIVES ON THE SPLIT, NOT THE USER
-- payout_methods is a per-user registry members do not maintain, and a
-- registry nobody fills in cannot decide where money goes. The admin
-- sends the money, so the admin picks the rail per participant, and
-- the same person can be paid differently on different engagements
-- without editing a profile. The id is validated against configured
-- methods rather than a pg enum, so adding Wise or Whop is config, not
-- a migration. Same lesson as REMIT_ACCOUNTS in 0044.
--
-- EVIDENCE IN PROPORTION TO IGNORANCE
-- A routing transition is self-evidencing: the API response is the
-- evidence. A record transition needs the reference, the real date,
-- and the payout document, because the app did not witness it. Inbound
-- attaches the real invoice (0043) because we did not issue it;
-- outbound attaches the real payout record because we did not send it.
-- Bytes in Postgres for the reasons in 0042 and 0043: every
-- storeFile() backend is unprovisioned, public, or container-local.
--
-- payout_sent_at already exists and now carries the REAL date the
-- money moved, which is routinely before anyone opened the app.
-- ─────────────────────────────────────────────────────────────

-- payout_status is a text column with a CHECK-free enum in Drizzle, so
-- widening the union is a type-level change. Nothing to alter here;
-- the comment records that `allocated` and `awaiting_manual` join
-- `pending | queued | sent | failed` as of this migration.

ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_method_id" text;--> statement-breakpoint
ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_reference" text;--> statement-breakpoint
ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_document_name" text;--> statement-breakpoint
ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_document_size" integer;--> statement-breakpoint
ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_document_base64" text;--> statement-breakpoint

-- "What is still awaiting a manual send" is the query an admin runs
-- every time they sit down to pay people.
CREATE INDEX IF NOT EXISTS "revenue_splits_payout_status_idx"
  ON "revenue_splits" ("payout_status");
