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
-- WHY A CHECK CONSTRAINT AND NOT JUST A COMMENT
--
-- A half-step column holding an odd 1..5 value is indistinguishable
-- from a correctly-doubled 1..5 half-star reading: a 4 could be
-- "4 stars, never migrated" or "2.0 stars, migrated". That ambiguity
-- cannot be resolved after the fact, so the floor of 2 is enforced in
-- the database. Any writer still sending 1 fails loudly instead of
-- recording half the rating somebody meant.
-- ─────────────────────────────────────────────────────────────

-- ── peer_reviews ─────────────────────────────────────────────
UPDATE "peer_reviews" SET
  "stars"          = "stars" * 2,
  "collaboration"  = "collaboration" * 2,
  "craft"          = "craft" * 2,
  "reliability"    = "reliability" * 2,
  "professionalism"= "professionalism" * 2,
  "communication"  = "communication" * 2;

ALTER TABLE "peer_reviews"
  ADD CONSTRAINT "peer_reviews_half_steps" CHECK (
    "stars" BETWEEN 2 AND 10
    AND "collaboration" BETWEEN 2 AND 10
    AND "craft" BETWEEN 2 AND 10
    AND "reliability" BETWEEN 2 AND 10
    AND ("professionalism" IS NULL OR "professionalism" BETWEEN 2 AND 10)
    AND ("communication" IS NULL OR "communication" BETWEEN 2 AND 10)
  );

-- ── customer_feedback ────────────────────────────────────────
UPDATE "customer_feedback" SET
  "overall_stars"    = "overall_stars" * 2,
  "met_expectations" = "met_expectations" * 2,
  "communication"    = "communication" * 2;

ALTER TABLE "customer_feedback"
  ADD CONSTRAINT "customer_feedback_half_steps" CHECK (
    "overall_stars" BETWEEN 2 AND 10
    AND "met_expectations" BETWEEN 2 AND 10
    AND "communication" BETWEEN 2 AND 10
  );

-- ── admin_reviews (drizzle/0052) ─────────────────────────────
UPDATE "admin_reviews" SET
  "scope_clarity"       = "scope_clarity" * 2,
  "responsiveness"      = "responsiveness" * 2,
  "shielded_from_churn" = "shielded_from_churn" * 2,
  "paid_on_time"        = "paid_on_time" * 2;

ALTER TABLE "admin_reviews"
  ADD CONSTRAINT "admin_reviews_half_steps" CHECK (
    ("scope_clarity" IS NULL OR "scope_clarity" BETWEEN 2 AND 10)
    AND ("responsiveness" IS NULL OR "responsiveness" BETWEEN 2 AND 10)
    AND ("shielded_from_churn" IS NULL OR "shielded_from_churn" BETWEEN 2 AND 10)
    AND ("paid_on_time" IS NULL OR "paid_on_time" BETWEEN 2 AND 10)
  );

-- ── projects.pm_engagement_rating ────────────────────────────
-- The PM slot in the blend. Weighted 0.2, down from the 0.6 the old
-- gate gave it, because it is the one slot filled by a party to the
-- outcome.
UPDATE "projects" SET
  "pm_engagement_rating" = "pm_engagement_rating" * 2
  WHERE "pm_engagement_rating" IS NOT NULL;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_pm_rating_half_steps" CHECK (
    "pm_engagement_rating" IS NULL
    OR "pm_engagement_rating" BETWEEN 2 AND 10
  );

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
ALTER TABLE "peer_reviews"      ADD COLUMN "axis_reasons" jsonb;
ALTER TABLE "customer_feedback" ADD COLUMN "axis_reasons" jsonb;
ALTER TABLE "admin_reviews"     ADD COLUMN "axis_reasons" jsonb;
