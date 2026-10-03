-- A proposal becomes read-only once it appears in a client-facing quote.
-- The timestamp preserves that lock even if an admin later removes the
-- quote in order to prepare a replacement.
ALTER TABLE project_applications
  ADD COLUMN IF NOT EXISTS client_presented_at timestamptz;
