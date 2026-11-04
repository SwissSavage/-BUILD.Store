-- What it cost to get the money there.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-03)
--
-- Policy, decided with Jamar: anticipated digital-payment fees are
-- priced into the contract upfront so the client covers them, the way
-- the card gross-up already works inbound. Backend fees fall on
-- whoever requires the method, geography included — someone pricing
-- their work for this market has priced in the cost of being paid
-- from it.
--
-- Recorded regardless of who bears it, because a payment fee is a
-- deductible business expense and a deduction needs a number and a
-- date. Without this column the amount only exists on a bank
-- statement somebody would have to reconstruct a year later.
--
-- Nullable: domestic Found and ACH have no fee worth recording, and a
-- zero is a different claim from "there wasn't one".
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "revenue_splits"
  ADD COLUMN IF NOT EXISTS "payout_fee" numeric(12, 2);
