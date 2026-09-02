-- A name the member chooses for themselves.
--
-- Until now the public name was derived from first + last initial, and
-- both were seeded from whatever the admin typed on the invite. That is
-- a reasonable default and a bad permanent answer: the cooperative
-- should not be the one deciding what someone is called, and plenty of
-- people work under a single name, a stage name, or a spelling the
-- invite got wrong.
--
-- Null means "use the first name and last initial convention", so
-- nothing changes for anyone who does not set one.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "display_name" text;
