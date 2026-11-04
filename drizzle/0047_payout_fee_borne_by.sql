-- Whose deduction the fee is.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-03)
--
-- 0046 recorded what a payout cost to send. It did not record who
-- paid it, and Jamar's rule has two cases: "we wouldn't deduct fees,
-- the deduction would go to whoever incurred the fee." Backend fees
-- fall on whoever requires the method; treasury only where nobody can
-- be assigned.
--
-- A deduction follows the payer, so an amount with no payer attached
-- is not bookkeeping evidence, it is a number. The recipient case is
-- the common one and the treasury case is the exception, which is
-- precisely why the exception has to be written down: nobody goes
-- looking for the ordinary case.
--
-- Nullable alongside payout_fee. No fee means nobody bore one.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_fee_borne_by" text;
