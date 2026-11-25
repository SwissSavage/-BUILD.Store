-- Half-star ratings, stored as integer half-steps.
--
-- ─────────────────────────────────────────────────────────────
-- WHY HALF-STEPS AND NOT numeric (2026-11-24)
--
-- Ratings move to 0.5 increments on a 1.0-5.0 scale. The obvious
-- change is numeric(2,1), and it is the wrong one: node-postgres
-- returns numeric as a STRING, which is what broke three money pages
-- in #94. These columns feed the Bonus Margin reconciliation, so they
-- are money-adjacent now, and a silent string where a number is
-- expected would arrive as a payout error rather than a type error.
--
-- So: stars x 2, as integers 2..10. 7 means 3.5 stars. Doubling every
-- existing row is lossless, the arithmetic stays in integers, and
-- there is no float equality anywhere near a payout decision.
--
-- The 1-5 to 0-99 rescale in aggregatePeerReviewsIntoSubRating changes
-- from x19.8 to x9.9 in the same commit, since the maximum becomes 10.
--
-- ─────────────────────────────────────────────────────────────
-- WHY EVERY STATEMENT HERE IS IDEMPOTENT
--
-- scripts/migrate.mjs wraps each file in its own transaction, and on
-- a duplicate-object error it ROLLS THE WHOLE FILE BACK and then
-- records it as applied ("prior manual apply"). That is a sensible
-- rule for a file that is purely DDL. It is dangerous for this one,
-- which mixes a data rewrite with an ADD CONSTRAINT: if the
-- constraint already exists for any reason, the doubling above it is
-- undone and the migration is marked done. Ratings would stay 1-5
-- while every reader expects 2-10, with nothing in the log but
-- "recorded".
--
-- So: the UPDATEs double only values still in 1-5, and every DDL
-- statement checks for itself first. Running this file twice changes
-- nothing the second time, which is the runner's documented happy
-- path ("fully-idempotent migrations commit normally").
--
-- ─────────────────────────────────────────────────────────────
-- WHY A CHECK CONSTRAINT AND NOT JUST A COMMENT
--
-- A half-step column holding an odd 1..5 value is indistinguishable
-- from a correctly-doubled 1..5 half-star reading: a 4 could be
-- "4 stars, never migrated" or "2.0 stars, migrated". That ambiguity
-- cannot be resolved after the fact, so the floor of 2 is enforced in
-- the database. Any writer still sending 1 fails loudly instead of
-- recording half the rating somebody meant.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- DROP THE OLD 1-5 CONSTRAINTS FIRST (2026-11-25)
--
-- This migration failed on its first real run, took the container
-- down, and the site returned Bad Gateway:
--
--   [migrate] FAIL 0054_half_star_ratings.sql: new row for relation
--   "peer_reviews" violates check constraint
--   "peer_reviews_professionalism_range_check"
--
-- Obvious in hindsight. Ratings already carried CHECK constraints
-- pinning them to 1-5 — peer_reviews.professionalism from 0006, four
-- more on admin_reviews from 0052 — and doubling the values to 2-10
-- violates every one of them. I wrote the new constraints and never
-- asked what was already there.
--
-- The transaction rolled back, so no data was touched. The cost was
-- downtime, not corruption.
--
-- Dropped dynamically rather than by name. The migration files are
-- not the whole truth about a database that has been live for months:
-- a constraint added by hand on prod would not appear in any file
-- here, and naming them one by one would fail the same way a second
-- time. This finds every CHECK on these tables that pins a rating
-- column to the old scale, whatever it is called.
--
-- The `5` in the pattern is doing real work: it keeps
-- admin_reviews_paid_on_time_is_builder_only, which mentions
-- paid_on_time but encodes a source rule rather than a range, and
-- which must survive.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT rel.relname AS tbl, con.conname AS name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE con.contype = 'c'
      AND rel.relname IN (
        'peer_reviews', 'customer_feedback', 'admin_reviews', 'projects'
      )
      AND pg_get_constraintdef(con.oid) ~* '(stars|collaboration|craft|reliability|professionalism|communication|met_expectations|scope_clarity|responsiveness|shielded_from_churn|paid_on_time|pm_engagement_rating)'
      AND pg_get_constraintdef(con.oid) ~ '(BETWEEN 1 AND 5|<= *5|< *6)'
      AND con.conname NOT LIKE '%half_steps%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, r.name);
    RAISE NOTICE 'dropped old 1-5 constraint %.%', r.tbl, r.name;
  END LOOP;
END $$;

