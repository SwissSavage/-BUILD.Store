-- The real invoice, attached to the record of it.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-03)
--
-- Jamar: "the invoice Draft is not a real invoice correct... This site
-- doesn't generate the invoice, just a record of it. The real invoices
-- currently, are coming from my Found account."
--
-- He is right, and the schema did not say so anywhere. invoices.number
-- is NOT NULL UNIQUE and the app mints it: FM-2026-DRAFT-nnn becomes
-- FM-2026-nnn the moment an admin hits Issue. But nobody sends that
-- document. Found does. So one real invoice ends up with two
-- identifiers, FM's and Found's, and only FM's was written down. The
-- client pays against a number this system has never seen.
--
-- source_document_number is the number on the document the client
-- actually received. Deliberately NOT external_reference, which was
-- added in 0041 for the PAYMENT reference. Putting an invoice number
-- there would repeat the exact failure 0041 fixed: one column carrying
-- two meanings, so neither can be trusted.
--
-- The PDF goes in Postgres as base64, same reasoning as
-- 0042_application_resumes.sql: Drive is unprovisioned, R2 serves a
-- public URL when R2_PUBLIC_URL_BASE is set, and the Hetzner driver
-- writes inside the container where a redeploy destroys it. An invoice
-- is a financial record under the 7-year retention window, so it
-- belongs somewhere the database backup covers.
--
-- All nullable. Most invoices will never have an attached source
-- document, and an invoice without one is still a valid record.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "source_document_number" text;--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "source_document_name" text;--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "source_document_size" integer;--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "source_document_base64" text;--> statement-breakpoint

-- "Which of our records point at a Found invoice" is the question an
-- admin reconciling the books actually asks.
CREATE INDEX IF NOT EXISTS "invoices_source_document_number_idx"
  ON "invoices" ("source_document_number");
