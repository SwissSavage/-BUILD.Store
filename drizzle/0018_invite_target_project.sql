-- Invite to a specific contract.
--
-- An invite could name an email, a tier and a note, but not what the
-- person was being invited TO. So someone brought in for a particular
-- contract landed on a generic welcome page and had to go find the
-- work they were invited for.
--
-- target_project_id is nullable: a general membership invite has no
-- contract attached and behaves exactly as before.
--
-- ON DELETE SET NULL rather than CASCADE. Deleting a test contract
-- must not delete the invitation record of a real person who accepted
-- it — the invite is evidence about a member, not about the project.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

ALTER TABLE invite_links
  ADD COLUMN IF NOT EXISTS target_project_id text
    REFERENCES projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invite_links_target_project_idx
  ON invite_links (target_project_id)
  WHERE target_project_id IS NOT NULL;
