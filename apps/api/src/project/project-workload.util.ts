import { TaskStatus } from '@prisma/client';
import {
  startOfCalendarDay,
  calendarDayToIsoKey,
} from './project-sprint-metrics.util';
import type {
  ProjectWorkloadCellDto,
  ProjectWorkloadDto,
  ProjectWorkloadRowDto,
} from '@vineroot/shared-types';

export const WORKLOAD_TERMINAL: TaskStatus[] = [
  TaskStatus.DONE,
  TaskStatus.CANCELLED,
];

export function startOfWeekMonday(d: Date): Date {
  const day = startOfCalendarDay(d);
  const dow = day.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(day);
  mon.setDate(mon.getDate() + diff);
  return startOfCalendarDay(mon);
}

export function enumerateWeekStarts(
  firstMonday: Date,
  weekCount: number,
): Date[] {
  const out: Date[] = [];
  let w = startOfCalendarDay(firstMonday);
  for (let i = 0; i < weekCount; i++) {
    out.push(new Date(w));
    w = new Date(w);
    w.setDate(w.getDate() + 7);
  }
  return out;
}

export type WorkloadTaskRow = {
  storyPoints: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  assignees: { userId: string; user: { displayName: string } }[];
};

const UNASSIGNED_ID = '__unassigned__';

function emptyAgg(weekCount: number) {
  return {
    cells: Array.from({ length: weekCount }, () => ({
      taskCount: 0,
      storyPoints: 0,
    })),
    unscheduled: { taskCount: 0, storyPoints: 0 },
    outOfRange: { taskCount: 0, storyPoints: 0 },
  };
}

export function buildProjectWorkloadDto(
  projectId: string,
  weekStarts: Date[],
  tasks: WorkloadTaskRow[],
): ProjectWorkloadDto {
  const weekCount = weekStarts.length;
  const weekKeys = weekStarts.map((ws) => calendarDayToIsoKey(ws));
  const map = new Map<
    string,
    {
      displayName: string;
      cells: ProjectWorkloadCellDto[];
      unscheduled: ProjectWorkloadCellDto;
      outOfRange: ProjectWorkloadCellDto;
    }
  >();

  const ensure = (userId: string, displayName: string) => {
    if (!map.has(userId)) {
      const base = emptyAgg(weekCount);
      map.set(userId, { displayName, ...base });
    }
  };

  for (const task of tasks) {
    const points = task.storyPoints ?? 0;
    const anchor = task.dueDate ?? task.startDate;
    const assigneeList =
      task.assignees.length > 0
        ? task.assignees
        : [{ userId: UNASSIGNED_ID, user: { displayName: 'Unassigned' } }];

    for (const a of assigneeList) {
      ensure(a.userId, a.user.displayName);
      const agg = map.get(a.userId)!;

      if (!anchor) {
        agg.unscheduled.taskCount += 1;
        agg.unscheduled.storyPoints += points;
        continue;
      }

      const wk = startOfWeekMonday(anchor);
      const k = calendarDayToIsoKey(wk);
      const idx = weekKeys.indexOf(k);
      if (idx === -1) {
        agg.outOfRange.taskCount += 1;
        agg.outOfRange.storyPoints += points;
      } else {
        agg.cells[idx].taskCount += 1;
        agg.cells[idx].storyPoints += points;
      }
    }
  }

  const rows: ProjectWorkloadRowDto[] = [...map.entries()].map(
    ([userId, v]) => ({
      userId,
      displayName: v.displayName,
      weeks: v.cells,
      unscheduled: v.unscheduled,
      outOfRange: v.outOfRange,
    }),
  );

  rows.sort((a, b) => {
    if (a.userId === UNASSIGNED_ID) return 1;
    if (b.userId === UNASSIGNED_ID) return -1;
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: 'base',
    });
  });

  const lastWeekStart = weekStarts[weekCount - 1];
  const toEnd = new Date(lastWeekStart);
  toEnd.setDate(toEnd.getDate() + 6);

  return {
    projectId,
    from: calendarDayToIsoKey(weekStarts[0]),
    to: calendarDayToIsoKey(toEnd),
    weekStarts: weekKeys,
    rows,
  };
}
