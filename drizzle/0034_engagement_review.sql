-- An engagement nobody has agreed to is not an engagement.
--
-- The first cut of the direct motion had one button: Start engagement.
-- It created the HubSpot deal, set the project in_progress, assigned
-- the Builder and notified them, in one irreversible press, off terms
-- the Builder had never seen. Jamar's note: "I don't think a raw hot
-- start should be an option. That leaves open principal agent problems
-- and all that's needed really is one review and click from talent."
--
-- So there is no hot start. Composing an engagement sends it to the
-- assigned Builder, who reads the terms and accepts or declines. Work
-- starts on acceptance and not before. The lift stays on the admin:
-- the Builder fills in nothing, they read one screen and click once.
--
-- WHY REFERENCES ARE A COLUMN
--
-- The material an engagement runs on is almost always a document the
-- client already has: a Google Doc to redesign, a brand kit, a brief.
-- Those were going to end up pasted into the scope field as raw URLs.
-- Held here they render as named items on both the review screen and
-- the agreement, so the scope reads as scope.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "engagement_state" text,
  ADD COLUMN IF NOT EXISTS "engagement_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "engagement_decided_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "engagement_decline_reason" text,
  ADD COLUMN IF NOT EXISTS "engagement_links" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "engagement_attachments" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Partial: only engagements composed through the direct motion carry a
-- state, and the queue only ever wants the ones waiting on somebody.
CREATE INDEX IF NOT EXISTS "projects_engagement_state_idx"
  ON "projects" ("engagement_state")
  WHERE "engagement_state" IS NOT NULL;
