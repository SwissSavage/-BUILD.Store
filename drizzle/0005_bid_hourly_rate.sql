-- Add hourly_rate to project_applications so bid ceilings can be
-- enforced against the talent's compliance-tier rate cap
-- (see src/lib/rate-bounds.ts). Null-safe for legacy rows that
-- predate the rate-cap mechanic; new bids submitted via
-- BidOnContractForm are required to populate it.

ALTER TABLE "project_applications"
  ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10, 2);

-- Sanity check: bids on active contracts should stay within a sane
-- global bound regardless of the caller. Cheap belt-and-braces
-- against a UI or server-action bug bypassing the compliance-tier
-- computation.
--
-- Floor is intentionally $20 (below FM's $50 standard floor) so
-- small-task clients still have room to accept a scoped bid at a
-- lower rate when appropriate. Ceiling is $2,500 to accommodate
-- rare renowned-mentor tiers (e.g. Rob's ~$1,400/hr contact) with
-- headroom for admin overrides. Anything unusual near the ceiling
-- naturally flags for account-manager review during bid triage.
ALTER TABLE "project_applications"
  ADD CONSTRAINT "project_applications_hourly_rate_envelope"
  CHECK (
    "hourly_rate" IS NULL
    OR ("hourly_rate" >= 20 AND "hourly_rate" <= 2500)
  );
