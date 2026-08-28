-- Audit-batch (2026-08-27): add indexes on high-read query paths
-- that showed up bare in the schema. Beta traffic won't crash without
-- them but every unread-notification badge, admin queue load, and
-- audit-log filter benefits from these.
--
-- Idempotent — safe to re-run.

-- Notifications: unread count + per-user reads run on every page
-- render for the bell dot. Ordered index accelerates the freshest-
-- first sort too.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

-- Audit log: /admin/audit-log filters by actor + resource. Ordered
-- index accelerates the reverse-chronological render.
CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx
  ON audit_log_entries (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx
  ON audit_log_entries (resource_kind, resource_id);

-- Project applications: /admin/rfps/[id]/bids + /admin/projects/applications
-- both filter by project_id + status. Compound index covers both.
CREATE INDEX IF NOT EXISTS project_applications_project_status_idx
  ON project_applications (project_id, status);

-- Peer reviews: reviewee lookups on profile + MVP score aggregation.
CREATE INDEX IF NOT EXISTS peer_reviews_reviewee_idx
  ON peer_reviews (reviewee_id);

-- Invite lifecycle: admin queue reads by createdAt desc + filters on
-- consumed/revoked. Partial index for still-live invites.
CREATE INDEX IF NOT EXISTS invite_links_created_desc_idx
  ON invite_links (created_at DESC);

-- Cooperative quotes: admin queue + client-magic-link lookups.
CREATE INDEX IF NOT EXISTS cooperative_quotes_project_idx
  ON cooperative_quotes (project_id);
