import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../common/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  const prisma = {
    dashboard: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dashboardWidget: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    portfolio: {
      findFirst: jest.fn(),
    },
    sprint: {
      findMany: jest.fn(),
    },
    projectCfdSnapshot: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const now = new Date();

  const dashRow = {
    id: 'd1',
    workspaceId: 'ws1',
    name: 'Main',
    description: null,
    color: null,
    createdById: 'u1',
    createdAt: now,
    updatedAt: now,
    layoutMeta: null,
    widgets: [],
    _count: { widgets: 0 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('list maps widget counts', async () => {
    prisma.dashboard.findMany.mockResolvedValue([
      {
        id: 'a',
        workspaceId: 'ws1',
        name: 'Main',
        description: null,
        color: null,
        createdById: 'u1',
        createdAt: now,
        updatedAt: now,
        layoutMeta: null,
        _count: { widgets: 2 },
      },
    ]);

    const rows = await service.list('ws1');

    expect(rows[0].widgetCount).toBe(2);
    expect(rows[0].widgets).toBeUndefined();
  });

  it('create persists dashboard', async () => {
    prisma.dashboard.create.mockResolvedValue({
      ...dashRow,
      name: 'N',
      widgets: [],
    });

    const dto = await service.create('ws1', 'u1', { name: 'N' });

    expect(prisma.dashboard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          name: 'N',
        }),
      }),
    );
    expect(dto.name).toBe('N');
  });

  it('addWidget rejects invalid type', async () => {
    prisma.dashboard.findFirst.mockResolvedValue({ id: 'd1' });

    await expect(
      service.addWidget('ws1', 'd1', {
        type: 'INVALID' as any,
        title: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addWidget accepts PROJECT_CFD', async () => {
    prisma.dashboard.findFirst.mockResolvedValue({ id: 'd1' });
    prisma.dashboardWidget.create.mockResolvedValue({
      id: 'w-cfd',
      dashboardId: 'd1',
      type: 'PROJECT_CFD',
      title: 'CFD',
      sortOrder: 0,
      gridX: 0,
      gridY: 0,
      gridW: 6,
      gridH: 3,
      config: { projectId: 'proj-1' },
      createdAt: now,
      updatedAt: now,
    });

    const dto = await service.addWidget('ws1', 'd1', {
      type: 'PROJECT_CFD',
      title: 'CFD',
      gridW: 6,
      gridH: 3,
      config: { projectId: 'proj-1' },
    });

    expect(dto.type).toBe('PROJECT_CFD');
    expect(prisma.dashboardWidget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PROJECT_CFD' }),
      }),
    );
  });

  it('removeWidget throws when missing', async () => {
    prisma.dashboard.findFirst.mockResolvedValue({ id: 'd1' });
    prisma.dashboardWidget.findFirst.mockResolvedValue(null);

    await expect(service.removeWidget('ws1', 'd1', 'w1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('resolveWidget TASKS_BY_STATUS', () => {
    it('returns buckets from groupBy', async () => {
      prisma.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { _all: 3 } },
        { status: 'BACKLOG', _count: { _all: 1 } },
      ]);
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w1',
            dashboardId: 'd1',
            type: 'TASKS_BY_STATUS',
            title: 'T',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 4,
            gridH: 2,
            config: {},
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true);

      expect(prisma.task.groupBy).toHaveBeenCalled();
      expect(full?.widgets?.[0].resolved?.buckets).toEqual([
        { status: 'DONE', count: 3 },
        { status: 'BACKLOG', count: 1 },
      ]);
    });
  });

  describe('resolveWidget PROJECT_CFD', () => {
    it('returns CFD series when project is linked to workspace', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'Alpha',
        deletedAt: null,
      });
      prisma.task.groupBy.mockResolvedValue([
        { status: 'BACKLOG', _count: { _all: 2 } },
      ]);
      prisma.projectCfdSnapshot.findMany.mockResolvedValue([]);
      prisma.projectCfdSnapshot.findFirst.mockResolvedValue(null);
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-cfd',
            dashboardId: 'd1',
            type: 'PROJECT_CFD',
            title: 'Flow',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 6,
            gridH: 3,
            config: { projectId: 'proj-1' },
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true);
      const resolved = full?.widgets?.[0].resolved as Record<string, unknown> | undefined;

      expect(resolved?.error).toBeUndefined();
      expect(resolved?.projectId).toBe('proj-1');
      expect(Array.isArray(resolved?.days)).toBe(true);
      expect((resolved?.days as unknown[]).length).toBeGreaterThanOrEqual(89);
      expect(Array.isArray(resolved?.statusOrder)).toBe(true);
    });

    it('returns error when projectId is missing in config', async () => {
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-cfd',
            dashboardId: 'd1',
            type: 'PROJECT_CFD',
            title: 'Flow',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 6,
            gridH: 3,
            config: {},
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true);
      expect(full?.widgets?.[0].resolved?.error).toMatch(/projectId/i);
    });
  });

  describe('resolveWidget PORTFOLIO_ACTIVE_SPRINTS', () => {
    it('returns sprint rows for portfolio projects', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({
        id: 'pf1',
        name: 'Programs',
        workspaceId: 'ws1',
        items: [{ projectId: 'p1', sortOrder: 0 }],
      });
      prisma.project.findMany.mockResolvedValue([{ id: 'p1', name: 'Alpha' }]);
      prisma.sprint.findMany.mockResolvedValue([
        {
          id: 's1',
          projectId: 'p1',
          name: 'Sprint 1',
          state: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-14'),
        },
      ]);
      prisma.task.findMany.mockResolvedValue([
        { status: 'DONE', storyPoints: 2 },
        { status: 'IN_PROGRESS', storyPoints: 3 },
      ]);
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-pf',
            dashboardId: 'd1',
            type: 'PORTFOLIO_ACTIVE_SPRINTS',
            title: 'Sprints',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 6,
            gridH: 3,
            config: { portfolioId: 'pf1' },
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true);
      const resolved = full?.widgets?.[0].resolved as Record<string, unknown> | undefined;

      expect(resolved?.error).toBeUndefined();
      expect(resolved?.portfolioId).toBe('pf1');
      const rows = resolved?.rows as { projectId: string; doneTasks: number }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].projectId).toBe('p1');
      expect(rows[0].doneTasks).toBe(1);
    });
  });
});
