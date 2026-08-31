-- Clear the seeded partner directories.
--
-- The homepage "Service partners" section and /partners were
-- rendering seven service partners, three DAOs and ten affiliates
-- that came from fixture data. Every one of those is a public claim
-- that Future Modern has a signed relationship with that org.
--
-- Jamar 2026-08-31: nobody should be on the service-partner or SaaS
-- list right now. ViiM is the only affiliate that stays.
--
-- Reach and Giver Marketing were removed on a second pass: they are
-- talent groups, not products. Routing work to another talent group
-- goes through the cooperative, not through a public link that lets
-- someone tap that network directly.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

-- Run once against the live database. The seed only inserts on an
-- empty table, so rows already there have to be removed explicitly.
DELETE FROM service_partners;
DELETE FROM ecosystem_partners;
DELETE FROM product_affiliates WHERE id <> 'pa_viim';
