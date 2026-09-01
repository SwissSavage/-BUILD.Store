-- Soft delete for projects — the trash bin.
--
-- Admins need to remove test contracts and mistakes, but a hard
-- DELETE on a project takes its applications, milestones, attribution
-- entries and splits with it, and there is no way back. A wrong click
-- on the wrong row is unrecoverable.
--
-- So deletion sets deleted_at. The row keeps existing, drops off every
-- surface, and can be restored for a retention window. A purge job
-- clears anything past the window.
--
-- Why not a `status = 'deleted'` enum value: status is a lifecycle
-- field the settlement engine reads. Overloading it with a deletion
-- state would mean every existing status check silently starts
-- treating deleted rows as live ones it hasn't heard of.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id text REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS delete_reason text;

-- Every read filters `deleted_at IS NULL`, so this is the index that
-- carries the whole app's project listing.
CREATE INDEX IF NOT EXISTS projects_not_deleted_idx
  ON projects (status)
  WHERE deleted_at IS NULL;

-- The trash view: deleted rows, oldest deletion first, so whatever is
-- closest to being purged sits at the top.
CREATE INDEX IF NOT EXISTS projects_deleted_idx
  ON projects (deleted_at)
  WHERE deleted_at IS NOT NULL;
