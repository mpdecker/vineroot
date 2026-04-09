-- Phase 2: MSP-style leveling priority + generic assignment per-use cost
ALTER TABLE "Task" ADD COLUMN "levelingPriority" INTEGER NOT NULL DEFAULT 500;

ALTER TABLE "TaskGenericResourceAssignment" ADD COLUMN "costPerUse" DECIMAL(14,4);
