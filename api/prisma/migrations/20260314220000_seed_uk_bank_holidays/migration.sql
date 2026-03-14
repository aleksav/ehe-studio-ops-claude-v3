-- Seed UK bank holidays for 2025-2028 (safe to re-run)

-- 2025
INSERT INTO "public_holidays" ("id", "date", "name", "created_at")
SELECT gen_random_uuid(), d::date, n, NOW()
FROM (VALUES
  ('2025-01-01', 'New Year''s Day'),
  ('2025-04-18', 'Good Friday'),
  ('2025-04-21', 'Easter Monday'),
  ('2025-05-05', 'Early May Bank Holiday'),
  ('2025-05-26', 'Spring Bank Holiday'),
  ('2025-08-25', 'Summer Bank Holiday'),
  ('2025-12-25', 'Christmas Day'),
  ('2025-12-26', 'Boxing Day')
) AS v(d, n)
WHERE NOT EXISTS (
  SELECT 1 FROM "public_holidays" ph WHERE ph."date" = v.d::date
);

-- 2026
INSERT INTO "public_holidays" ("id", "date", "name", "created_at")
SELECT gen_random_uuid(), d::date, n, NOW()
FROM (VALUES
  ('2026-01-01', 'New Year''s Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Easter Monday'),
  ('2026-05-04', 'Early May Bank Holiday'),
  ('2026-05-25', 'Spring Bank Holiday'),
  ('2026-08-31', 'Summer Bank Holiday'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-28', 'Boxing Day (substitute)')
) AS v(d, n)
WHERE NOT EXISTS (
  SELECT 1 FROM "public_holidays" ph WHERE ph."date" = v.d::date
);

-- 2027
INSERT INTO "public_holidays" ("id", "date", "name", "created_at")
SELECT gen_random_uuid(), d::date, n, NOW()
FROM (VALUES
  ('2027-01-01', 'New Year''s Day'),
  ('2027-03-26', 'Good Friday'),
  ('2027-03-29', 'Easter Monday'),
  ('2027-05-03', 'Early May Bank Holiday'),
  ('2027-05-31', 'Spring Bank Holiday'),
  ('2027-08-30', 'Summer Bank Holiday'),
  ('2027-12-27', 'Christmas Day (substitute)'),
  ('2027-12-28', 'Boxing Day (substitute)')
) AS v(d, n)
WHERE NOT EXISTS (
  SELECT 1 FROM "public_holidays" ph WHERE ph."date" = v.d::date
);

-- 2028
INSERT INTO "public_holidays" ("id", "date", "name", "created_at")
SELECT gen_random_uuid(), d::date, n, NOW()
FROM (VALUES
  ('2028-01-03', 'New Year''s Day (substitute)'),
  ('2028-04-14', 'Good Friday'),
  ('2028-04-17', 'Easter Monday'),
  ('2028-05-01', 'Early May Bank Holiday'),
  ('2028-05-29', 'Spring Bank Holiday'),
  ('2028-08-28', 'Summer Bank Holiday'),
  ('2028-12-25', 'Christmas Day'),
  ('2028-12-26', 'Boxing Day')
) AS v(d, n)
WHERE NOT EXISTS (
  SELECT 1 FROM "public_holidays" ph WHERE ph."date" = v.d::date
);
