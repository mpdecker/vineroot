-- Phase 3: Cost & EVM — overtime minutes, budget task flag, optional cost ledger (TaskCostEntry).

ALTER TABLE "Task" ADD COLUMN "overtimeWorkMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "isBudgetTask" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TaskCostEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "description" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TaskCostEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskCostEntry_taskId_idx" ON "TaskCostEntry"("taskId");

ALTER TABLE "TaskCostEntry" ADD CONSTRAINT "TaskCostEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskCostEntry" ADD CONSTRAINT "TaskCostEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
