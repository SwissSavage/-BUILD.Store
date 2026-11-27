-- Idempotent throughout: scripts/migrate.mjs rolls a whole file back
-- on a duplicate-object error and then records it as applied, so a
-- file that is partly new and partly already-present would silently
-- no-op while being marked done. Every statement here checks first.

-- Delivery has roles too, and they are not the management ones.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-25)
--
-- 0053 constrained engagement_roles.role to the six that describe
-- RUNNING an engagement: client owner, delivery oversight, advisory,
-- sourcing, coordination, payments. Those were drawn up as examples
-- for admins, and the reviews surface offered them for everybody on
-- the deal — so the system could record a designer as holding
-- "Payments", and reviewers would then be asked about it.
--
-- Jamar: "I was giving the 6 roles as examples for admin
-- specifically. There's nothing here for service providers", and
-- "It's misattributing her role."
--
-- ─────────────────────────────────────────────────────────────
-- WHY ONLY TWO, AND WHY delivery_lead CARRIES SOMETHING EXTRA
--
-- Delivery is not a mirror of management. Craft, reliability,
-- collaboration and communication apply to anyone who did the work,
-- so there is nothing to gate for a plain contributor and inventing
-- questions for one would ask reviewers to split hairs they cannot
-- see.
--
-- What does vary is accountability for the outcome. Jamar: "a
-- delivery lead is ultimately in part responsible for what gets
-- delivered if their failure to communicate is what caused a poor
-- outcome that needs documentation."
--
-- So delivery_lead unlocks one axis — whether they held the delivery
-- together — and that question is put to the people AROUND the lead.
--
-- ─────────────────────────────────────────────────────────────
-- A ROLE IS NEVER A SELF-ASSESSMENT
--
-- Worth writing on the table itself, because I kept describing it the
-- other way round. A row here is an admin's record of what somebody
-- DID. It decides which questions OTHER people are asked ABOUT them.
-- Nobody fills in anything about their own role anywhere in this
-- system.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "engagement_roles"
  DROP CONSTRAINT IF EXISTS "engagement_roles_known";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_roles_known') THEN
    ALTER TABLE "engagement_roles" ADD CONSTRAINT "engagement_roles_known" CHECK (
      role IN (
        -- Running it.
        'client_owner',
        'delivery_oversight',
        'advisory',
        'sourcing',
        'coordination',
        'payments',
        -- Delivering it.
        'delivery_lead',
        'contributor'
      )
    );
  END IF;
END $$;
