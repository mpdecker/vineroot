import { Test } from '@nestjs/testing';
import { ReportingService } from './reporting.service';
import { PrismaService } from '../common/prisma.service';
import { TaskStatus } from '@prisma/client';

describe('ReportingService', () => {
  let service: ReportingService;
  const prisma = {
    task: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ReportingService);
  });

  it('workspaceSummary queries tasks in workspace or linked projects', async () => {
    prisma.task.findMany.mockResolvedValue([]);

    await service.workspaceSummary('ws-1');

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          OR: [
            { workspaceId: 'ws-1' },
            {
              project: {
                workspaceLinks: { some: { workspaceId: 'ws-1' } },
              },
            },
          ],
        }),
        include: {
          assignees: {
            include: {
              user: { select: { id: true, displayName: true } },
            },
          },
        },
      }),
    );
  });

  it('workspaceSummary aggregates status counts and open tasks', async () => {
    const now = new Date();
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'a',
        status: TaskStatus.IN_PROGRESS,
        completedAt: null,
        createdAt: now,
        assignees: [
          { userId: 'u1', user: { id: 'u1', displayName: 'Alice' } },
        ],
      },
      {
        id: 'b',
        status: TaskStatus.DONE,
        completedAt: now,
        createdAt: now,
        assignees: [],
      },
      {
        id: 'c',
        status: TaskStatus.CANCELLED,
        completedAt: null,
        createdAt: now,
        assignees: [],
      },
    ]);

    const summary = await service.workspaceSummary('ws-1');

    expect(summary.workspaceId).toBe('ws-1');
    expect(summary.tasksByStatus.IN_PROGRESS).toBe(1);
    expect(summary.tasksByStatus.DONE).toBe(1);
    expect(summary.tasksByStatus.CANCELLED).toBe(1);
    expect(summary.openTaskCount).toBe(1);
    expect(summary.workload).toEqual([
      { userId: 'u1', displayName: 'Alice', openTaskCount: 1 },
    ]);
  });

  it('workspaceSummary counts completed and created in last 30 days window', async () => {
    const old = new Date('2020-01-01');
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);

    prisma.task.findMany.mockResolvedValue([
      {
        id: 'done-old',
        status: TaskStatus.DONE,
        completedAt: old,
        createdAt: old,
        assignees: [],
      },
      {
        id: 'done-recent',
        status: TaskStatus.DONE,
        completedAt: recent,
        createdAt: recent,
        assignees: [],
      },
      {
        id: 'new-recent',
        status: TaskStatus.BACKLOG,
        completedAt: null,
        createdAt: recent,
        assignees: [],
      },
    ]);

    const summary = await service.workspaceSummary('ws-1');

    expect(summary.completedLast30Days).toBe(1);
    expect(summary.createdLast30Days).toBe(2);
  });

  it('workspaceSummary sorts workload by open count descending', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: '1',
        status: TaskStatus.BACKLOG,
        completedAt: null,
        createdAt: new Date(),
        assignees: [{ userId: 'u1', user: { displayName: 'A' } }],
      },
      {
        id: '2',
        status: TaskStatus.BACKLOG,
        completedAt: null,
        createdAt: new Date(),
        assignees: [{ userId: 'u1', user: { displayName: 'A' } }],
      },
      {
        id: '3',
        status: TaskStatus.BACKLOG,
        completedAt: null,
        createdAt: new Date(),
        assignees: [{ userId: 'u2', user: { displayName: 'B' } }],
      },
    ]);

    const summary = await service.workspaceSummary('ws-1');

    expect(summary.workload[0].userId).toBe('u1');
    expect(summary.workload[0].openTaskCount).toBe(2);
    expect(summary.workload[1].openTaskCount).toBe(1);
  });
});
