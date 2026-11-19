-- "The amount is right" and "I received it" are two statements.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-19)
--
-- Jamar, looking at the AWS settlement sitting in Awaiting manual
-- send: "the review process should also typically happen first, but
-- we need a flow that lands either in optional order specifically for
-- grandfather situations like this."
--
-- remittance-actions.ts had one acknowledgedAt standing for both of:
--
--   the figure is correct   answerable the moment the statement
--                           exists, before any money moves
--   the money arrived       only answerable after it has been sent
--
-- On a normal engagement those collapse into one act, which is why it
-- read as sensible when it shipped. The UI only offered the button
-- once the split was sent, so acknowledging meant both.
--
-- Two cases break it.
--
-- GRANDFATHERED WORK. The money landed before the app had a statement
-- for it. The recipient is then blocked from agreeing a figure they
-- were paid for weeks ago until an admin back-fills the send record,
-- which is the sequence running backwards.
--
-- DISPUTE AFTER PAYMENT. Being paid the wrong amount is the single
-- most likely moment for a dispute, and it was inexpressible: agree
-- and dispute wrote the same field, and the field was gated on
-- payment.
--
-- WHY acknowledged_at SURVIVES
--
-- It is not dropped and not repurposed. It now means "fully settled",
-- set when the SECOND of the two lands, so every existing read keeps
-- working untouched, including getOpenRemittanceDisputes which pairs
-- it against disputed_at to decide what is still open.
--
-- WHY THE BACKFILL SETS BOTH
--
-- Under the old UI gate an acknowledgement was only possible after
-- the split was sent, so every existing acknowledged_at genuinely
-- asserted both things. Backfilling both is a faithful reading of
-- what those recipients actually confirmed, not an assumption.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE remittances
  ADD COLUMN IF NOT EXISTS amount_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_confirmed_at timestamptz;

-- Faithful backfill: see the note above on why both, not just one.
UPDATE remittances
   SET amount_agreed_at     = acknowledged_at,
       receipt_confirmed_at = acknowledged_at
 WHERE acknowledged_at IS NOT NULL
   AND amount_agreed_at IS NULL;

-- Open disputes and open agreements are both read per recipient.
CREATE INDEX IF NOT EXISTS remittances_recipient_state_idx
  ON remittances (recipient_id, amount_agreed_at, receipt_confirmed_at);
