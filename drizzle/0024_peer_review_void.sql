-- Voiding a peer review.
--
-- Peer reviews were write-once with no way to remove one. They feed
-- recomputeMvpScore, which sets OVR, which sets standing band, trading
-- card tier and promotion eligibility. So a review submitted in error
-- or in bad faith moved someone's standing permanently, and no admin
-- surface rendered peer reviews at all, so nobody could even see it
-- had happened.
--
-- Soft void rather than DELETE. The row is evidence: a pattern of a
-- reviewer having their reviews voided is itself the thing an admin
-- needs to see, and it disappears if the rows do.
--
-- Reviews are excluded from every aggregate through getReviewsOf,
-- which is the single reader that both aggregateRating and
-- recomputeMvpScore call. Filtering there keeps the public rating and
-- the MVP snapshot from disagreeing about which reviews count.

ALTER TABLE peer_reviews
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by text REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

-- Every read of live reviews filters on voided_at IS NULL and keys on
-- reviewee. Partial index so the common path stays on the small side
-- of the table as voids accumulate.
CREATE INDEX IF NOT EXISTS peer_reviews_live_reviewee_idx
  ON peer_reviews (reviewee_id)
  WHERE voided_at IS NULL;
