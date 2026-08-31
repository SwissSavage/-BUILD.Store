-- Portfolio fraud signals (task #56, Agreement Section 16).
--
-- The weekly sweep has been writing its findings to an in-memory
-- array, so every flag it raised disappeared on the next deploy and
-- the admin review queue was permanently empty. There was no table to
-- write to — this adds it.
--
-- A signal is an accusation against a member's work. It carries a
-- disposition and a reviewer because a flag that can't be adjudicated
-- and recorded is just an unresolved suspicion sitting on someone's
-- file.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

CREATE TABLE IF NOT EXISTS portfolio_fraud_signals (
  id                          text PRIMARY KEY,
  kind                        text NOT NULL,
  portfolio_item_id           text NOT NULL
                                REFERENCES portfolio_items (id) ON DELETE CASCADE,
  offending_user_id           text NOT NULL
                                REFERENCES users (id) ON DELETE CASCADE,
  -- Nullable: an external_match has no colliding row on our side.
  colliding_portfolio_item_id text,
  colliding_user_id           text,
  signature                   text NOT NULL,
  confidence                  numeric(4,3) NOT NULL,
  detected_at                 timestamptz NOT NULL,
  reviewed_at                 timestamptz,
  reviewed_by_user_id         text REFERENCES users (id),
  disposition                 text,
  reviewer_note               text
);

-- The sweep runs weekly over every published portfolio item and must
-- not re-raise a signal it has already raised. Without this the queue
-- would grow by one duplicate row per item per week, and an admin who
-- dismissed a false positive would see it return every Sunday.
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_fraud_signals_dedupe
  ON portfolio_fraud_signals (portfolio_item_id, signature, kind);

-- The review queue reads pending first, oldest first.
CREATE INDEX IF NOT EXISTS portfolio_fraud_signals_pending_idx
  ON portfolio_fraud_signals (detected_at)
  WHERE reviewed_at IS NULL;

-- A member's own flag history, for the portfolio detail surface.
CREATE INDEX IF NOT EXISTS portfolio_fraud_signals_user_idx
  ON portfolio_fraud_signals (offending_user_id, detected_at DESC);
