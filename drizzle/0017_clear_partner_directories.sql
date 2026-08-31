-- Clear the seeded partner directories.
--
-- The homepage "Service partners" section and /partners were
-- rendering seven service partners, three DAOs and ten affiliates
-- that came from fixture data. Every one of those is a public claim
-- that Future Modern has a signed relationship with that org.
--
-- Jamar 2026-08-31: nobody should be on the service-partner or SaaS
-- list right now. Keep ViiM and Reach, plus Giver Marketing — which
-- moves out of SaaS partners because it isn't a SaaS product.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

-- Run once against the live database. The seed only inserts on an
-- empty table, so rows already there have to be removed explicitly.
DELETE FROM service_partners;
DELETE FROM ecosystem_partners;
DELETE FROM product_affiliates
  WHERE id NOT IN ('pa_viim', 'pa_reach', 'pa_giver');
INSERT INTO product_affiliates (id, name, website_url, affiliate_url)
VALUES ('pa_giver', 'Giver Marketing', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
