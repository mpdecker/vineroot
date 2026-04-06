-- Recurring tasks (RRULE string + optional end) and task/project templates
ALTER TABLE "Project" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Task" ADD COLUMN "recurrenceRule" TEXT,
ADD COLUMN "recurrenceUntil" TIMESTAMP(3),
ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;
