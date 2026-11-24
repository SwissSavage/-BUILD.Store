-- What somebody did on an engagement, so reviews can ask only about that.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-23)
--
-- Jamar: "Rob did not handle payments. Rob is essentially the account
-- manager and project manager in this case. He oversaw directed work,
-- changes, and guidance on quality. He also brought in the client. On
-- this project, I handled payments, sourced Ozy, managed coms between
-- Rob and Ozy and coordinated payments. Reviews must reflect roles so
-- people are not evaluated outside of their scope."
--
-- projects.admin_user_ids is a flat list, so every admin on an
-- engagement was asked all four PM axes. On AWS that meant Ozy would
-- be asked whether ROB paid on time, which he had nothing to do with.
--
-- A rating gathered on work somebody did not do is not a weak signal.
-- It is a false one, attached to a real person, feeding their
-- standing. The fix is not better copy on the form: it is knowing who
-- did what.
--
-- ─────────────────────────────────────────────────────────────
-- WHY PER PROJECT AND MANUAL
--
-- The same two people swap jobs between engagements. Rob brought in
-- this client; next time it may be Jamar. A role on the user row
-- would be a job title, and a job title is not what a reviewer is
-- being asked about. What matters is what this person did on THIS
-- engagement, and only somebody who was there can say.
--
-- ─────────────────────────────────────────────────────────────
-- THE ROLES
--
--   client_owner        brought in and holds the client relationship
--   delivery_oversight  directs the work, drives changes, judges quality
--   advisory            advised without directing or owning
--   sourcing            found and placed the talent
--   coordination        runs comms between the parties
--   payments            sends and tracks the money
--
-- A person holds one or more, and the review form asks the union of
-- their roles' axes. Which axis belongs to which role lives in
-- src/lib/engagement-roles.ts rather than here, because it is product
-- judgement that will change and a CHECK constraint is a bad place to
-- keep an opinion.
--
-- ─────────────────────────────────────────────────────────────
-- WHY NOT A jsonb COLUMN ON projects
--
-- A row per person per role is queryable: "every engagement where
-- somebody owned payments" is a WHERE rather than a scan with
-- client-side filtering. It also gets a real foreign key, so a
-- deleted account cannot leave a role pointing at nobody.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS engagement_roles (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  -- Who said so. Assigning a role changes what somebody can be judged
  -- on, so it is attributable.
  assigned_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT engagement_roles_known
    CHECK (role IN (
      'client_owner',
      'delivery_oversight',
      'advisory',
      'sourcing',
      'coordination',
      'payments'
    ))
);

-- One row per person per role per engagement. Holding a role twice
-- means nothing and would double-count any aggregate built on it.
CREATE UNIQUE INDEX IF NOT EXISTS engagement_roles_unique_idx
  ON engagement_roles (project_id, user_id, role);

CREATE INDEX IF NOT EXISTS engagement_roles_project_idx
  ON engagement_roles (project_id);

-- "Who has ever owned payments" and similar, without a scan.
CREATE INDEX IF NOT EXISTS engagement_roles_user_role_idx
  ON engagement_roles (user_id, role);
