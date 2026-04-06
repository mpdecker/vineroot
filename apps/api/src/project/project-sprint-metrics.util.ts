import { TaskStatus } from '@prisma/client';
import type { Task } from '@prisma/client';

export function startOfCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function eachCalendarDayInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let x = startOfCalendarDay(start);
  const last = startOfCalendarDay(end);
  while (x.getTime() <= last.getTime()) {
    out.push(new Date(x));
    x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1);
  }
  return out;
}

/** Match sprint burndown day labels (same as legacy project.service). */
export function calendarDayToIsoKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** Store/query PostgreSQL @db.Date without local TZ shifting the calendar day. */
export function prismaDateFromIsoKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function storyPointsRemainingAtDayEnd(
  task: Pick<Task, 'status' | 'storyPoints' | 'completedAt' | 'updatedAt'>,
  dayEnd: Date,
): number {
  if (task.status === TaskStatus.CANCELLED) {
    return 0;
  }
  const p = task.storyPoints ?? 0;
  if (task.status === TaskStatus.DONE) {
    const at = task.completedAt ?? task.updatedAt;
    if (at.getTime() <= dayEnd.getTime()) {
      return 0;
    }
    return p;
  }
  return p;
}

export function completedCumulativeThroughDayEnd(
  tasks: Pick<Task, 'status' | 'storyPoints' | 'completedAt' | 'updatedAt'>[],
  sprintStartMs: number,
  upperBoundMs: number,
): number {
  let completedCumulative = 0;
  for (const t of tasks) {
    if (t.status !== TaskStatus.DONE) continue;
    const at = (t.completedAt ?? t.updatedAt).getTime();
    if (at < sprintStartMs || at > upperBoundMs) continue;
    completedCumulative += t.storyPoints ?? 0;
  }
  return Math.round(completedCumulative * 100) / 100;
}
