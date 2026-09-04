-- Agreements with people who are not FM members.
--
-- ── THE BUG ──────────────────────────────────────────────────────
--
-- `agreements.user_id` was NOT NULL with a foreign key to users.id.
-- The Documenso webhook stores `ncnda:<email>` in that column for
-- NCNDA counterparties, because an outside company signing a mutual
-- NCNDA is not a member and has no user row.
--
-- That value cannot satisfy the foreign key, so the insert throws and
-- the agreement is never recorded. No NCNDA has ever been filed, and
-- none could be. Jamar reported the symptom rather than the cause:
-- "I just sent out another NCNDA to Aftab, but I'm not seeing it in
-- my inbox."
--
-- ── THE COUNTERPARTY IS A THING, NOT THREE COLUMNS ───────────────
--
-- Jamar: "we want to keep them on file, because ideally they will be
-- using our system a lot more."
--
-- So an outside party gets its own row, keyed on email, and every
-- agreement they sign points at it. Denormalised name/email/company
-- columns on `agreements` would have fixed the crash and left us
-- unable to answer "what has Aftab signed with us", which is the
-- question that matters once the same firm comes back.
--
-- ── PAPERWORK IS RECORDED WHEN SENT ──────────────────────────────
--
-- Rows used to be created only on completion, so a sent-but-unsigned
-- envelope was invisible everywhere except the audit log and there
-- was no way to see who owed us a signature. `signed_at` therefore
-- has to allow null: until they sign there is no signature date, and
-- putting the send date there would be a false date on a legal
-- record.
--
-- Additive and reversible. No existing row changes: every agreement on
-- file today has a real member in user_id and a real signed_at.

CREATE TABLE IF NOT EXISTS counterparties (
  id text PRIMARY KEY,
  -- Email is the identity. Same firm, same person, same row, however
  -- many agreements they sign over the years.
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  company text,
  notes text,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

ALTER TABLE agreements
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE agreements
  ALTER COLUMN signed_at DROP NOT NULL;

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS counterparty_id text REFERENCES counterparties(id);

-- An agreement has to be attached to somebody: a member, or a named
-- outside party, never neither. This is what keeps user_id going
-- nullable from producing orphan rows nobody can trace.
ALTER TABLE agreements
  DROP CONSTRAINT IF EXISTS agreements_has_a_party;

ALTER TABLE agreements
  ADD CONSTRAINT agreements_has_a_party
  CHECK (user_id IS NOT NULL OR counterparty_id IS NOT NULL);

-- One row per envelope per signing party. A multi-party NCNDA is one
-- envelope with up to three counterparties, so the envelope id alone
-- is not unique. This is what makes the webhook's upsert safe against
-- a retried delivery.
CREATE UNIQUE INDEX IF NOT EXISTS agreements_envelope_party_unique
  ON agreements (documenso_envelope_id, COALESCE(counterparty_id, user_id))
  WHERE documenso_envelope_id IS NOT NULL;

-- The outstanding-paperwork queue reads this.
CREATE INDEX IF NOT EXISTS agreements_awaiting_signature_idx
  ON agreements (signature_status)
  WHERE signature_status IS DISTINCT FROM 'completed';
