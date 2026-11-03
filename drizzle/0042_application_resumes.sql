-- Resumes on job applications.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-03)
--
-- Jamar: "There needs to be a place to attach resumes, specifically on
-- the Application page." A $255k search was about to be shared into
-- rooms full of senior engineers with a form that accepted a pitch, an
-- optional portfolio URL, and nothing else.
--
-- WHY THE BYTES LIVE IN POSTGRES
--
-- storeFile() routes by kind: "doc" to Google Drive, "image" to R2,
-- everything else to Hetzner. Drive is unprovisioned and falls back,
-- R2 returns a public URL when R2_PUBLIC_URL_BASE is set, and the
-- Hetzner driver writes to HETZNER_UPLOAD_DIR, which defaults to
-- /var/fm/uploads inside the container. A resume on a public CDN URL
-- is a privacy failure, and one on a container path disappears on the
-- next deploy.
--
-- landing_submission_documents already solved this for the landing
-- intake: base64 in Postgres, served back through an admin-gated route
-- with Content-Disposition attachment, no-store and nosniff. It is
-- covered by the database backup, it has no volume to mount, and it
-- cascades when its parent row is deleted. Visitor applications reuse
-- that table. Member applications get the same treatment here, as
-- columns on the row they belong to, so the resume cannot outlive the
-- application or be fetched without going through the application.
--
-- Size is bounded at the trust boundary by validateLandingFiles:
-- PDF only, verified by the %PDF- magic bytes rather than the
-- client-supplied MIME type, 12MB per file.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "resume_name" text;--> statement-breakpoint
ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "resume_size" integer;--> statement-breakpoint
-- Nullable: a resume is optional, and an application without one is
-- still a real application.
ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "resume_base64" text;
