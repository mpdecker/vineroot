import type { PrismaClient } from '@prisma/client';
import { TaskStatus } from '@prisma/client';
import {
  calendarDayToIsoKey,
  completedCumulativeThroughDayEnd,
  endOfCalendarDay,
  prismaDateFromIsoKey,
  startOfCalendarDay,
  storyPointsRemainingAtDayEnd,
} from './project-sprint-metrics.util';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function upsertProjectCfdSnapshot(
  prisma: PrismaClient,
  projectId: string,
): Promise<void> {
  const key = calendarDayToIsoKey(startOfCalendarDay(new Date()));
  const rows = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId, deletedAt: null, isTemplate: false },
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = r._count._all;
  }
  const day = prismaDateFromIsoKey(key);
  await prisma.projectCfdSnapshot.upsert({
    where: { projectId_day: { projectId, day } },
    create: { projectId, day, byStatus },
    update: { byStatus },
  });
}

export async function upsertSprintMetricSnapshot(
  prisma: PrismaClient,
  projectId: string,
  sprintId: string,
): Promise<void> {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId },
  });
  if (!sprint) return;

  const tasks = await prisma.task.findMany({
    where: { sprintId, projectId, deletedAt: null, isTemplate: false },
    select: {
      status: true,
      storyPoints: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  const today = startOfCalendarDay(new Date());
  const key = calendarDayToIsoKey(today);
  const day = prismaDateFromIsoKey(key);
  const dayEnd = endOfCalendarDay(today);
  const sprintStartMs = startOfCalendarDay(sprint.startDate).getTime();
  const sprintEndMs = endOfCalendarDay(sprint.endDate).getTime();
  const upperMs = Math.min(dayEnd.getTime(), sprintEndMs);

  const remaining = round2(
    tasks.reduce((sum, t) => sum + storyPointsRemainingAtDayEnd(t, dayEnd), 0),
  );
  const scope = round2(
    tasks
      .filter((t) => t.status !== TaskStatus.CANCELLED)
      .reduce((s, t) => s + (t.storyPoints ?? 0), 0),
  );
  const completedCumulative = completedCumulativeThroughDayEnd(
    tasks,
    sprintStartMs,
    upperMs,
  );

  await prisma.sprintMetricSnapshot.upsert({
    where: { sprintId_day: { sprintId, day } },
    create: {
      sprintId,
      day,
      remainingPoints: remaining,
      scopePoints: scope,
      completedCumulative,
    },
    update: {
      remainingPoints: remaining,
      scopePoints: scope,
      completedCumulative,
    },
  });
}

export async function refreshPmSnapshotsForProjectTask(
  prisma: PrismaClient,
  opts: {
    projectId: string | null | undefined;
    sprintIds: Array<string | null | undefined>;
  },
): Promise<void> {
  if (!opts.projectId) return;
  await upsertProjectCfdSnapshot(prisma, opts.projectId);
  const ids = [...new Set(opts.sprintIds.filter((x): x is string => Boolean(x)))];
  for (const sid of ids) {
    await upsertSprintMetricSnapshot(prisma, opts.projectId, sid);
  }
}
