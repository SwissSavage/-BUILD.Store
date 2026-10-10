-- Circumvention review needs somewhere to record that a human looked.
--
-- Keyed on a hash of the reviewed text rather than on the member, so
-- clearing a bio clears that bio and not that person. Editing the text
-- changes the hash and the row returns to the review queue.

CREATE TABLE IF NOT EXISTS "profile_disclosure_reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "field" text NOT NULL,
  "text_hash" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone NOT NULL,
  "note" text
);

DO $$ BEGIN
  ALTER TABLE "profile_disclosure_reviews"
    ADD CONSTRAINT "profile_disclosure_reviews_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "profile_disclosure_reviews"
    ADD CONSTRAINT "profile_disclosure_reviews_reviewed_by_users_id_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The page looks up every review for the roster in one query.
CREATE INDEX IF NOT EXISTS "profile_disclosure_reviews_user_idx"
  ON "profile_disclosure_reviews" ("user_id");

-- One live decision per field per member. Re-reviewing after an edit
-- replaces the row rather than stacking a second one, so the table
-- stays the size of the roster instead of the size of its history.
CREATE UNIQUE INDEX IF NOT EXISTS "profile_disclosure_reviews_user_field_idx"
  ON "profile_disclosure_reviews" ("user_id", "field");
