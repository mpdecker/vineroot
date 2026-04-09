-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "effortDriven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSummaryRollup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workCalendarId" TEXT;

-- AlterTable
ALTER TABLE "TaskDependency" ADD COLUMN     "lagIsElapsed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Task_workCalendarId_idx" ON "Task"("workCalendarId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "WorkCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
