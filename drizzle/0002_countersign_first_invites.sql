-- Countersign-first invite flow.
--
-- Adds three columns to invite_links so the admin countersign step can
-- happen at invite-generation time (not after the invitee signs):
--
--   documenso_document_id       — the LOI doc id, minted at generate
--   admin_countersigned_at      — set by the webhook when the admin's
--                                 recipient reaches "completed" status
--   invitee_email_sent_at       — set when we dispatch the invitee's
--                                 branded email with their signing URL
--
-- All three are nullable so existing rows (pre-migration invites) don't
-- need backfill — they'll just show blank for these fields. New invites
-- populate them naturally.

ALTER TABLE "invite_links"
  ADD COLUMN "documenso_document_id" text,
  ADD COLUMN "admin_countersigned_at" timestamp with time zone,
  ADD COLUMN "invitee_email_sent_at" timestamp with time zone;
