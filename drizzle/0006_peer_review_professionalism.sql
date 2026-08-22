-- Peer review: add professionalism sub-rating (task #28).
--
-- Fifth sub-rating alongside collaboration/craft/reliability. Peer-
-- graded sentiment for client-facing conduct — comms hygiene,
-- boundary respect, no side-channel moves. Distinct from the
-- admin-adjudicated mvp_compliance_penalties layer. Repeated dings
-- become the paper trail for a formal compliance penalty if the
-- pattern doesn't correct.
--
-- Nullable so legacy rows keep loading; new submissions always
-- populate via the form.

ALTER TABLE "peer_reviews"
  ADD COLUMN IF NOT EXISTS "professionalism" integer;

-- Optional bounds — 1-5 star scale matches the other sub-ratings.
-- Wrapped in DO block so re-running is safe (Postgres has no
-- "IF NOT EXISTS" for CHECK constraints).
DO $$ BEGIN
  ALTER TABLE "peer_reviews"
    ADD CONSTRAINT "peer_reviews_professionalism_range_check"
    CHECK ("professionalism" IS NULL OR ("professionalism" >= 1 AND "professionalism" <= 5));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
