-- Applications to /jobs postings. Separate table from
-- project_applications because jobs and projects are separate concepts:
-- jobs have compensation / employmentType (see JobPosting schema),
-- projects have budget / isRFP. Admins review at /admin/jobs/applications.

CREATE TABLE IF NOT EXISTS "job_applications" (
  "id" text PRIMARY KEY,
  "job_id" text NOT NULL REFERENCES "jobs"("id"),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "pitch" text NOT NULL,
  "portfolio_link" text,
  "desired_compensation" text,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by" text REFERENCES "users"("id"),
  "reviewed_at" timestamp with time zone,
  "admin_note" text,
  "withdrawn_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "job_applications_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn'))
);

-- Index for the admin queue view (pending first, then most recent).
CREATE INDEX IF NOT EXISTS "job_applications_status_created_idx"
  ON "job_applications" ("status", "created_at" DESC);

-- Prevent duplicate active applications per (job, user).
CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_unique_active"
  ON "job_applications" ("job_id", "user_id")
  WHERE "status" IN ('pending', 'approved');
