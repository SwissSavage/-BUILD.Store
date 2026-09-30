-- A contributor proposes a minimum and may add a maximum. Existing single
-- values remain exact by copying each legacy value to its maximum.
ALTER TABLE "project_applications"
  ADD COLUMN IF NOT EXISTS "hours_per_week_max" integer,
  ADD COLUMN IF NOT EXISTS "hourly_rate_max" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "price_mode" text,
  ADD COLUMN IF NOT EXISTS "fixed_price_min" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "fixed_price_max" numeric(12, 2);

UPDATE "project_applications"
SET "hours_per_week_max" = "hours_per_week"
WHERE "hours_per_week" > 0 AND "hours_per_week_max" IS NULL;

UPDATE "project_applications"
SET "price_mode" = 'hourly', "hourly_rate_max" = "hourly_rate"
WHERE "hourly_rate" IS NOT NULL AND "price_mode" IS NULL;

ALTER TABLE "project_applications"
  ADD CONSTRAINT "project_applications_price_mode_valid"
    CHECK ("price_mode" IS NULL OR "price_mode" IN ('hourly', 'fixed', 'negotiable')),
  ADD CONSTRAINT "project_applications_hourly_max_valid"
    CHECK ("hourly_rate_max" IS NULL OR (
      "hourly_rate" IS NOT NULL AND "hourly_rate_max" >= "hourly_rate"
      AND "hourly_rate_max" <= 2500
    )),
  ADD CONSTRAINT "project_applications_fixed_price_valid"
    CHECK (("fixed_price_min" IS NULL OR "fixed_price_min" > 0)
      AND ("fixed_price_max" IS NULL OR (
        "fixed_price_min" IS NOT NULL AND "fixed_price_max" >= "fixed_price_min"
      ))),
  ADD CONSTRAINT "project_applications_hours_max_valid"
    CHECK ("hours_per_week_max" IS NULL OR (
      "hours_per_week_max" >= "hours_per_week" AND "hours_per_week_max" <= 80
    ));
