-- Aug 2026 — added communication as a distinct sub-rating (see
-- MvpSubRating union + MVP_WEIGHTS rebalance). Peer reviews now
-- capture a separate communication score alongside professionalism,
-- feeding aggregatePeerReviewsIntoSubRating() in mvp-score.ts.
--
-- Idempotent for the auto-migration runner (task #65).

ALTER TABLE peer_reviews ADD COLUMN IF NOT EXISTS communication integer;
