-- Add the `member` card tier to the canonization enum.
--
-- Membership is not a performance band. A Member with no published MVP
-- snapshot was falling to `standard` — the same neutral grey a Partner
-- gets — which read on their own card as though membership had been
-- lost because a rating hadn't been computed yet.
--
-- `member` is the floor a Member's card sits at from admission. Standing
-- bands modify it only once a rating exists; they never take it away.
-- Removing someone from membership is a cooperative decision recorded
-- against users.membership_tier, not a consequence of an OVR moving.
--
-- Postgres text-with-check columns: Drizzle models these as text, so
-- there is no enum type to ALTER. Nothing to do at the database level —
-- this file exists so the change is recorded in migration history
-- alongside the code that introduced it.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

SELECT 1;
