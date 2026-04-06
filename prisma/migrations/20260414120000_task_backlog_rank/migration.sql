-- Optional ordering for unscheduled (backlog) root tasks; lower = higher priority. Cleared when task is assigned to a sprint.
ALTER TABLE "Task" ADD COLUMN "backlogRank" INTEGER;
