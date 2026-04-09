import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../common/prisma.service';
import { ScheduleProjectService } from '../schedule/schedule-project.service';

describe('DashboardService', () => {
  let service: DashboardService;
  const prisma = {
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    dashboard: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dashboardWidget: {
      create: jest.fn(),
      findMany: jest.fn(),
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
        { provide: ScheduleProjectService, useValue: { evm: jest.fn() } },
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

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');

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

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
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

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
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

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
      const resolved = full?.widgets?.[0].resolved as Record<string, unknown> | undefined;

      expect(resolved?.error).toBeUndefined();
      expect(resolved?.portfolioId).toBe('pf1');
      const rows = resolved?.rows as { projectId: string; doneTasks: number }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].projectId).toBe('p1');
      expect(rows[0].doneTasks).toBe(1);
    });
  });

  describe('resolveWidget NUMBER_METRIC', () => {
    it('uses static value/label when no reporting metric config is present', async () => {
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-num',
            dashboardId: 'd1',
            type: 'NUMBER_METRIC',
            title: 'KPI',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 4,
            gridH: 2,
            config: { value: 42, label: 'Static' },
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
      expect(full?.widgets?.[0].resolved).toEqual({ value: 42, label: 'Static' });
    });

    it('resolves OPEN_TASKS metric through reporting summary logic', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 't1',
          status: 'BACKLOG',
          createdAt: new Date(),
          completedAt: null,
          assignees: [],
        },
        {
          id: 't2',
          status: 'DONE',
          createdAt: new Date(),
          completedAt: new Date(),
          assignees: [],
        },
      ]);
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-num',
            dashboardId: 'd1',
            type: 'NUMBER_METRIC',
            title: 'KPI',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 4,
            gridH: 2,
            config: { metric: 'OPEN_TASKS', label: 'Open now' },
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
      expect(full?.widgets?.[0].resolved).toMatchObject({
        value: 1,
        label: 'Open now',
        period: { from: expect.any(String), to: expect.any(String) },
      });
    });

    it('returns error payload for invalid metric config', async () => {
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-num',
            dashboardId: 'd1',
            type: 'NUMBER_METRIC',
            title: 'KPI',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 4,
            gridH: 2,
            config: { metric: 'NOT_REAL' },
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
      expect(full?.widgets?.[0].resolved?.error).toMatch(/Unknown metric/i);
    });

    it('resolves AVG_LEAD_TIME_DAYS from reporting flow metrics', async () => {
      const completedAt = new Date();
      const createdAt = new Date(completedAt);
      createdAt.setDate(createdAt.getDate() - 4);
      prisma.task.findMany.mockResolvedValue([
        {
          id: 't1',
          status: 'DONE',
          createdAt,
          startDate: null,
          completedAt,
          assignees: [],
        },
      ]);
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        widgets: [
          {
            id: 'w-num',
            dashboardId: 'd1',
            type: 'NUMBER_METRIC',
            title: 'KPI',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 4,
            gridH: 2,
            config: { metric: 'AVG_LEAD_TIME_DAYS', label: 'Lead' },
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      const full = await service.findByIdInWorkspace('ws1', 'd1', true, 'u1');
      expect(full?.widgets?.[0].resolved).toMatchObject({
        value: 4,
        label: 'Lead',
        period: { from: expect.any(String), to: expect.any(String) },
      });
    });
  });

  describe('duplicateDashboard', () => {
    it('clones dashboard and widgets', async () => {
      const w1 = {
        id: 'w1',
        dashboardId: 'd1',
        type: 'TEXT_NOTE',
        title: 'Note',
        sortOrder: 0,
        gridX: 0,
        gridY: 0,
        gridW: 4,
        gridH: 2,
        config: { body: 'hi' },
        createdAt: now,
        updatedAt: now,
      };
      prisma.dashboard.findFirst
        .mockResolvedValueOnce({
          ...dashRow,
          name: 'Original',
          description: null,
          color: null,
          layoutMeta: null,
          widgets: [w1],
        })
        .mockResolvedValueOnce({
          ...dashRow,
          id: 'd2',
          name: 'Original (copy)',
          widgets: [
            {
              ...w1,
              id: 'w2',
              dashboardId: 'd2',
            },
          ],
        });
      prisma.dashboard.create.mockResolvedValue({
        ...dashRow,
        id: 'd2',
        name: 'Original (copy)',
      });
      prisma.dashboardWidget.create.mockResolvedValue({});

      const dto = await service.duplicateDashboard('ws1', 'd1', 'u1', {});

      expect(prisma.dashboard.create).toHaveBeenCalled();
      expect(prisma.dashboardWidget.create).toHaveBeenCalled();
      expect(dto.name).toBe('Original (copy)');
      expect(dto.widgets).toHaveLength(1);
    });
  });

  describe('createFromTemplate', () => {
    it('creates a blank dashboard', async () => {
      prisma.dashboard.create.mockResolvedValue({
        ...dashRow,
        id: 'new1',
        name: 'Blank',
      });
      prisma.dashboard.findFirst.mockResolvedValue({
        ...dashRow,
        id: 'new1',
        name: 'Blank',
        widgets: [],
      });

      const dto = await service.createFromTemplate('ws1', 'u1', {
        templateId: 'blank',
      });

      expect(dto.name).toBe('Blank');
      expect(dto.widgets).toEqual([]);
    });
  });

  describe('applyLayoutPreset', () => {
    it('repositions widgets for overview preset', async () => {
      prisma.dashboard.findFirst
        .mockResolvedValueOnce({ id: 'd1', workspaceId: 'ws1' })
        .mockResolvedValueOnce({
          ...dashRow,
          widgets: [
            {
              id: 'b',
              dashboardId: 'd1',
              type: 'TEXT_NOTE',
              title: 'B',
              sortOrder: 0,
              gridX: 0,
              gridY: 0,
              gridW: 8,
              gridH: 3,
              config: {},
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'a',
              dashboardId: 'd1',
              type: 'TEXT_NOTE',
              title: 'A',
              sortOrder: 1,
              gridX: 8,
              gridY: 0,
              gridW: 4,
              gridH: 1,
              config: {},
              createdAt: now,
              updatedAt: now,
            },
          ],
        });
      prisma.dashboardWidget.findMany.mockResolvedValue([
        {
          id: 'a',
          sortOrder: 1,
          gridX: 0,
          gridY: 0,
          gridW: 12,
          gridH: 2,
        },
        {
          id: 'b',
          sortOrder: 0,
          gridX: 0,
          gridY: 2,
          gridW: 6,
          gridH: 2,
        },
      ]);
      prisma.dashboardWidget.update.mockResolvedValue({});

      const dto = await service.applyLayoutPreset('ws1', 'd1', {
        presetId: 'overview',
      });

      expect(prisma.dashboardWidget.update).toHaveBeenCalled();
      expect(dto.widgets).toHaveLength(2);
    });
  });
});
