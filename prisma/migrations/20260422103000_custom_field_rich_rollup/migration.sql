-- CreateEnum
CREATE TYPE "CustomFieldComputedKind" AS ENUM ('NONE', 'SUBTASK_ROLLUP_NUMBER');

-- CreateEnum
CREATE TYPE "CustomFieldRollupAggregation" AS ENUM ('SUM', 'AVG', 'MIN', 'MAX', 'COUNT');

-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN     "description" TEXT,
ADD COLUMN     "defaultValue" JSONB,
ADD COLUMN     "computedKind" "CustomFieldComputedKind" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "rollupSourceFieldId" TEXT,
ADD COLUMN     "rollupAggregation" "CustomFieldRollupAggregation";

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_rollupSourceFieldId_fkey" FOREIGN KEY ("rollupSourceFieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_rollupSourceFieldId_idx" ON "CustomFieldDefinition"("rollupSourceFieldId");
