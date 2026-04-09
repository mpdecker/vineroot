import type { PrismaService } from '../common/prisma.service';
import {
  addCalendarDaysToDateKey,
  enumerateWeekStartMondayKeys,
  normalizeScheduleTimeZone,
  weekStartMondayDateKeyInTimeZone,
  zonedNoonFromDateKey,
} from '../schedule/schedule-calendar.util';

/** Project calendar TZ, else workspace default calendar TZ, else UTC (aligns with schedule CPM). */
export async function resolveProjectWorkloadTimeZone(
  prisma: PrismaService,
  projectId: string,
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workCalendar: true,
      workspaceLinks: { select: { workspaceId: true } },
    },
  });
  if (!project) return 'UTC';
  if (project.workCalendar?.timeZone) {
    return normalizeScheduleTimeZone(project.workCalendar.timeZone);
  }
  const wsIds = project.workspaceLinks.map((l) => l.workspaceId);
  if (wsIds.length === 0) return 'UTC';
  const fallback = await prisma.workCalendar.findFirst({
    where: { workspaceId: { in: wsIds }, isDefault: true },
    orderBy: { name: 'asc' },
  });
  if (fallback?.timeZone) {
    return normalizeScheduleTimeZone(fallback.timeZone);
  }
  return 'UTC';
}

/**
 * First Monday key in `tz` for the workload grid: optional `from` date (YYYY-MM-DD), else ~4 weeks before "today" in `tz`.
 */
export function resolveWorkloadGridFirstMondayKey(
  fromStr: string | undefined,
  timeZone: string,
  now = new Date(),
): string {
  const tz = normalizeScheduleTimeZone(timeZone);
  if (fromStr?.trim()) {
    const raw = fromStr.trim().slice(0, 10);
    const noon = zonedNoonFromDateKey(raw, tz);
    return weekStartMondayDateKeyInTimeZone(noon, tz);
  }
  const thisWeekMon = weekStartMondayDateKeyInTimeZone(now, tz);
  const anchorKey = addCalendarDaysToDateKey(thisWeekMon, -28);
  const anchorNoon = zonedNoonFromDateKey(anchorKey, tz);
  return weekStartMondayDateKeyInTimeZone(anchorNoon, tz);
}

export function buildWorkloadWeekMondayKeys(
  fromStr: string | undefined,
  timeZone: string,
  weekCount: number,
  now = new Date(),
): string[] {
  const first = resolveWorkloadGridFirstMondayKey(fromStr, timeZone, now);
  return enumerateWeekStartMondayKeys(first, weekCount);
}
