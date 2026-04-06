import {
  refreshPmSnapshotsForProjectTask,
  upsertProjectCfdSnapshot,
  upsertSprintMetricSnapshot,
} from './project-pm-snapshots.util';

describe('project-pm-snapshots.util', () => {
  describe('upsertProjectCfdSnapshot', () => {
    it('writes groupBy counts into projectCfdSnapshot.upsert', async () => {
      const prisma = {
        task: {
          groupBy: jest.fn().mockResolvedValue([
            { status: 'BACKLOG', _count: { _all: 3 } },
            { status: 'IN_PROGRESS', _count: { _all: 1 } },
          ]),
        },
        projectCfdSnapshot: {
          upsert: jest.fn().mockResolvedValue({}),
        },
      };
      await upsertProjectCfdSnapshot(prisma as any, 'proj-1');
      expect(prisma.task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['status'],
          where: expect.objectContaining({ projectId: 'proj-1' }),
        }),
      );
      expect(prisma.projectCfdSnapshot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId_day: expect.objectContaining({ projectId: 'proj-1' }) },
          create: expect.objectContaining({
            projectId: 'proj-1',
            byStatus: expect.objectContaining({ BACKLOG: 3, IN_PROGRESS: 1 }),
          }),
          update: expect.objectContaining({
            byStatus: expect.objectContaining({ BACKLOG: 3, IN_PROGRESS: 1 }),
          }),
        }),
      );
    });
  });

  describe('upsertSprintMetricSnapshot', () => {
    it('no-ops when sprint is not in project', async () => {
      const prisma = {
        sprint: { findFirst: jest.fn().mockResolvedValue(null) },
        task: { findMany: jest.fn() },
        sprintMetricSnapshot: { upsert: jest.fn() },
      };
      await upsertSprintMetricSnapshot(prisma as any, 'proj-1', 'sp-x');
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.sprintMetricSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('upserts metrics from sprint tasks', async () => {
      const prisma = {
        sprint: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'sp-1',
            projectId: 'proj-1',
            startDate: new Date(2026, 3, 1),
            endDate: new Date(2026, 3, 14),
          }),
        },
        task: {
          findMany: jest.fn().mockResolvedValue([
            {
              status: 'IN_PROGRESS',
              storyPoints: 2,
              completedAt: null,
              updatedAt: new Date(),
            },
          ]),
        },
        sprintMetricSnapshot: {
          upsert: jest.fn().mockResolvedValue({}),
        },
      };
      await upsertSprintMetricSnapshot(prisma as any, 'proj-1', 'sp-1');
      expect(prisma.sprintMetricSnapshot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sprintId: 'sp-1',
            remainingPoints: 2,
            scopePoints: 2,
          }),
        }),
      );
    });
  });

  describe('refreshPmSnapshotsForProjectTask', () => {
    it('does nothing when projectId is missing', async () => {
      const prisma = {
        task: { groupBy: jest.fn() },
        projectCfdSnapshot: { upsert: jest.fn() },
        sprint: { findFirst: jest.fn() },
        sprintMetricSnapshot: { upsert: jest.fn() },
      };
      await refreshPmSnapshotsForProjectTask(prisma as any, {
        projectId: null,
        sprintIds: ['sp-1'],
      });
      expect(prisma.task.groupBy).not.toHaveBeenCalled();
    });

    it('refreshes CFD and each distinct sprint id', async () => {
      const prisma = {
        task: {
          groupBy: jest.fn().mockResolvedValue([]),
        },
        projectCfdSnapshot: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        sprint: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'sp-1',
            projectId: 'proj-1',
            startDate: new Date(2026, 3, 1),
            endDate: new Date(2026, 3, 10),
          }),
        },
        task_findManyForSprint: jest.fn(),
        sprintMetricSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
      };
      (prisma as any).task.findMany = jest.fn().mockResolvedValue([]);
      await refreshPmSnapshotsForProjectTask(prisma as any, {
        projectId: 'proj-1',
        sprintIds: ['sp-1', 'sp-1', null],
      });
      expect(prisma.projectCfdSnapshot.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.sprintMetricSnapshot.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
