-- Generic resource optional work calendar; task leveling delay + split-capable hint
ALTER TABLE "GenericResource" ADD COLUMN "workCalendarId" TEXT;
CREATE INDEX "GenericResource_workCalendarId_idx" ON "GenericResource"("workCalendarId");
ALTER TABLE "GenericResource" ADD CONSTRAINT "GenericResource_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "WorkCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN "levelingDelayWorkingDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "levelingCanSplit" BOOLEAN NOT NULL DEFAULT false;
