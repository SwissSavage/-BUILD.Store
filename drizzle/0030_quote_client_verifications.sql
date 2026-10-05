-- Approving a quote now requires proving control of the mailbox the
-- signature is attributed to.
--
-- Reading the quote stays open on the client token. It is the decision
-- that needs an identity, not the read.

CREATE TABLE IF NOT EXISTS "quote_client_verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "quote_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "code_hash" text NOT NULL,
  "session_token" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "verified_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "quote_client_verifications"
    ADD CONSTRAINT "quote_client_verifications_quote_id_cooperative_quotes_id_fk"
    FOREIGN KEY ("quote_id") REFERENCES "cooperative_quotes"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Every decision looks up the caller's session on this column.
CREATE UNIQUE INDEX IF NOT EXISTS "quote_client_verifications_session_idx"
  ON "quote_client_verifications" ("session_token")
  WHERE "session_token" IS NOT NULL;

-- Code entry looks up the live request for one quote and address.
CREATE INDEX IF NOT EXISTS "quote_client_verifications_quote_email_idx"
  ON "quote_client_verifications" ("quote_id", "email");
