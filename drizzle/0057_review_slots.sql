-- Idempotent throughout: scripts/migrate.mjs rolls a whole file back
-- on a duplicate-object error and then records it as applied, so a
-- file that is partly new and partly already-present would silently
-- no-op while being marked done. Every statement here checks first.

-- Which slot a person's own rating counts in.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THIS IS NOT engagement_roles (2026-11-25)
--
-- Jamar: "question types should get one assignment, role types get
-- another."
--
-- Two different facts about the same person on the same engagement,
-- and conflating them was the gap:
--
--   engagement_roles        what somebody is ASKED ABOUT. Holding
--                           `payments` means others can be asked
--                           whether they paid on time. It governs the
--                           questions pointed AT them.
--
--   engagement_review_slots what somebody's OWN rating counts as.
--                           Whether their answer lands in the peer
--                           slot or the PM slot of the blend that
--                           decides the Bonus Margin.
--
-- Rob on AWS is the case that makes it obvious. He is asked about
-- scope clarity and responsiveness because he held client_owner and
-- delivery_oversight — that is engagement_roles. Separately, his
-- rating of the design work counts as a PEER rating, because he
-- studied design and his read on the craft is worth weighting. Those
-- two facts have nothing to do with each other, and before this there
-- was nowhere to record the second one.
--
-- ─────────────────────────────────────────────────────────────
-- ONE SLOT PER PERSON PER ENGAGEMENT
--
-- Unique on (project, user). A person cannot be both peer and PM on
-- the same engagement: the blend weights the slots 0.4 / 0.4 / 0.2,
-- and somebody sitting in two of them would carry weight twice.
--
-- The client slot has no rows here. Client readings arrive through
-- customer_feedback against the contract's client record, and a
-- client has no account to assign.
--
-- ─────────────────────────────────────────────────────────────
-- ONLY WHEN THE PEER SLOT CANNOT FILL ITSELF
--
-- Jamar: "this should only happen when there are fewer than 4 parties
-- on a project" — "or no one clearly in the peer category."
--
-- Assignment exists because a small engagement cannot fill its own
-- slots. AWS had three people: Ozy delivering, Rob and Jamar running
-- it. There is no second contributor to be Ozy's peer, so the peer
-- slot would sit empty and renormalize away, leaving the blend to the
-- client and the PM. Putting Rob in it is how a three-person job gets
-- a craft reading at all.
--
At four or more parties the slots usually fill themselves —
-- contributors are peers, the account-owning admin is PM — and a
-- manual override stops being a necessity and starts being a lever on
-- who gets to influence somebody's pay.
--
-- But the count is only a proxy for the thing that matters, which is
-- whether the person being rated HAS a peer. Five people where one
-- delivers and four run it leaves that one contributor just as
-- peerless as Ozy was. So the rule is a disjunction, and the second
-- half is the real one:
--
--   assignment is available when the engagement has fewer than four
--   parties, OR when the person being rated has no other contributor
--   alongside them.
--
-- Rows for a project that later grows past the threshold are ignored
-- rather than deleted: the engagement it was true for is still in the
-- record.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "engagement_review_slots" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- 'peer' or 'pm'. No 'client': see above.
  "slot" text NOT NULL,
  -- Assigning a slot changes how much someone's opinion moves money,
  -- so it carries a name the same way a gate waiver does.
  "assigned_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_review_slots_slot') THEN
    ALTER TABLE "engagement_review_slots" ADD CONSTRAINT "engagement_review_slots_slot" CHECK (
      "slot" IN ('peer', 'pm')
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "engagement_review_slots_one_per_person_idx"
  ON "engagement_review_slots" ("project_id", "user_id");

CREATE INDEX IF NOT EXISTS "engagement_review_slots_project_idx"
  ON "engagement_review_slots" ("project_id");
