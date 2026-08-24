-- Task #27 — Documenso accounts for members (perk).
--
-- Members and Partners get a free Documenso account on
-- sign.afuturemodern.com so they can send + track their own signed
-- documents through FM's Documenso instance.
--
-- Provisioning path is manual for now (member self-claims via a
-- deep link into Documenso signup). When OIDC federation (task #7)
-- lands, first sign-in via OIDC auto-provisions and these fields
-- reflect the auto-provisioned state.
--
-- Fields:
--   documenso_invited_at         — when the FM-side action was fired
--   documenso_account_linked_at  — when member confirmed the account
--                                  is live (self-report until OIDC)
--   documenso_user_id            — Documenso's user id once known
--
-- All nullable so pre-#27 rows keep loading. Idempotent for auto-
-- migration runner (#65).

ALTER TABLE users ADD COLUMN IF NOT EXISTS documenso_invited_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS documenso_account_linked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS documenso_user_id text;
