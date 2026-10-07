-- Approving a quote is a signature now, not a one-time code.
--
-- The statement is stored with the signature rather than referenced,
-- because what matters later is the wording the signer actually read.
-- Changing the copy must not rewrite what past signers agreed to.

ALTER TABLE "cooperative_quotes" ADD COLUMN IF NOT EXISTS "client_signature_typed" text;
ALTER TABLE "cooperative_quotes" ADD COLUMN IF NOT EXISTS "client_signature_statement" text;
ALTER TABLE "cooperative_quotes" ADD COLUMN IF NOT EXISTS "client_signature_ip" text;
ALTER TABLE "cooperative_quotes" ADD COLUMN IF NOT EXISTS "client_signed_at" timestamp with time zone;
