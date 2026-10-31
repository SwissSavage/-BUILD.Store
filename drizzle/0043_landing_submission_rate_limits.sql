CREATE TABLE IF NOT EXISTS landing_submission_rate_limits (
  visitor_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL
);
CREATE INDEX IF NOT EXISTS landing_submission_rate_limits_window_idx ON landing_submission_rate_limits (window_start);
