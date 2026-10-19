-- Cooperative quotes, versioned.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-19)
--
-- Jamar: "make quotes versioned, no real purpose right now, but as we
-- scale into paid positions we'll need it for proof of work."
--
-- The cooperative_quotes row is mutable today. Revise a quote — a
-- different hand of builders, a lower number — and the revision
-- overwrites the thing that was approved. The approval, the typed
-- signature and the statement all survive, attached to a row that no
-- longer says what the client saw.
--
-- That is survivable while the close happens on a call and Jamar
-- remembers. It stops being survivable the moment a Builder's pay
-- depends on which version of the scope was agreed, which is what
-- "paid positions" means.
--
-- WHY A SNAPSHOT AND NOT A DIFF
--
-- The snapshot holds the client-safe comparison exactly as rendered:
-- the builders, their strengths and trade-offs, the work samples, the
-- timeline and the client price. Reconstructing that from a chain of
-- diffs would mean the record depends on the replay being correct.
-- A snapshot is just true.
--
-- Deliberately mirrors sow_versions (0035) — same version_number
-- uniqueness, same stored PDF, same per-version signature state — so
-- there is one pattern to learn rather than two.
--
-- WHY THE PDF IS STORED
--
-- A signed document has to stay byte-identical to what was signed,
-- even after the renderer changes. Regenerating it later would quietly
-- produce a different document bearing the same signature.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cooperative_quote_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	-- 1, 2, 3… Unique per quote. Shown to the client as "v2" so both
	-- sides can name the same document out loud.
	"version_number" integer NOT NULL,
	-- The client-safe Quote Sheet as sent: one entry per builder with
	-- relevance, strengths, trade-offs, work samples, deliverables,
	-- timeline and final client price. Never payout basis, bid ranges,
	-- or any Future Modern fee — those are admin-only on every
	-- client-facing surface and must not leak into the record either.
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	-- Scope and headline as they stood for this version.
	"scope_summary" text,
	"client_total_line" text,
	-- The rendered Quote Sheet.
	"pdf_base64" text,
	"pdf_bytes" integer,
	-- Documenso envelope for this version specifically.
	"documenso_id" text,
	"signature_status" text DEFAULT 'draft' NOT NULL,
	-- The signature as given against THIS version, kept alongside the
	-- statement it was given against. cooperative_quotes keeps its own
	-- copy of the latest for back-compat; this is the one that is
	-- answerable years later.
	"client_signature_typed" text,
	"client_signature_statement" text,
	"client_signature_ip" text,
	"client_signed_at" timestamp with time zone,
	"selected_lead_user_id" text,
	"sent_at" timestamp with time zone,
	-- Set when a later version replaces this one. Never deleted.
	"superseded_at" timestamp with time zone,
	-- Why a new version was cut. Admin-written.
	"change_note" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

-- Points at whichever version is current. Nullable: every quote that
-- existed before this migration has no versions behind it yet, and
-- backfilling one would be inventing a record of something that was
-- never sent as a version.
ALTER TABLE "cooperative_quotes"
  ADD COLUMN IF NOT EXISTS "current_version_id" text;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "cooperative_quote_versions"
   ADD CONSTRAINT "cooperative_quote_versions_quote_id_fk"
   FOREIGN KEY ("quote_id") REFERENCES "public"."cooperative_quotes"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "cooperative_quote_versions"
   ADD CONSTRAINT "cooperative_quote_versions_created_by_user_id_fk"
   FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "cooperative_quote_versions_quote_version_idx"
  ON "cooperative_quote_versions" ("quote_id", "version_number");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cooperative_quote_versions_quote_id_idx"
  ON "cooperative_quote_versions" ("quote_id");
