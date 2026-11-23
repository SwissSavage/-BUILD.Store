-- Rate the admin who ran the engagement, and credit them on its work.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-23)
--
-- Jamar: "I think we should have admin/ project management ratings
-- and portfolios as well."
--
-- Clients rate the cooperative. Peers rate each other. Nobody rated
-- the person who scoped the work, staffed it, held the client and got
-- everyone paid. In a structure where the executive share exists
-- precisely because someone brought in and ran the deal, the
-- reputation layer recognised delivery alone.
--
-- It also left a Builder with no recorded way to say the scope was
-- vague, the client churned unchecked, or the money came late. Those
-- are the three things an admin most affects and the three a peer
-- review cannot express, because Craft and Collaboration do not
-- describe project management.
--
-- projects.admin_user_ids has named who runs each engagement since
-- #96. Nothing has ever read it for reputation.
--
-- ─────────────────────────────────────────────────────────────
-- WHY A SOURCE COLUMN
--
-- Builders and clients see different faces of the same person and
-- answer different subsets. "Paid on time" is Builder-only: a client
-- has no way to know and should not be asked. An aggregate that
-- cannot tell the two populations apart would average a question one
-- of them never saw.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THE DIMENSIONS ARE NULLABLE
--
-- Not every reviewer answers every axis, and a forced 3 is noise
-- dressed as data. Null means "did not say", which is different from
-- the middle of the scale, and the aggregate skips rather than
-- counting it.
--
-- ─────────────────────────────────────────────────────────────
-- ON ANONYMITY
--
-- reviewer_id is stored, as it is on peer reviews, because an
-- unattributable review cannot be rate-limited or withdrawn and a
-- compliance claim has to be traceable. It is never exposed to the
-- subject. That matters more here than in peer review: a Builder is
-- rating the person who decides what work they are offered next, and
-- if that cannot be made genuinely anonymous it is better not to ask
-- them at all.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_reviews (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The admin being rated. Drawn from projects.admin_user_ids.
  subject_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Who said it. Null for a client: they have no account, and the
  -- questionnaire token is the only identity they carry.
  reviewer_user_id text REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL,

  -- 1..5, null meaning "did not answer".
  scope_clarity integer,
  responsiveness integer,
  shielded_from_churn integer,
  -- Builder-only. A client cannot know when talent was paid.
  paid_on_time integer,

  prose text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_reviews_source_known
    CHECK (source IN ('builder', 'client')),
  -- A Builder review has a reviewer; a client review does not.
  CONSTRAINT admin_reviews_reviewer_matches_source
    CHECK (
      (source = 'builder' AND reviewer_user_id IS NOT NULL)
      OR (source = 'client' AND reviewer_user_id IS NULL)
    ),
  -- Clients are never asked about payment timing, so a value here
  -- from that source is a bug rather than an opinion.
  CONSTRAINT admin_reviews_paid_on_time_is_builder_only
    CHECK (source = 'builder' OR paid_on_time IS NULL),
  CONSTRAINT admin_reviews_scope_range
    CHECK (scope_clarity IS NULL OR scope_clarity BETWEEN 1 AND 5),
  CONSTRAINT admin_reviews_responsiveness_range
    CHECK (responsiveness IS NULL OR responsiveness BETWEEN 1 AND 5),
  CONSTRAINT admin_reviews_churn_range
    CHECK (shielded_from_churn IS NULL OR shielded_from_churn BETWEEN 1 AND 5),
  CONSTRAINT admin_reviews_paid_range
    CHECK (paid_on_time IS NULL OR paid_on_time BETWEEN 1 AND 5)
);

-- One Builder review per reviewer per admin per engagement. Clients
-- are excluded from the constraint because reviewer_user_id is null
-- for them and nulls do not collide; the questionnaire enforces
-- one-response-per-engagement on its own token.
CREATE UNIQUE INDEX IF NOT EXISTS admin_reviews_one_per_builder_idx
  ON admin_reviews (project_id, subject_user_id, reviewer_user_id)
  WHERE reviewer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_reviews_subject_idx
  ON admin_reviews (subject_user_id);

-- ──────────────────────────────────────────────────────────────
-- Portfolio credits.
--
-- One item per engagement with credited roles, rather than a second
-- item for the admin. A film credits a director and a producer on one
-- title; two entries for one piece of work drift apart, and the
-- engagement is one thing.
--
-- user_id stays as the owner, so every existing read keeps working
-- and the person whose work it is still controls it. Credits are
-- additive.
--
-- NOTE for whoever wires the reader: getPortfolioForUser currently
-- matches on user_id alone, so a credited admin will not see the item
-- on their profile until it matches owner OR credited.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS credits jsonb NOT NULL DEFAULT '[]'::jsonb;
