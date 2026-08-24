-- Task #29 — RFP attachment upload (zero external deps).
--
-- Adds an attachments column to projects for RFP briefs, mood boards,
-- screenshots, etc. that clients want to include with their intake.
-- Attachments are base64-encoded and stored inline as jsonb: this is the
-- zero-external-deps posture (task #29 spec) until the R2 storage
-- backend (tasks #57 + #58) lands and we migrate to signed URLs.
--
-- Cap enforced at the action layer: max 3 files, 2 MB each. Postgres
-- can handle bigger, but base64 balloons ~33% and we don't want to
-- degrade page render times on /admin/rfps by shipping megabytes of
-- payload down the wire for every row.
--
-- Idempotent for the auto-migration runner (task #65).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS rfp_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
