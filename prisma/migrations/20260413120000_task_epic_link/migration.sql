-- AlterTable
ALTER TABLE "Task" ADD COLUMN "epicTaskId" TEXT;

-- CreateIndex
CREATE INDEX "Task_epicTaskId_idx" ON "Task"("epicTaskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_epicTaskId_fkey" FOREIGN KEY ("epicTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
