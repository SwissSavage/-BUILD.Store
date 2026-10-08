-- A client, as a thing that exists rather than a string.
--
-- projects.client_id was free text, which is why a cooperative quote
-- offered "u_Jamar" as the company name on a client-facing proposal,
-- and why a returning client had no path: a repeat engagement needs
-- something to repeat against.
--
-- This is a reference, not a CRM. HubSpot holds the companies, contacts,
-- deals and history. Held here: the pointer, and the display name, so a
-- proposal renders without a round trip to the API.

CREATE TABLE IF NOT EXISTS "clients" (
  "id" text PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "hubspot_company_id" text,
  "primary_contact_name" text,
  "primary_contact_email" text,
  "status" text DEFAULT 'active' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "created_by_user_id" text
);

DO $$ BEGIN
  ALTER TABLE "clients"
    ADD CONSTRAINT "clients_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One row per CRM company. Partial so the many clients with no HubSpot
-- record yet do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "clients_hubspot_company_idx"
  ON "clients" ("hubspot_company_id")
  WHERE "hubspot_company_id" IS NOT NULL;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_ref_id" text;

DO $$ BEGIN
  ALTER TABLE "projects"
    ADD CONSTRAINT "projects_client_ref_id_clients_id_fk"
    FOREIGN KEY ("client_ref_id") REFERENCES "clients"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "projects_client_ref_idx"
  ON "projects" ("client_ref_id");

-- ─────────────────────────────────────────────────────────────
-- BACKFILL
--
-- One client per distinct existing client_id string, then point the
-- projects at it. Additive: client_id is left in place untouched, so
-- nothing is lost and nothing depends on this having been right.
--
-- The strings are whatever anyone typed. Some are company names, some
-- are internal ids like "u_jamar". The names come across as-is rather
-- than being guessed at or cleaned, because a wrong company name on a
-- client-facing quote is worse than an obviously-wrong one an admin
-- will notice and fix.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "clients" ("id", "display_name", "status", "created_at")
SELECT
  'cl_legacy_' || md5(trim(p."client_id")),
  trim(p."client_id"),
  'active',
  now()
FROM "projects" p
WHERE trim(coalesce(p."client_id", '')) <> ''
GROUP BY trim(p."client_id")
ON CONFLICT ("id") DO NOTHING;

UPDATE "projects" p
SET "client_ref_id" = 'cl_legacy_' || md5(trim(p."client_id"))
WHERE p."client_ref_id" IS NULL
  AND trim(coalesce(p."client_id", '')) <> '';
