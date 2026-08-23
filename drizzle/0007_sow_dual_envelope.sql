-- Task #45 — Client SOW template + dual-envelope dispatch on bid selection.
--
-- Adds the fields cooperative_quotes needs to (a) capture the client's
-- contact info at approval time (magic-link flow is anonymous otherwise)
-- and (b) track the two Documenso envelopes fired when a client picks
-- their lead: a client-facing SOW and a talent-facing engagement
-- confirmation. Envelope IDs are stored so the webhook can advance the
-- HubSpot deal to closedwon once both sides sign.
--
-- Idempotent: uses IF NOT EXISTS so the auto-migration runner (task #65)
-- can re-apply cleanly.

ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS client_contact_email text;
ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS client_contact_name  text;
ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS client_sow_documenso_id text;
ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS talent_engagement_documenso_id text;
ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS sow_dispatched_at timestamptz;
ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS sow_client_signed_at timestamptz;
ALTER TABLE cooperative_quotes ADD COLUMN IF NOT EXISTS sow_talent_signed_at timestamptz;
