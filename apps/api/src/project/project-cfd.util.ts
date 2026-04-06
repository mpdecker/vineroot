import { TaskStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  calendarDayToIsoKey,
  eachCalendarDayInclusive,
  prismaDateFromIsoKey,
  startOfCalendarDay,
} from './project-sprint-metrics.util';

/** Stacking order for CFD areas (workflow-ish, then terminal states). */
export const CFD_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.READY,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.IN_REVIEW,
  TaskStatus.ESCALATION_PENDING,
  TaskStatus.BLOCKED_AWAITING_HUMAN,
  TaskStatus.BLOCKED_HUMAN_REROUTE,
  TaskStatus.REROUTED_READY,
  TaskStatus.DONE,
  TaskStatus.CANCELLED,
];

function normalizeByStatus(raw: Record<string, number>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const s of CFD_STATUS_ORDER) {
    o[s] = raw[s] ?? 0;
  }
  return o;
}

async function liveCfdByStatus(
  prisma: PrismaClient,
  projectId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId, deletedAt: null, isTemplate: false },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const s of CFD_STATUS_ORDER) out[s] = 0;
  for (const r of rows) {
    out[r.status] = r._count._all;
  }
  return out;
}

export async function buildProjectCfdSeries(
  prisma: PrismaClient,
  projectId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{
  days: { date: string; byStatus: Record<string, number> }[];
  statusOrder: string[];
}> {
  const from = startOfCalendarDay(rangeStart);
  const to = startOfCalendarDay(rangeEnd);
  const dayStarts = eachCalendarDayInclusive(from, to);
  if (dayStarts.length === 0) {
    return { days: [], statusOrder: [...CFD_STATUS_ORDER] };
  }

  const fromKey = calendarDayToIsoKey(from);
  const toKey = calendarDayToIsoKey(to);

  const snaps = await prisma.projectCfdSnapshot.findMany({
    where: {
      projectId,
      day: {
        gte: prismaDateFromIsoKey(fromKey),
        lte: prismaDateFromIsoKey(toKey),
      },
    },
    orderBy: { day: 'asc' },
  });

  const snapByKey = new Map(
    snaps.map((s) => [
      calendarDayToIsoKey(new Date(s.day)),
      normalizeByStatus(s.byStatus as Record<string, number>),
    ]),
  );

  const priorSnap = await prisma.projectCfdSnapshot.findFirst({
    where: {
      projectId,
      day: { lt: prismaDateFromIsoKey(fromKey) },
    },
    orderBy: { day: 'desc' },
  });

  const live = normalizeByStatus(await liveCfdByStatus(prisma, projectId));
  let last = priorSnap
    ? normalizeByStatus(priorSnap.byStatus as Record<string, number>)
    : { ...live };

  const days: { date: string; byStatus: Record<string, number> }[] = [];
  for (const day of dayStarts) {
    const key = calendarDayToIsoKey(day);
    const snapRow = snapByKey.get(key);
    if (snapRow) {
      last = { ...snapRow };
    }
    days.push({ date: key, byStatus: { ...last } });
  }

  return { days, statusOrder: [...CFD_STATUS_ORDER] };
}
