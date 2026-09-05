-- Questionnaire links that can be issued for a real contract.
--
-- ── THE BUG ──────────────────────────────────────────────────────
--
-- /contracts/[id]/feedback is the client-facing questionnaire, and it
-- gated on this, hardcoded in the page file:
--
--   const FEEDBACK_TOKENS: Record<string, string> = {
--     "tok_p_003_marisa": "p_003",
--     "tok_p_004_devon":  "p_004",
--     "tok_p_006_janelle": "p_006",
--   };
--
-- Three tokens, for three seed contracts, written in July. There is no
-- code anywhere that adds to that map, so no real contract has ever had
-- a valid questionnaire link and none could. Every attempt renders
-- "This link isn't valid".
--
-- The fallback does not cover it either. Admin capture on /admin/reserve
-- hard-requires a linked meeting_minute row as its structural evidence
-- gate, so it records a rating stated on a call. A written report
-- arriving by email has no minute and cannot be captured through it.
--
-- Both doors are shut, and the CVC engagement report is expected.
--
-- ── WHY A TABLE AND NOT A SIGNED JWT ─────────────────────────────
--
-- The page comment proposed signed JWTs. A row is better here. The
-- token has to be revocable and single-use, and a stateless JWT is
-- neither without a table to check against anyway. This is the same
-- shape already used by invoices, quotes, proposals and receipts.
--
-- Single use is enforced by used_at rather than deletion, so an admin
-- can still see that a link was issued, when, by whom, and whether it
-- was ever opened. A used token stops working but stays evidence.
--
-- ── FIELD NOTES ──────────────────────────────────────────────────
--
-- context_id is not a foreign key to projects.id on purpose: the same
-- rail will serve order feedback, whose context lives in another table.
-- context_kind carries which.
--
-- No cascade off users.id for issued_by_user_id. Deleting an admin must
-- not silently erase the record of who handed a client a credential.

CREATE TABLE IF NOT EXISTS "customer_feedback_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "token" text NOT NULL,
  "context_kind" text NOT NULL DEFAULT 'contract',
  "context_id" text NOT NULL,
  "issued_by_user_id" text,
  "issued_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "customer_feedback_tokens"
    ADD CONSTRAINT "customer_feedback_tokens_issued_by_users_id_fk"
    FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The token is the credential, so the lookup must be unique and indexed.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_feedback_tokens_token_key"
  ON "customer_feedback_tokens" ("token");

-- "Is there a live link out for this contract already?" on the admin
-- surface, so a second click does not mint a second credential.
CREATE INDEX IF NOT EXISTS "customer_feedback_tokens_context_idx"
  ON "customer_feedback_tokens" ("context_id");
