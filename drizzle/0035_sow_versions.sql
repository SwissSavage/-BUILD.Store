-- Statements of Work, versioned.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-10-19)
--
-- The SOW dispatch has been failing silently since it was written.
-- approveCooperativeQuote calls inviteRecipientToTemplate with
-- DOCUMENSO_TEMPLATE_CLIENT_SOW, that env var is empty, the error is
-- caught into a failures[] array, and approval still reports success.
-- Nobody has ever been told that an approved quote sent no SOW.
--
-- The deeper problem is that a Documenso template could never have
-- worked here. Jamar: "The SOW changes with every project." A fillable
-- form with eight placeholders cannot carry a scope that is different
-- every time. So the SOW is authored in the app and rendered to PDF,
-- and the PDF is what goes to Documenso — per engagement, not per
-- template.
--
-- NOT DERIVED FROM A QUOTE. A direct engagement has no quote at all:
-- existing client, named talent, agreed rate, no RFP. Modelling the
-- SOW as a projection of a quote would have left exactly that motion
-- with no SOW, which is the gap this is meant to close. quote_id is
-- therefore nullable and project_id is the spine.
--
-- WHY VERSIONED
--
-- Jamar, asked directly: "make SoWs versioned." Send one, the client
-- asks for a change, send another — both stay on the record. A
-- superseded version is never edited and never deleted, so "what did
-- they actually sign" has an answer years later. Each version carries
-- its own rendered PDF and its own signature state, because those are
-- properties of a document rather than of an engagement.
--
-- Additive and idempotent, like every migration here: the runner
-- applies this at container start and records it in
-- _platform_migrations.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sows" (
	"id" text PRIMARY KEY NOT NULL,
	-- The engagement this governs. Every SOW has one; not every SOW
	-- has a quote behind it.
	"project_id" text NOT NULL,
	-- Present when the SOW came out of a cooperative quote, null for a
	-- direct engagement or a from-scratch draft.
	"quote_id" text,
	"client_ref_id" text,
	-- Points at whichever version is current. Nullable only in the
	-- instant between creating the parent and writing version 1.
	"current_version_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sow_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"sow_id" text NOT NULL,
	-- 1, 2, 3… Unique per SOW. Shown to the client as "v2" so both
	-- sides can refer to the same document out loud.
	"version_number" integer NOT NULL,
	-- The nine sections, each free content under a fixed key. The
	-- skeleton is what makes every rendered PDF consistent and
	-- guarantees the signature block exists; the contents differ every
	-- time. Keys: overview, objectives, providers, deliverables,
	-- timeline, roles, compensation, terms, acceptance.
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	-- Where this version came from, so an uploaded SOW and a generated
	-- one are distinguishable on the record.
	"origin" text DEFAULT 'authored' NOT NULL,
	-- The rendered document. Held rather than regenerated, because a
	-- signed PDF must stay byte-identical to what was signed even if
	-- the renderer changes later.
	"pdf_base64" text,
	"pdf_bytes" integer,
	-- Documenso envelope for this version specifically. A new version
	-- gets a new envelope; the old one is left alone.
	"documenso_id" text,
	"signature_status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	-- Set when a later version replaces this one. Never deleted.
	"superseded_at" timestamp with time zone,
	-- Why a new version was cut. Free text, admin-written.
	"change_note" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "sows" ADD CONSTRAINT "sows_project_id_projects_id_fk"
   FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
   ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "sows" ADD CONSTRAINT "sows_created_by_user_id_users_id_fk"
   FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "sow_versions" ADD CONSTRAINT "sow_versions_sow_id_sows_id_fk"
   FOREIGN KEY ("sow_id") REFERENCES "public"."sows"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "sow_versions" ADD CONSTRAINT "sow_versions_created_by_user_id_users_id_fk"
   FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- One v1, one v2, no two of either.
CREATE UNIQUE INDEX IF NOT EXISTS "sow_versions_sow_id_version_number_idx"
  ON "sow_versions" ("sow_id", "version_number");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sows_project_id_idx" ON "sows" ("project_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sow_versions_sow_id_idx" ON "sow_versions" ("sow_id");
