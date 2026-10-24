-- Real credentials for the client tracker link.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-24)
--
-- /contracts/[id]/tracker gated on a three-entry map written into the
-- page file. One entry was `demo: "*"`, which authorized every project
-- id in the database: milestone titles, descriptions, due dates, owner
-- names and the client label, for any contract, to anyone who typed
-- ?token=demo.
--
-- This is the identical bug that was found and fixed on
-- /contracts/[id]/feedback on 2026-09-04. The fix never came back to
-- the tracker, so the lesson was learned in one file and not the one
-- next to it.
--
-- WHY NOT customer_feedback_tokens
--
-- The columns are nearly the same, which is the argument against
-- reusing it rather than for. A questionnaire link is spent once and
-- dies. A tracker link is opened repeatedly for the length of the
-- engagement; that IS the feature. Two lifecycle rules in one table is
-- one consumeFeedbackToken call away from killing a client's tracker
-- in the middle of a project.
--
-- No used_at for that reason. Revocation and expiry are the only ways
-- it stops working.
--
-- last_viewed_at because "has the client actually opened this" is a
-- question worth being able to answer, and a link nobody has touched
-- in six weeks says the engagement went quiet somewhere else.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_tracker_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "token" text NOT NULL UNIQUE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "issued_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_viewed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);--> statement-breakpoint

-- Resolving a link is a lookup by token on every tracker page load.
-- UNIQUE already indexes it, so this covers the other direction: the
-- admin surface asking "what is the live link for this project", and
-- the reissue path revoking whatever was outstanding.
CREATE INDEX IF NOT EXISTS "project_tracker_tokens_project_id_idx"
  ON "project_tracker_tokens" ("project_id");--> statement-breakpoint

-- References users.id, so it gets an index for the same reason as
-- every column in 0037: an unindexed reference is a sequential scan
-- that a user delete has to pay.
CREATE INDEX IF NOT EXISTS "project_tracker_tokens_issued_by_user_id_idx"
  ON "project_tracker_tokens" ("issued_by_user_id");
