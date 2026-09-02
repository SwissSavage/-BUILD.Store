-- Portfolio documents attached to a proposal.
--
-- Mirrors projects.rfp_attachments: base64 inline on the row, served
-- back through a gated route. Same trade-off, same migration path — when
-- R2 lands (#58) both columns drain to signed URLs together.
--
-- A link was the only way to show work, which assumes the work lives
-- somewhere linkable and public. Plenty of the strongest evidence is a
-- PDF case study or a deck that was never posted anywhere.

ALTER TABLE "project_applications"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb;
