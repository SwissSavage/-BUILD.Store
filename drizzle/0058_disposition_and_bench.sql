-- Idempotent throughout: scripts/migrate.mjs rolls a whole file back
-- on a duplicate-object error and then records it as applied, so a
-- file that is partly new and partly already-present would silently
-- no-op while being marked done. Every statement here checks first.

-- What was decided about a shortfall, and who got benched for it.
--
-- ─────────────────────────────────────────────────────────────
-- DISPOSITION IS A DIRECTION, NOT AN ACTION (2026-11-25)
--
-- I had built reconcileBonusMargin to recommend three things in order
-- — corrective work, redistribution to coverers, cash rebate — and
-- assumed the next step was a surface that spends the uncommitted
-- balance. Jamar: "Disposition is a direction, not an action. The
-- payouts should stop where they landed if the project is over."
--
-- So nothing here moves money. The payouts already happened: the
-- Builder was paid their Base Rate plus whatever margin they earned,
-- and FM took 15% of that. What is left over simply stops. This
-- records which way the engagement went and what follows from it.
--
--   stop       the shortfall is absorbed. Nothing further is
--              distributed and nothing is owed back.
--   rebate     a concession goes to the client. Logged here; the
--              money itself moves through Found or Mercury like every
--              other payment. Once a rebate is the direction, nothing
--              else is distributed.
--   replace    the talent on the contract is swapped. The person
--              coming off is benched (below), and the person coming
--              on is engaged at a rate still to be agreed — in
--              substance a new contract, composed through the normal
--              flow rather than derived from the old one.
--
-- There is deliberately no "redistribute in proportion to coverage"
-- direction. That was my reading of the clause and it would have
-- needed a coverage ledger nobody keeps. A replacement IS the
-- coverage, and they are paid as their own engagement.
--
-- ─────────────────────────────────────────────────────────────
-- WHY BENCHING IS ITS OWN RECORD
--
-- Jamar: "there needs to be a record that a person was removed from
-- the deal / benched. Getting benched needs to remain a contract
-- result at conclusion so people are graded appropriately."
--
-- Being swapped off a live engagement is an outcome, not an edit.
-- Taking somebody out of projects.assigned_member_ids would make the
-- contract read as though they were never on it: their reviews would
-- detach, the engagement would vanish from their history, and the
-- grading would see a clean record. That is the opposite of
-- appropriate.
--
-- So the bench is a row that outlives the swap. It names the
-- engagement, the person, who decided and why, and it stays readable
-- at conclusion alongside the ratings.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "disposition_kind" text,
  ADD COLUMN IF NOT EXISTS "disposition_reason" text,
  ADD COLUMN IF NOT EXISTS "disposition_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "disposition_at" timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_disposition_kind') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_disposition_kind" CHECK (
      "disposition_kind" IS NULL
      OR "disposition_kind" IN ('stop', 'rebate', 'replace')
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "engagement_benchings" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  -- The person taken off. NOT removed from the engagement's history:
  -- the bench is the record that they were on it and came off.
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Who replaced them, when that is known at the time. Null when the
  -- seat has not been refilled yet.
  "replaced_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  -- Required. A bench with no stated reason is an accusation with no
  -- content, and it follows somebody into every later grading.
  "reason" text NOT NULL,
  "benched_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "engagement_benchings_user_idx"
  ON "engagement_benchings" ("user_id");

CREATE INDEX IF NOT EXISTS "engagement_benchings_project_idx"
  ON "engagement_benchings" ("project_id");
