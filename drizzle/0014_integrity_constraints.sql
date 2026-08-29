-- Integrity constraints for the workflows going live in beta.
--
-- The sandbox enforced these in application code against in-memory
-- arrays, where a single process meant no real concurrency. Against
-- Postgres with multiple container replicas, application-level checks
-- are advisory: two simultaneous requests can both pass a
-- read-then-write guard before either commits.
--
-- These indexes make the guarantees real. The app keeps its checks for
-- clean error messages; the database is what actually holds the line.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

-- One peer review per reviewer → reviewee → project. Without this, a
-- double-submitted form skews the reviewee's MVP score.
CREATE UNIQUE INDEX IF NOT EXISTS peer_reviews_unique_per_context
  ON peer_reviews (context_id, reviewer_id, reviewee_id);

-- One pending application per member per project. Reapplying after a
-- rejection or withdrawal stays allowed, which is why this is a
-- partial index on status rather than a plain unique.
CREATE UNIQUE INDEX IF NOT EXISTS project_applications_one_pending
  ON project_applications (project_id, user_id)
  WHERE status = 'pending';

-- Milestone sequence numbers are positional within a project. Two
-- milestones sharing a sequence makes the client tracker render in
-- nondeterministic order.
CREATE UNIQUE INDEX IF NOT EXISTS project_milestones_unique_sequence
  ON project_milestones (project_id, sequence);

-- Notification reads by recipient, newest first. Complements the index
-- from 0012 by covering the unread-only path the nav badge hits on
-- every authenticated render.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- Portfolio review queue: admins filter to unreviewed items.
CREATE INDEX IF NOT EXISTS portfolio_items_pending_idx
  ON portfolio_items (created_at DESC)
  WHERE published_at IS NULL AND rejected_at IS NULL;

-- Public portfolio surfaces read published work by user.
CREATE INDEX IF NOT EXISTS portfolio_items_published_idx
  ON portfolio_items (user_id)
  WHERE published_at IS NOT NULL;