-- ── peer_reviews ─────────────────────────────────────────────
UPDATE "peer_reviews" SET
  "stars"           = CASE WHEN "stars"           <= 5 THEN "stars"           * 2 ELSE "stars"           END,
  "collaboration"   = CASE WHEN "collaboration"   <= 5 THEN "collaboration"   * 2 ELSE "collaboration"   END,
  "craft"           = CASE WHEN "craft"           <= 5 THEN "craft"           * 2 ELSE "craft"           END,
  "reliability"     = CASE WHEN "reliability"     <= 5 THEN "reliability"     * 2 ELSE "reliability"     END,
  "professionalism" = CASE WHEN "professionalism" <= 5 THEN "professionalism" * 2 ELSE "professionalism" END,
  "communication"   = CASE WHEN "communication"   <= 5 THEN "communication"   * 2 ELSE "communication"   END;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'peer_reviews_half_steps') THEN
    ALTER TABLE "peer_reviews" ADD CONSTRAINT "peer_reviews_half_steps" CHECK (
    "stars" BETWEEN 2 AND 10
    AND "collaboration" BETWEEN 2 AND 10
    AND "craft" BETWEEN 2 AND 10
    AND "reliability" BETWEEN 2 AND 10
    AND ("professionalism" IS NULL OR "professionalism" BETWEEN 2 AND 10)
    AND ("communication" IS NULL OR "communication" BETWEEN 2 AND 10)
  );
  END IF;
END $$;

-- ── customer_feedback ────────────────────────────────────────
UPDATE "customer_feedback" SET
  "overall_stars"    = CASE WHEN "overall_stars"    <= 5 THEN "overall_stars"    * 2 ELSE "overall_stars"    END,
  "met_expectations" = CASE WHEN "met_expectations" <= 5 THEN "met_expectations" * 2 ELSE "met_expectations" END,
  "communication"    = CASE WHEN "communication"    <= 5 THEN "communication"    * 2 ELSE "communication"    END;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_feedback_half_steps') THEN
    ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_half_steps" CHECK (
    "overall_stars" BETWEEN 2 AND 10
    AND "met_expectations" BETWEEN 2 AND 10
    AND "communication" BETWEEN 2 AND 10
  );
  END IF;
END $$;

-- ── admin_reviews (drizzle/0052) ─────────────────────────────
UPDATE "admin_reviews" SET
  "scope_clarity"       = CASE WHEN "scope_clarity"       <= 5 THEN "scope_clarity"       * 2 ELSE "scope_clarity"       END,
  "responsiveness"      = CASE WHEN "responsiveness"      <= 5 THEN "responsiveness"      * 2 ELSE "responsiveness"      END,
  "shielded_from_churn" = CASE WHEN "shielded_from_churn" <= 5 THEN "shielded_from_churn" * 2 ELSE "shielded_from_churn" END,
  "paid_on_time"        = CASE WHEN "paid_on_time"        <= 5 THEN "paid_on_time"        * 2 ELSE "paid_on_time"        END;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_reviews_half_steps') THEN
    ALTER TABLE "admin_reviews" ADD CONSTRAINT "admin_reviews_half_steps" CHECK (
    ("scope_clarity" IS NULL OR "scope_clarity" BETWEEN 2 AND 10)
    AND ("responsiveness" IS NULL OR "responsiveness" BETWEEN 2 AND 10)
    AND ("shielded_from_churn" IS NULL OR "shielded_from_churn" BETWEEN 2 AND 10)
    AND ("paid_on_time" IS NULL OR "paid_on_time" BETWEEN 2 AND 10)
  );
  END IF;
END $$;

-- ── projects.pm_engagement_rating ────────────────────────────
-- The PM slot in the blend. Weighted 0.2, down from the 0.6 the old
-- gate gave it, because it is the one slot filled by a party to the
-- outcome.
UPDATE "projects" SET
  "pm_engagement_rating" = "pm_engagement_rating" * 2
  WHERE "pm_engagement_rating" IS NOT NULL
    AND "pm_engagement_rating" <= 5;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_pm_rating_half_steps') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_pm_rating_half_steps" CHECK (
    "pm_engagement_rating" IS NULL
    OR "pm_engagement_rating" BETWEEN 2 AND 10
  );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Required reason on a sub-maximum rating.
--
-- Any axis scored below the maximum has to say what would have been
-- better. The forms enforce it and so do the server actions, but the
-- text has to live somewhere, and a per-axis column per table would be
-- twenty columns. One jsonb map of axis -> reason instead.
--
-- Not NOT NULL: a review that is all 10s owes no explanation, and
-- legacy rows predate the rule.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "peer_reviews"      ADD COLUMN IF NOT EXISTS "axis_reasons" jsonb;
ALTER TABLE "customer_feedback" ADD COLUMN IF NOT EXISTS "axis_reasons" jsonb;
ALTER TABLE "admin_reviews"     ADD COLUMN IF NOT EXISTS "axis_reasons" jsonb;
