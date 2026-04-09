import type { TaskScheduleResultDto } from '@vineroot/shared-types';
import type { Task } from '../types';

export type TaskScheduleInsight = {
  onCriticalPath: boolean;
  slackLabel: string | null;
  deadlineBreached: boolean;
};

export function computeTaskScheduleInsight(
  task: Task,
  scheduleByTaskId: Map<string, TaskScheduleResultDto>,
  criticalIds: Set<string>,
  options: { loadFailed: boolean; loading: boolean },
): TaskScheduleInsight | undefined {
  if (options.loadFailed || options.loading) return undefined;
  const row = scheduleByTaskId.get(task.id);
  const onCp = criticalIds.has(task.id);
  const sw = row?.totalSlackWorkingDays;
  const sd = row?.totalSlackDays;
  let slackLabel: string | null = null;
  if (sw != null && sw > 0) slackLabel = `${sw}w slack`;
  else if (sd != null && sd > 0) slackLabel = `${sd}d slack`;
  const deadlineBreached = row?.deadlineViolated === true;
  if (!onCp && !slackLabel && !deadlineBreached) return undefined;
  return { onCriticalPath: onCp, slackLabel, deadlineBreached };
}
