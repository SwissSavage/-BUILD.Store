-- Add tagline column to users. Short one-liner (~80 chars) shown on
-- player cards + public profile hero. Distinct from long-form bio.
-- Feeds /projects/[id]/quotes bid cards and the public Person card.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "tagline" text;
