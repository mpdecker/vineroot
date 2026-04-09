import { TaskStatus } from '@prisma/client';
import { startOfCalendarDay } from './project-sprint-metrics.util';
import {
  addCalendarDaysToDateKey,
  weekStartMondayDateKeyInTimeZone,
} from '../schedule/schedule-calendar.util';
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
  assignees: {
    userId: string;
    user: { displayName: string };
    unitsPercent?: number | null;
  }[];
};

const UNASSIGNED_ID = '__unassigned__';

function emptyAgg(weekCount: number) {
  return {
    cells: Array.from({ length: weekCount }, () => ({
      taskCount: 0,
      storyPoints: 0,
      allocationPercent: 0,
    })),
    unscheduled: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
    outOfRange: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
  };
}

/**
 * @param weekMondayKeys YYYY-MM-DD Monday keys for each column (project / workspace calendar TZ).
 * @param timeZone IANA zone used to bucket task anchor dates into weeks (must match key generation).
 */
export function buildProjectWorkloadDto(
  projectId: string,
  weekMondayKeys: string[],
  tasks: WorkloadTaskRow[],
  timeZone: string,
): ProjectWorkloadDto {
  const weekCount = weekMondayKeys.length;
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

      const units = a.unitsPercent != null && Number.isFinite(a.unitsPercent) ? a.unitsPercent : 100;

      if (!anchor) {
        agg.unscheduled.taskCount += 1;
        agg.unscheduled.storyPoints += points;
        if (a.userId !== UNASSIGNED_ID) agg.unscheduled.allocationPercent += units;
        continue;
      }

      const k = weekStartMondayDateKeyInTimeZone(anchor, timeZone);
      const idx = weekMondayKeys.indexOf(k);
      if (idx === -1) {
        agg.outOfRange.taskCount += 1;
        agg.outOfRange.storyPoints += points;
        if (a.userId !== UNASSIGNED_ID) agg.outOfRange.allocationPercent += units;
      } else {
        agg.cells[idx].taskCount += 1;
        agg.cells[idx].storyPoints += points;
        if (a.userId !== UNASSIGNED_ID) agg.cells[idx].allocationPercent += units;
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

  const lastMonday = weekMondayKeys[weekCount - 1];
  const toEndKey = addCalendarDaysToDateKey(lastMonday, 6);

  return {
    projectId,
    from: weekMondayKeys[0],
    to: toEndKey,
    weekStarts: weekMondayKeys,
    rows,
  };
}
