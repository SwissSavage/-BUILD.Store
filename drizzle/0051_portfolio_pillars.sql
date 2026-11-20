-- A piece of work can belong to more than one pillar.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-19)
--
-- Jamar: "We should also be able to use multiple tags for portfolio
-- items."
--
-- portfolio_items.technologies is already a jsonb array, so free-text
-- tagging was never the constraint. The constraint is one column up:
-- `industry` is a single required enum, so a brand system that is
-- Creative Media AND Professional Services has to pick one, and the
-- pillar it drops is one that piece will never surface under.
--
-- That also contradicts how people are modelled. users carries
-- primaryIndustry plus a secondaryIndustries array, composed by
-- userPillars(). A member could be multi-pillar while their own work
-- could not.
--
-- WHY NOT REPLACE industry WITH AN ARRAY
--
-- Mirroring the user shape keeps one mental model instead of two, and
-- it keeps the migration non-destructive: `industry` stays notNull as
-- the primary, nothing existing moves, and every current read goes on
-- working untouched. A pillarsForItem() helper composes the two the
-- way userPillars() already does.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS secondary_industries jsonb NOT NULL DEFAULT '[]'::jsonb;
