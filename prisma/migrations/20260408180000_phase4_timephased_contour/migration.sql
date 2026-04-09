-- Phase 4: Timephased work contour (MSP-style distribution); scheduleSegments still display-only for CPM.

CREATE TYPE "TaskWorkContour" AS ENUM ('FLAT', 'FRONT_LOADED', 'BACK_LOADED', 'BELL');

ALTER TABLE "Task" ADD COLUMN "workContour" "TaskWorkContour" NOT NULL DEFAULT 'FLAT';
