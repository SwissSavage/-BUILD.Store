-- Setup coach: one flag, because everything else is already on the row.
--
-- The coach decides which steps to show by reading the member's own
-- profile columns: first_name, tagline, profile_image_url, discipline,
-- skills, plus a portfolio count. So a step disappears the moment the
-- thing it was asking for exists, with no progress table to drift out
-- of agreement with reality.
--
-- The one thing the row cannot tell us is "I saw this and I do not
-- want it again", which is what this column holds. Null means never
-- dismissed. Anyone who dismisses can still restart from the
-- walkthrough callout on /dashboard.
--
-- Deliberately NOT reusing walkthrough_progress. Its step_id is a
-- foreign key into walkthrough_steps, so every coach step would have
-- to be seeded as a row there, and then completion would be recorded
-- in two places that can disagree: a member could be ticked complete
-- on "add your tagline" while tagline is still null.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS setup_coach_dismissed_at timestamptz;
