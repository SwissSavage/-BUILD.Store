-- Portfolio, and the opt-in that turns one into a public case study.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-27)
--
-- Jamar: "There needs to be a clear pipeline that moves deals into
-- portfolio, with an opt in to make it a case study."
--
-- /case-studies was wrong in two directions at once.
--
-- It auto-published. The index filtered on status = 'completed' AND
-- rfp_approved_at IS NOT NULL, so a contract became a public page the
-- moment settlement wrote `completed`. Nobody decided to publish it,
-- nobody wrote it up, and the client was never asked.
--
-- And it simultaneously excluded most of the work. rfp_approved_at is
-- null on every directly composed engagement, so Advanced Welding
-- could be fully settled and completed and never appear at all. That
-- gate dates from when every contract came through RFP intake. The
-- same assumption was already found and fixed once on the contract
-- operations buckets and never fixed here.
--
-- WHY A TABLE AND NOT COLUMNS ON projects
--
-- A portfolio entry is an authored thing, not an attribute of the
-- deal: a headline, a write-up, and a curated list of cited works that
-- is nothing like the raw attachment list. Hanging that off projects
-- would widen the busiest table in the schema with five columns only
-- this feature reads.
--
-- One entry per project, so project_id is UNIQUE. Writing a second
-- portfolio page for the same engagement is a mistake, not a feature.
--
-- WHY CONSENT IS A COLUMN AND NOT A CHECKBOX
--
-- Jamar chose: nothing publishes until the client has said yes. A
-- boolean records that somebody ticked a box. What is actually needed
-- a year later is who said yes, when, and how it was captured, so
-- that is what is stored. The publish action refuses without it; the
-- database does not enforce it, because an entry legitimately exists
-- in the portfolio state long before anyone asks.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "portfolio_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,

  -- The write-up. Authored, not derived from the brief: a scope
  -- summary written to win the work reads nothing like a description
  -- of what was delivered.
  "headline" text NOT NULL,
  "summary" text,

  -- Cited works. [{ label, url?, note? }]. Curated rather than the raw
  -- engagement attachments, which are internal and often contain
  -- things no client agreed to show anyone.
  "cited_works" jsonb DEFAULT '[]'::jsonb NOT NULL,

  -- 'portfolio' is internal. 'published' is live on /case-studies.
  "state" text DEFAULT 'portfolio' NOT NULL,

  -- Consent to appear publicly at all.
  "client_consent_at" timestamp with time zone,
  "client_consent_by" text,
  "client_consent_note" text,
  -- Separate from consent to appear: a client can agree to the work
  -- being shown and still not want to be named. Default false, so the
  -- depersonalized rendering is what happens when nobody decided.
  "client_may_be_named" boolean DEFAULT false NOT NULL,

  "created_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- The public index reads published entries newest first.
CREATE INDEX IF NOT EXISTS "portfolio_entries_state_idx"
  ON "portfolio_entries" ("state", "published_at");--> statement-breakpoint

-- References users.id, so it is indexed for the same reason as every
-- column in 0037: an unindexed reference is a sequential scan that a
-- user delete has to pay.
CREATE INDEX IF NOT EXISTS "portfolio_entries_created_by_user_id_idx"
  ON "portfolio_entries" ("created_by_user_id");
