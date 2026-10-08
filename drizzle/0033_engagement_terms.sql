-- Engagement terms for work started directly rather than won through an
-- RFP. A project had a budget and nothing else: no rate, no ceiling, no
-- scope. The only record of what was agreed lived in somebody's phone.
--
-- The ceiling is a not-to-exceed, not an estimate. This relationship
-- renegotiated hours twice because both times a number was agreed that
-- nobody could know yet. A cap commits to nothing about duration and
-- ends the negotiation in one line.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "engagement_basis" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "engagement_rate" numeric(12, 2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "engagement_ceiling_hours" numeric(8, 2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "engagement_scope" text;
