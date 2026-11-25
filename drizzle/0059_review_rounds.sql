-- Idempotent throughout: scripts/migrate.mjs rolls a whole file back
-- on a duplicate-object error and then records it as applied, so a
-- file that is partly new and partly already-present would silently
-- no-op while being marked done. Every statement here checks first.

-- Reviews happen as a round, opened deliberately, not continuously.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-25)
--
-- Jamar: "We don't want reviews literally happening on the deal, only
-- people on the deal should see the reviews or be involved with the
-- review process. I as an admin, or another admin should be able to
-- configure how reviews will look before we send them out wholesale
-- to clients and participants. Everyone should be evaluated at the
-- same time."
--
-- What was built instead: review forms embedded on /projects/[id],
-- live the moment a contract hit completed. No configuration step, no
-- send, and nothing that made the evaluations simultaneous. A
-- Builder could be rated on Monday by somebody who happened to open
-- the deal page, and on Friday by somebody else, against a different
-- set of assigned roles.
--
-- That matters beyond tidiness. Roles decide which questions are
-- asked, and slots decide whose answer counts and how much. Both are
-- editable. If reviews trickle in while those are still being set,
-- the blend is computed from answers given under different rules —
-- and the blend decides money.
--
-- So a round has a shape:
--
--   draft   the admin assigns roles and slots and can see exactly
--           what each person will be asked. Nothing is sent. No
--           review can be submitted.
--   open    opened once, deliberately. Everybody is asked at the same
--           moment, against the configuration as it stood. Reviews
--           can be submitted.
--   closed  no further submissions. The blend is final.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THE CONFIGURATION IS FROZEN AT OPEN
--
-- Opening the round records the roles and slots as they stood, so a
-- later edit cannot retroactively change what somebody was asked or
-- how much their answer counted. The live tables stay editable for
-- the next round; this is the record of what this one ran under.
--
-- Without it, "configure before we send" is a suggestion rather than
-- a guarantee: an admin could open a round, see an unflattering
-- rating arrive, and move the rater out of the peer slot.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "engagement_review_rounds" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'draft',
  -- Frozen at open. Shape: { roles: {userId: string[]}, slots: {userId: slot} }
  "configuration" jsonb,
  "opened_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "opened_at" timestamptz,
  "closed_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "closed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_review_rounds_status') THEN
    ALTER TABLE "engagement_review_rounds" ADD CONSTRAINT "engagement_review_rounds_status" CHECK (
      "status" IN ('draft', 'open', 'closed')
    );
  END IF;
END $$;

-- One round per engagement. A second round would mean two blends and
-- no answer to which one set the margin.
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_review_rounds_one_per_project_idx"
  ON "engagement_review_rounds" ("project_id");

-- ─────────────────────────────────────────────────────────────
-- A ROUND IS NOT OPEN UNTIL EVERYONE HOLDS THE LINK
--
-- Jamar: "everyone involved should be getting signaled to leave a
-- review at the same time", and no reviewing happens "until everyone
-- has the review link/page."
--
-- So opening is not the moment an admin presses the button. It is the
-- moment the last person actually has it. Otherwise "everyone at the
-- same time" means "everyone the mail server happened to reach", and
-- the people whose send bounced get asked late or never — which is
-- how a blend ends up computed from whoever was easiest to contact.
--
-- One row per person who must be reached, written when the round
-- opens. Reviewing stays shut until every row is delivered.
--
-- The escape hatch matters as much as the rule. A client address that
-- bounces forever would otherwise freeze a round permanently, so an
-- admin can record that somebody was reached another way — a call, a
-- forwarded link — and that is a signed statement, not a checkbox.
-- Without it the honest move would be to lie to the system, and a
-- rule people have to lie to is worse than no rule.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "engagement_review_recipients" (
  "id" text PRIMARY KEY,
  "round_id" text NOT NULL REFERENCES "engagement_review_rounds"("id") ON DELETE CASCADE,
  -- A member on the engagement. Null for a client contact, who has no
  -- account.
  "user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
  -- Where it went. Held even for members, so a bounce is attributable
  -- to an address rather than to a person.
  "email" text NOT NULL,
  "kind" text NOT NULL,
  "delivery_status" text NOT NULL DEFAULT 'pending',
  "delivery_error" text,
  "delivered_at" timestamptz,
  -- Reached some other way. Requires a name and a reason.
  "reached_manually_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "reached_manually_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_review_recipients_kind') THEN
    ALTER TABLE "engagement_review_recipients" ADD CONSTRAINT "engagement_review_recipients_kind" CHECK (
      "kind" IN ('member', 'client')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_review_recipients_status') THEN
    ALTER TABLE "engagement_review_recipients" ADD CONSTRAINT "engagement_review_recipients_status" CHECK (
      "delivery_status" IN ('pending', 'delivered', 'failed')
    );
  END IF;
END $$;

-- A manual reach says who and why, or it is not recorded at all.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_review_recipients_manual_signed') THEN
    ALTER TABLE "engagement_review_recipients" ADD CONSTRAINT "engagement_review_recipients_manual_signed" CHECK (
      ("reached_manually_by_user_id" IS NULL AND "reached_manually_reason" IS NULL)
      OR ("reached_manually_by_user_id" IS NOT NULL AND "reached_manually_reason" IS NOT NULL)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "engagement_review_recipients_round_idx"
  ON "engagement_review_recipients" ("round_id");
