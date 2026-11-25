-- Idempotent throughout: scripts/migrate.mjs rolls a whole file back
-- on a duplicate-object error and then records it as applied, so a
-- file that is partly new and partly already-present would silently
-- no-op while being marked done. Every statement here checks first.

-- The Bonus Margin resolves on a scale, so the record of it needs
-- amounts, not just an outcome word.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-24)
--
-- bonus_decision was "released" or "reclaimed", and executeBonusDecision
-- either paid the whole talent_bonus_amount or credited the whole thing
-- to the recovery pool. There was nothing in between because the gate
-- it read was a threshold with a cliff at 4 stars.
--
-- The scale makes most real outcomes partial: a 3.5 earns 75% of the
-- margin and leaves the rest uncommitted. "Released" and "reclaimed"
-- cannot describe that, and neither can a single boolean, so the row
-- now carries what was actually earned, what is uncommitted, and the
-- blended rating that decided it.
--
-- bonus_decision keeps its old values for rows already settled under
-- the threshold, and gains "reconciled" for anything resolved on the
-- scale. The column is plain text (drizzle's enum is type-level only),
-- so no constraint has to be rewritten.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THE BLEND IS STORED AND NOT RECOMPUTED
--
-- It is the input to a payout. Recomputing it later would read reviews
-- that may since have been voided, a reviewer whose account was
-- deleted, or a different set of assigned slots — and quietly produce a
-- different number than the one the money was based on. A payout
-- decision has to be reproducible from the record of it, not from the
-- current state of everything it touched.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "bonus_earned_amount" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "bonus_uncommitted_amount" numeric(12, 2),
  -- Half-steps 2..10, matching every other rating since 0054. Null
  -- when no signal was collected at all, which pays the full margin.
  ADD COLUMN IF NOT EXISTS "bonus_blend_half_steps" numeric(4, 2),
  -- Which slots were filled, so the explanation can be rebuilt without
  -- re-reading reviews. jsonb rather than three columns because the
  -- slot set is a product decision and will change.
  ADD COLUMN IF NOT EXISTS "bonus_blend_inputs" jsonb,
  -- A fixed-rate election or a grandfather override, with who and why.
  -- Shape: { kind, byUserId, reason, at }. A bypass nobody signed is
  -- indistinguishable from a bug, so this is where the signature goes.
  ADD COLUMN IF NOT EXISTS "bonus_gate_waiver" jsonb;

-- The uncommitted balance is what a disposition acts on, and it must
-- never be negative. Catching that here rather than discovering it as
-- a payout that overdrew a contract.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_bonus_amounts_nonneg') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_bonus_amounts_nonneg" CHECK (
    ("bonus_earned_amount" IS NULL OR "bonus_earned_amount" >= 0)
    AND ("bonus_uncommitted_amount" IS NULL OR "bonus_uncommitted_amount" >= 0)
    AND (
      "bonus_blend_half_steps" IS NULL
      OR "bonus_blend_half_steps" BETWEEN 2 AND 10
    )
  );
  END IF;
END $$;
