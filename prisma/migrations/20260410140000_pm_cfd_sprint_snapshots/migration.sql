-- AlterTable
ALTER TABLE "Task" ADD COLUMN "isMilestone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectCfdSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "byStatus" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCfdSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintMetricSnapshot" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "remainingPoints" DOUBLE PRECISION NOT NULL,
    "scopePoints" DOUBLE PRECISION NOT NULL,
    "completedCumulative" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCfdSnapshot_projectId_day_key" ON "ProjectCfdSnapshot"("projectId", "day");

-- CreateIndex
CREATE INDEX "ProjectCfdSnapshot_projectId_day_idx" ON "ProjectCfdSnapshot"("projectId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "SprintMetricSnapshot_sprintId_day_key" ON "SprintMetricSnapshot"("sprintId", "day");

-- CreateIndex
CREATE INDEX "SprintMetricSnapshot_sprintId_day_idx" ON "SprintMetricSnapshot"("sprintId", "day");

-- AddForeignKey
ALTER TABLE "ProjectCfdSnapshot" ADD CONSTRAINT "ProjectCfdSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintMetricSnapshot" ADD CONSTRAINT "SprintMetricSnapshot_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
