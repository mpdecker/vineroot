import { buildProjectCfdSeries } from './project-cfd.util';
import {
  calendarDayToIsoKey,
  prismaDateFromIsoKey,
  startOfCalendarDay,
} from './project-sprint-metrics.util';

function mockPrisma() {
  return {
    projectCfdSnapshot: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    task: {
      groupBy: jest.fn(),
    },
  };
}

describe('buildProjectCfdSeries', () => {
  it('returns empty days when range is empty after normalization', async () => {
    const prisma = mockPrisma();
    prisma.projectCfdSnapshot.findMany.mockResolvedValue([]);
    prisma.projectCfdSnapshot.findFirst.mockResolvedValue(null);
    prisma.task.groupBy.mockResolvedValue([]);
    const r = await buildProjectCfdSeries(
      prisma as any,
      'proj-1',
      new Date(2026, 5, 10),
      new Date(2026, 5, 9),
    );
    expect(r.days).toHaveLength(0);
    expect(r.statusOrder.length).toBeGreaterThan(0);
  });

  it('fills a single day from live groupBy when no snapshots exist', async () => {
    const prisma = mockPrisma();
    prisma.projectCfdSnapshot.findMany.mockResolvedValue([]);
    prisma.projectCfdSnapshot.findFirst.mockResolvedValue(null);
    prisma.task.groupBy.mockResolvedValue([
      { status: 'BACKLOG', _count: { _all: 2 } },
      { status: 'DONE', _count: { _all: 1 } },
    ]);
    const d = new Date(2026, 1, 15);
    const from = startOfCalendarDay(d);
    const to = startOfCalendarDay(d);
    const r = await buildProjectCfdSeries(prisma as any, 'proj-1', from, to);
    expect(r.days).toHaveLength(1);
    expect(r.days[0].date).toBe(calendarDayToIsoKey(from));
    expect(r.days[0].byStatus.BACKLOG).toBe(2);
    expect(r.days[0].byStatus.DONE).toBe(1);
    expect(prisma.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'proj-1',
          deletedAt: null,
          isTemplate: false,
        }),
      }),
    );
  });

  it('overrides counts from snapshot row for that calendar day', async () => {
    const prisma = mockPrisma();
    prisma.task.groupBy.mockResolvedValue([
      { status: 'DONE', _count: { _all: 99 } },
    ]);
    prisma.projectCfdSnapshot.findFirst.mockResolvedValue(null);
    const d = new Date(2026, 2, 1);
    const from = startOfCalendarDay(d);
    const key = calendarDayToIsoKey(from);
    prisma.projectCfdSnapshot.findMany.mockResolvedValue([
      {
        day: prismaDateFromIsoKey(key),
        byStatus: { BACKLOG: 0, DONE: 7, READY: 2 },
      },
    ]);
    const r = await buildProjectCfdSeries(prisma as any, 'proj-1', from, from);
    expect(r.days[0].byStatus.DONE).toBe(7);
    expect(r.days[0].byStatus.READY).toBe(2);
  });

  it('forward-fills from prior snapshot before range when present', async () => {
    const prisma = mockPrisma();
    prisma.task.groupBy.mockResolvedValue([{ status: 'DONE', _count: { _all: 1 } }]);
    prisma.projectCfdSnapshot.findMany.mockResolvedValue([]);
    prisma.projectCfdSnapshot.findFirst.mockResolvedValue({
      byStatus: { BACKLOG: 1, DONE: 10 },
    });
    const from = startOfCalendarDay(new Date(2026, 3, 5));
    const to = startOfCalendarDay(new Date(2026, 3, 6));
    const r = await buildProjectCfdSeries(prisma as any, 'proj-1', from, to);
    expect(r.days).toHaveLength(2);
    expect(r.days[0].byStatus.DONE).toBe(10);
    expect(r.days[1].byStatus.DONE).toBe(10);
  });
});
