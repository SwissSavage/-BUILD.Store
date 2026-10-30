-- What each person was paid, issued by us rather than billed to us.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-29)
--
-- Jamar: "Should we require an invoice from contractors to settle
-- payments when the terms are already laid out? It's something Chibu
-- used to require for no reason at all in my mind that I found
-- completely stupid and unnecessary given the paper trail."
--
-- He is right, and the pattern he is describing has a name. An invoice
-- asserts an amount owed by somebody who has not agreed it yet. By
-- settlement we already hold a countersigned engagement with the rate,
-- an attribution ledger, a milestone record and a split computed from
-- all three. A contractor's invoice would restate numbers this system
-- generated. It adds a document, no information, and a delay borne by
-- the person who already did the work.
--
-- So: self-billing. The cooperative issues the statement, the
-- recipient acknowledges it, and that acknowledgement is the record.
-- It is better evidence than an invoice, because the document is
-- generated from the splits actually written rather than typed by
-- somebody from memory, so it cannot disagree with what was paid.
-- Every service platform works this way and none of them make the
-- worker invoice.
--
-- WHY IT SNAPSHOTS INSTEAD OF JOINING
--
-- A remittance is what the person was told at the time. Rendering it
-- from live joins means a later correction silently rewrites history,
-- and the one document whose whole job is to be the record becomes
-- the one that cannot be trusted. Same reason a quote freezes its
-- proposed builders.
--
-- WHY THE VOUCHERS ARE ON IT
--
-- voucher-issuance.ts has no notification of any kind, so a member
-- earns $BUILD from a settlement and finds out by going to look.
-- Cash and vouchers are issued in the same pass and belong on the
-- same statement.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "remittances" (
  "id" text PRIMARY KEY NOT NULL,
  "contract_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  -- Not a foreign key with a cascade: a remittance outlives the
  -- account it was issued to, the same way the audit log outlives a
  -- deleted user. The snapshot below carries the name.
  "recipient_id" text NOT NULL,

  -- Which pool, so the statement can say why they were paid.
  "pool" text NOT NULL,

  -- Cash, in dollars, as written to revenue_splits.
  "cash_amount" numeric(12, 2) NOT NULL,
  -- Their share of that pool, for the "why this number" line.
  "share_pct" numeric(6, 3),
  -- $BUILD issued in the same settlement pass.
  "voucher_amount" numeric(14, 2) NOT NULL DEFAULT '0',

  -- Frozen at issue. [{ label, value }] rendered as the basis block:
  -- contract title, pool, weight or headcount, the rate, the period.
  "basis" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- The recipient's name as it stood when this was issued.
  "recipient_label" text NOT NULL,

  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "issued_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  -- The self-billing half that matters: they saw it and agreed.
  "acknowledged_at" timestamp with time zone,
  "disputed_at" timestamp with time zone,
  "dispute_note" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- One statement per recipient per contract settlement.
CREATE UNIQUE INDEX IF NOT EXISTS "remittances_contract_recipient_pool_idx"
  ON "remittances" ("contract_id", "recipient_id", "pool");--> statement-breakpoint

-- "What have I been paid" is the member-facing query.
CREATE INDEX IF NOT EXISTS "remittances_recipient_id_idx"
  ON "remittances" ("recipient_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "remittances_issued_by_user_id_idx"
  ON "remittances" ("issued_by_user_id");--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────
-- The payment reference stops inventing itself.
--
-- The ledger wrote:
--   mercuryReference: reference || inv.mercuryReference || `merc_${uuid}`
--
-- so leaving the field blank produced a Mercury-looking transaction id
-- that corresponds to nothing. The one field meant to point at the
-- real payment could hold a fiction, and nothing on screen said which.
--
-- Real invoices come out of Found now, not Mercury, and the app had
-- never heard of it. Rail is named explicitly and the reference is
-- nullable, because an unreferenced payment should look unreferenced.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "payment_rail" text;--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "external_reference" text;
