import type { TaskScheduleResultDto } from '@vineroot/shared-types';
import type { Section, Task } from '../types';

export type ListScheduleFilter = 'all' | 'critical' | 'slack' | 'deadline';

export type ListScheduleSort =
  | 'none'
  | 'critical_first'
  | 'slack_desc'
  | 'deadline_breach_first'
  | 'constraint_type';

function filterTaskTree(tasks: Task[], pred: (task: Task) => boolean): Task[] {
  const out: Task[] = [];
  for (const t of tasks) {
    const sub = filterTaskTree(t.subtasks ?? [], pred);
    const keep = pred(t) || sub.length > 0;
    if (keep) out.push({ ...t, subtasks: sub });
  }
  return out;
}

function taskMatchesFilter(
  task: Task,
  filter: ListScheduleFilter,
  scheduleByTaskId: Map<string, TaskScheduleResultDto>,
  criticalIds: Set<string>,
): boolean {
  if (filter === 'all') return true;
  const row = scheduleByTaskId.get(task.id);
  switch (filter) {
    case 'critical':
      return criticalIds.has(task.id);
    case 'slack':
      return (
        (row?.totalSlackWorkingDays != null && row.totalSlackWorkingDays > 0) ||
        (row?.totalSlackDays != null && row.totalSlackDays > 0)
      );
    case 'deadline':
      return row?.deadlineViolated === true;
    default:
      return true;
  }
}

export function filterSectionsBySchedule(
  sections: Section[],
  filter: ListScheduleFilter,
  scheduleByTaskId: Map<string, TaskScheduleResultDto>,
  criticalIds: Set<string>,
): Section[] {
  if (filter === 'all') return sections;
  return sections.map((s) => ({
    ...s,
    tasks: filterTaskTree(s.tasks ?? [], (task) =>
      taskMatchesFilter(task, filter, scheduleByTaskId, criticalIds),
    ),
  }));
}

function slackKey(task: Task, scheduleByTaskId: Map<string, TaskScheduleResultDto>): number {
  const row = scheduleByTaskId.get(task.id);
  if (row?.totalSlackWorkingDays != null) return row.totalSlackWorkingDays;
  if (row?.totalSlackDays != null) return row.totalSlackDays;
  return 0;
}

function sortTasksRecursive(
  tasks: Task[],
  sort: ListScheduleSort,
  scheduleByTaskId: Map<string, TaskScheduleResultDto>,
  criticalIds: Set<string>,
): Task[] {
  if (sort === 'none') {
    return tasks.map((t) => ({
      ...t,
      subtasks: sortTasksRecursive(t.subtasks ?? [], sort, scheduleByTaskId, criticalIds),
    }));
  }
  const arr = [...tasks];
  arr.sort((a, b) => {
    const ra = scheduleByTaskId.get(a.id);
    const rb = scheduleByTaskId.get(b.id);
    switch (sort) {
      case 'critical_first': {
        const ca = criticalIds.has(a.id) ? 0 : 1;
        const cb = criticalIds.has(b.id) ? 0 : 1;
        if (ca !== cb) return ca - cb;
        return a.sortOrder - b.sortOrder;
      }
      case 'slack_desc': {
        const sa = slackKey(a, scheduleByTaskId);
        const sb = slackKey(b, scheduleByTaskId);
        if (sa !== sb) return sb - sa;
        return a.sortOrder - b.sortOrder;
      }
      case 'deadline_breach_first': {
        const da = ra?.deadlineViolated === true ? 0 : 1;
        const db = rb?.deadlineViolated === true ? 0 : 1;
        if (da !== db) return da - db;
        return a.sortOrder - b.sortOrder;
      }
      case 'constraint_type': {
        const ta = (a.constraintType ?? 'ASAP').localeCompare(b.constraintType ?? 'ASAP');
        if (ta !== 0) return ta;
        return a.sortOrder - b.sortOrder;
      }
      default:
        return a.sortOrder - b.sortOrder;
    }
  });
  return arr.map((t) => ({
    ...t,
    subtasks: sortTasksRecursive(t.subtasks ?? [], sort, scheduleByTaskId, criticalIds),
  }));
}

export function sortSectionsBySchedule(
  sections: Section[],
  sort: ListScheduleSort,
  scheduleByTaskId: Map<string, TaskScheduleResultDto>,
  criticalIds: Set<string>,
): Section[] {
  if (sort === 'none') return sections;
  return sections.map((s) => ({
    ...s,
    tasks: sortTasksRecursive(s.tasks ?? [], sort, scheduleByTaskId, criticalIds),
  }));
}
