-- Mark a bid an admin put on the board, rather than one the member sent.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-24)
--
-- #207: an admin needs to put a named person on a client quote when
-- that person never applied to the RFP. It happens — the right Builder
-- for a scope is often somebody who was not watching the board.
--
-- Everything downstream of the composer is keyed on
-- project_applications: the pick list, the one-bid-per-person rule,
-- the clientPresentedAt freeze on send, the audit entry. Giving the
-- admin-added path its own storage would mean a second construction
-- of ProposedBuilder that agrees with the first one today and drifts
-- from it later.
--
-- So an admin-added builder IS an application row, written by the
-- admin on the member's behalf, and this column records that it was.
--
-- WHY THE ADMIN'S ID AND NOT A BOOLEAN
--
-- "Who put this person in front of the client" is the question anyone
-- reading the quote later will actually have, and a boolean cannot
-- answer it. The flag is `IS NOT NULL` on the same column.
--
-- Nullable with no default: every existing row is a real bid from a
-- real member, and that is exactly what NULL means here.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "project_applications"
  ADD COLUMN IF NOT EXISTS "added_by_admin_id" text
  REFERENCES "users"("id");--> statement-breakpoint

-- Indexed for the same reason as every column in 0037: this one
-- references users.id, and an unindexed reference is 51 sequential
-- scans away from making a user delete take hours again.
CREATE INDEX IF NOT EXISTS "project_applications_added_by_admin_id_idx"
  ON "project_applications" ("added_by_admin_id");
