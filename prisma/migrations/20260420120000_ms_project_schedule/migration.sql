-- CreateEnum
CREATE TYPE "ScheduleLinkType" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateEnum
CREATE TYPE "TaskConstraintType" AS ENUM ('ASAP', 'ALAP', 'SNET', 'SNLT', 'MSO', 'MFO');

-- CreateEnum
CREATE TYPE "TaskScheduleMode" AS ENUM ('MANUAL', 'FIXED_UNITS', 'FIXED_WORK', 'FIXED_DURATION');

-- CreateTable
CREATE TABLE "WorkCalendar" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "weeklyPattern" JSONB NOT NULL DEFAULT '{"mon":480,"tue":480,"wed":480,"thu":480,"fri":480,"sat":0,"sun":0}',
    "exceptions" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleProgram" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleProgramProject" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleProgramProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBaseline" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "baselineIndex" INTEGER NOT NULL,
    "baselineStart" TIMESTAMP(3),
    "baselineFinish" TIMESTAMP(3),
    "baselineWorkMinutes" INTEGER,
    "baselineCost" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskBaseline_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workCalendarId" TEXT,
ADD COLUMN     "resourceStandardRatePerHour" DECIMAL(14,4),
ADD COLUMN     "resourceOvertimeRatePerHour" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "workCalendarId" TEXT,
ADD COLUMN     "defaultManualSchedule" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isManuallyScheduled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "constraintType" "TaskConstraintType" NOT NULL DEFAULT 'ASAP',
ADD COLUMN     "constraintDate" TIMESTAMP(3),
ADD COLUMN     "deadlineDate" TIMESTAMP(3),
ADD COLUMN     "durationWorkingMinutes" INTEGER,
ADD COLUMN     "workMinutes" INTEGER,
ADD COLUMN     "scheduleMode" "TaskScheduleMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fixedCost" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "TaskAssignee" ADD COLUMN     "unitsPercent" DOUBLE PRECISION NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "TaskDependency" ADD COLUMN     "linkType" "ScheduleLinkType" NOT NULL DEFAULT 'FS';

-- CreateIndex
CREATE INDEX "WorkCalendar_workspaceId_idx" ON "WorkCalendar"("workspaceId");

-- CreateIndex
CREATE INDEX "ScheduleProgram_workspaceId_idx" ON "ScheduleProgram"("workspaceId");

-- CreateIndex
CREATE INDEX "ScheduleProgramProject_projectId_idx" ON "ScheduleProgramProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleProgramProject_programId_projectId_key" ON "ScheduleProgramProject"("programId", "projectId");

-- CreateIndex
CREATE INDEX "TaskBaseline_taskId_idx" ON "TaskBaseline"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskBaseline_taskId_baselineIndex_key" ON "TaskBaseline"("taskId", "baselineIndex");

-- CreateIndex
CREATE INDEX "Project_workCalendarId_idx" ON "Project"("workCalendarId");

-- AddForeignKey
ALTER TABLE "WorkCalendar" ADD CONSTRAINT "WorkCalendar_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleProgram" ADD CONSTRAINT "ScheduleProgram_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleProgramProject" ADD CONSTRAINT "ScheduleProgramProject_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ScheduleProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleProgramProject" ADD CONSTRAINT "ScheduleProgramProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBaseline" ADD CONSTRAINT "TaskBaseline_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "WorkCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "WorkCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
