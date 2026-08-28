-- Task #63 — Payments hub: contributor payout method registry.
--
-- Before this table the only outbound rail was Stripe Connect, held on
-- users.stripe_account_id. A contributor without Stripe simply could
-- not be paid. This generalizes outbound into a registry so a
-- contributor can register Zelle, a Plaid-verified bank account, a
-- crypto wallet, or a mailing address for a check.
--
-- PayPal and Venmo are excluded by policy (2026-08-28). Venmo has no
-- payout path that doesn't run through PayPal, so the two come and go
-- together. See src/lib/payments/types.ts.
--
-- users.stripe_account_id is intentionally NOT dropped. The Stripe rail
-- falls back to it when no payout_methods row exists, so existing
-- connected accounts keep working through the cutover.
--
-- Idempotent — safe to re-run. Picked up by the auto-migration runner
-- (task #65) on deploy.

CREATE TABLE IF NOT EXISTS payout_methods (
  id             text PRIMARY KEY,
  user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rail           text NOT NULL,
  display_label  text NOT NULL,
  external_ref   text NOT NULL DEFAULT '',
  metadata       jsonb,
  is_default     boolean NOT NULL DEFAULT false,
  verified_at    timestamptz,
  last_error     text,
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL
);

-- Rail must be one of the five the hub knows how to dispatch. Kept as
-- a CHECK rather than a pg enum so adding a rail is an ALTER on the
-- constraint instead of an enum migration with a type rewrite.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payout_methods_rail_check'
  ) THEN
    ALTER TABLE payout_methods
      ADD CONSTRAINT payout_methods_rail_check
      CHECK (rail IN (
        'stripe_connect',
        'zelle',
        'plaid_ach',
        'crypto_wallet',
        'manual_check'
      ));
  END IF;
END $$;

-- Settlement looks up a contributor's methods on every payout.
CREATE INDEX IF NOT EXISTS payout_methods_user_idx
  ON payout_methods (user_id);

-- At most one default per contributor. A partial unique index enforces
-- this at the database rather than trusting application code to
-- unset the previous default inside a transaction that might fail
-- halfway. Ambiguity here means paying someone through the wrong rail.
CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_one_default_per_user
  ON payout_methods (user_id)
  WHERE is_default;

-- Same destination shouldn't be registered twice on the same rail.
CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_unique_destination
  ON payout_methods (user_id, rail, external_ref)
  WHERE external_ref <> '';
