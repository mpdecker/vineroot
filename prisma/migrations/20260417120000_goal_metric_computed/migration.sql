-- Computed goal metrics: definition JSON + last run metadata
ALTER TABLE "GoalMetric" ADD COLUMN IF NOT EXISTS "definition" JSONB;
ALTER TABLE "GoalMetric" ADD COLUMN IF NOT EXISTS "lastComputedAt" TIMESTAMP(3);
ALTER TABLE "GoalMetric" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
