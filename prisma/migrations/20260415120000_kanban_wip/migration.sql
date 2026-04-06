-- CreateEnum
CREATE TYPE "KanbanWipEnforcement" AS ENUM ('OFF', 'WARN', 'STRICT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "kanbanWipEnforcement" "KanbanWipEnforcement" NOT NULL DEFAULT 'OFF';

-- AlterTable
ALTER TABLE "Section" ADD COLUMN "wipLimit" INTEGER;
