-- Machine-proposed keyword tags awaiting admin review.
--
-- The field existed on the TypeScript type and nowhere else, so the
-- accept and reject actions in the inbound queue mutated an in-memory
-- object and had no column to write to. Both were permanently
-- decorative.
ALTER TABLE "inbound_submissions"
  ADD COLUMN IF NOT EXISTS "proposed_keyword_tags" jsonb NOT NULL DEFAULT '[]'::jsonb;
