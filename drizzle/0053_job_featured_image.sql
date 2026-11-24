-- Jobs get the same optional editorial image projects already have (0027),
-- so every listing board card has an image slot to fill. Issue #322.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "featured_image_url" text;
