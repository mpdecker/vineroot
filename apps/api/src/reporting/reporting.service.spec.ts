import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { PrismaService } from '../common/prisma.service';
import { TaskStatus } from '@prisma/client';

describe('ReportingService', () => {
  let service: ReportingService;
  const prisma = {
    task: {
      findMany: jest.fn(),
    },
    reportingSavedView: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
          AND: expect.arrayContaining([
            expect.objectContaining({
              deletedAt: null,
              OR: [
                { workspaceId: 'ws-1' },
                {
                  project: {
                    deletedAt: null,
                    workspaceLinks: { some: { workspaceId: 'ws-1' } },
                  },
                },
              ],
            }),
          ]),
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

    expect(summary.period.from).toBeDefined();
    expect(summary.appliedFilters).toBeDefined();
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

  it('listSavedViews returns ordered saved views', async () => {
    const now = new Date();
    prisma.reportingSavedView.findMany.mockResolvedValue([
      {
        id: 'v1',
        workspaceId: 'ws-1',
        createdById: 'u1',
        name: 'Main',
        sortOrder: 2,
        config: { from: '2026-01-01' },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const rows = await service.listSavedViews('ws-1');

    expect(prisma.reportingSavedView.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    expect(rows[0].id).toBe('v1');
    expect(rows[0].config).toEqual({ from: '2026-01-01' });
  });

  it('createSavedView trims name and applies defaults', async () => {
    const now = new Date();
    prisma.reportingSavedView.create.mockResolvedValue({
      id: 'v1',
      workspaceId: 'ws-1',
      createdById: 'u1',
      name: 'My View',
      sortOrder: 0,
      config: {},
      createdAt: now,
      updatedAt: now,
    });

    const row = await service.createSavedView('ws-1', 'u1', {
      name: '  My View  ',
      config: {},
    });

    expect(prisma.reportingSavedView.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws-1',
        createdById: 'u1',
        name: 'My View',
        sortOrder: 0,
        config: {},
      },
    });
    expect(row.name).toBe('My View');
  });

  it('updateSavedView throws when view is not in workspace', async () => {
    prisma.reportingSavedView.findFirst.mockResolvedValue(null);
    await expect(
      service.updateSavedView('ws-1', 'missing', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateSavedView applies partial patch and trims name', async () => {
    const now = new Date();
    prisma.reportingSavedView.findFirst.mockResolvedValue({
      id: 'v1',
      workspaceId: 'ws-1',
    });
    prisma.reportingSavedView.update.mockResolvedValue({
      id: 'v1',
      workspaceId: 'ws-1',
      createdById: 'u1',
      name: 'Renamed',
      sortOrder: 3,
      config: { statuses: ['DONE'] },
      createdAt: now,
      updatedAt: now,
    });

    const row = await service.updateSavedView('ws-1', 'v1', {
      name: '  Renamed ',
      sortOrder: 3,
      config: { statuses: ['DONE'] },
    });

    expect(prisma.reportingSavedView.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { name: 'Renamed', sortOrder: 3, config: { statuses: ['DONE'] } },
    });
    expect(row.sortOrder).toBe(3);
  });

  it('deleteSavedView throws when view is not found', async () => {
    prisma.reportingSavedView.findFirst.mockResolvedValue(null);
    await expect(service.deleteSavedView('ws-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deleteSavedView removes existing view', async () => {
    prisma.reportingSavedView.findFirst.mockResolvedValue({
      id: 'v1',
      workspaceId: 'ws-1',
    });
    prisma.reportingSavedView.delete.mockResolvedValue({ id: 'v1' });

    await service.deleteSavedView('ws-1', 'v1');

    expect(prisma.reportingSavedView.delete).toHaveBeenCalledWith({
      where: { id: 'v1' },
    });
  });
});
