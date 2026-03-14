-- Seed default task rates (only inserts if no current rates exist for each type)
INSERT INTO "task_rates" ("id", "task_type", "day_rate", "currency_code", "effective_from", "effective_to", "created_at")
SELECT gen_random_uuid(), v.task_type::"TaskType", v.day_rate, 'GBP', '2025-01-01'::date, NULL, NOW()
FROM (VALUES
  ('ARCHITECTURE_ENGINEERING_DIRECTION', 1200.00),
  ('DESIGN_DELIVERY_RESEARCH', 950.00),
  ('DEVELOPMENT_TESTING', 650.00),
  ('BUSINESS_SUPPORT', 800.00)
) AS v(task_type, day_rate)
WHERE NOT EXISTS (
  SELECT 1 FROM "task_rates" tr
  WHERE tr."task_type" = v.task_type::"TaskType"
    AND tr."effective_to" IS NULL
);
