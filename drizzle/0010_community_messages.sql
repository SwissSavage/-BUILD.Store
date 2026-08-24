-- Task #64 — public community chat.
--
-- Simple message board for cooperative-wide conversation. Anyone can
-- READ (visitors + members); only Partner+ can post. Every post runs
-- through the PII scrubber (task #39). Display is first-name-only
-- (same rule as public talent profiles + EPKs).
--
-- Soft-delete via deleted_at so moderation actions stay auditable and
-- reversible. Admin (or the author) can delete.
--
-- Threading is deferred — parent_message_id is nullable and null for
-- MVP top-level-only. When threading lands, existing rows stay top-
-- level and new replies get parent_message_id populated.
--
-- Idempotent for the auto-migration runner (task #65).

CREATE TABLE IF NOT EXISTS community_messages (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_message_id text,
  body text NOT NULL,
  scrubbed_body text NOT NULL,
  pii_hits jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  deleted_by_user_id text REFERENCES users(id),
  deletion_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_messages_created_at_idx
  ON community_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS community_messages_user_id_idx
  ON community_messages (user_id);
