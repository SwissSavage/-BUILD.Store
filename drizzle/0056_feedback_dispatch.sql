-- Idempotent throughout: scripts/migrate.mjs rolls a whole file back
-- on a duplicate-object error and then records it as applied, so a
-- file that is partly new and partly already-present would silently
-- no-op while being marked done. Every statement here checks first.

-- Feedback requests go out on their own, to the right people, and we
-- can tell when they didn't.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-24)
--
-- The previous commit deleted the settle page's manual "Issue link"
-- button, because the admin pressing it was the same admin whose PM
-- rating fills in when the client stays silent. Removing the button
-- without building the automatic path made things WORSE, not better:
-- fewer requests go out than before, and reconcileBonusMargin treats
-- no-signal as the full margin earned. A dispatch that quietly fails
-- therefore pays every Bonus Margin in full. Nobody would see it.
--
-- So dispatch has to be unconditional AND observable. An "always goes
-- out" rule with no record of whether it went is a guarantee on paper.
--
-- ─────────────────────────────────────────────────────────────
-- ONE TOKEN PER MILESTONE PER RECIPIENT
--
-- issueFeedbackToken revoked every outstanding token for the contract
-- before minting a new one, so only one could ever be live. That was
-- right when one contract produced one rating. It is wrong now:
-- feedback is collected at every milestone, and a client usually has
-- more than one contact, so the same contract legitimately has several
-- live credentials at once.
--
-- The revoke is scoped to (context, milestone, recipient) instead, so
-- re-sending to one person about one milestone cannot silently kill
-- the link somebody else is holding.
--
-- recipient_email is recorded on the token rather than looked up at
-- submit time, so a reply can be attributed to a specific person even
-- if the contact list in HubSpot changes afterwards.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "customer_feedback_tokens"
  -- Which milestone this request is about. Null for a whole-engagement
  -- request, which is what a closing questionnaire still is.
  ADD COLUMN IF NOT EXISTS "milestone_id" text REFERENCES "project_milestones"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "recipient_email" text,
  -- Delivery, as observed rather than assumed.
  ADD COLUMN IF NOT EXISTS "delivery_status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "delivery_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamptz,
  -- The provider's own words. Kept verbatim: a paraphrased bounce is
  -- useless for working out whether an address is wrong or a server is
  -- down.
  ADD COLUMN IF NOT EXISTS "delivery_error" text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_feedback_tokens_delivery_status') THEN
    ALTER TABLE "customer_feedback_tokens" ADD CONSTRAINT "customer_feedback_tokens_delivery_status" CHECK (
    "delivery_status" IN ('pending', 'sent', 'failed', 'bounced')
  );
  END IF;
END $$;

-- Finding what did not arrive has to be cheap, because it runs on
-- every settle screen and in the sweep.
CREATE INDEX IF NOT EXISTS "customer_feedback_tokens_undelivered_idx"
  ON "customer_feedback_tokens" ("delivery_status")
  WHERE "delivery_status" IN ('failed', 'bounced');

CREATE INDEX IF NOT EXISTS "customer_feedback_tokens_context_milestone_idx"
  ON "customer_feedback_tokens" ("context_id", "milestone_id");

-- ─────────────────────────────────────────────────────────────
-- Feedback belongs to a client record, not to a typed string.
--
-- customer_feedback stored customer_name and customer_email as free
-- text with no foreign key, filled in by whoever opened a link. The
-- contract has known who the client is the whole time —
-- projects.client_ref_id — and the rating that moves money was the one
-- thing not joined to it.
--
-- That matters more now than it did. B averages every reading, so the
-- arithmetic has to know that four replies from one sponsor are one
-- person's view and not four. Email is the person-key; client_ref_id
-- is the company.
--
-- Name and email stay, as a point-in-time snapshot of what was true
-- when they answered. They are evidence, not identity.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "customer_feedback"
  ADD COLUMN IF NOT EXISTS "client_ref_id" text REFERENCES "clients"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "milestone_id" text REFERENCES "project_milestones"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "customer_feedback_client_ref_idx"
  ON "customer_feedback" ("client_ref_id");
