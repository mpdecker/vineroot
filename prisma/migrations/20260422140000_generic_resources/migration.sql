-- CreateTable
CREATE TABLE "GenericResource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxUnitsPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenericResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGenericResourceAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "genericResourceId" TEXT NOT NULL,
    "unitsPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskGenericResourceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenericResource_workspaceId_idx" ON "GenericResource"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskGenericResourceAssignment_taskId_genericResourceId_key" ON "TaskGenericResourceAssignment"("taskId", "genericResourceId");

-- CreateIndex
CREATE INDEX "TaskGenericResourceAssignment_taskId_idx" ON "TaskGenericResourceAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskGenericResourceAssignment_genericResourceId_idx" ON "TaskGenericResourceAssignment"("genericResourceId");

-- AddForeignKey
ALTER TABLE "GenericResource" ADD CONSTRAINT "GenericResource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGenericResourceAssignment" ADD CONSTRAINT "TaskGenericResourceAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGenericResourceAssignment" ADD CONSTRAINT "TaskGenericResourceAssignment_genericResourceId_fkey" FOREIGN KEY ("genericResourceId") REFERENCES "GenericResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
