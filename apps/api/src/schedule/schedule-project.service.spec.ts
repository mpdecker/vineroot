import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { TaskService } from '../task/task.service';
import { ScheduleProjectService } from './schedule-project.service';

describe('ScheduleProjectService', () => {
  let service: ScheduleProjectService;

  const prisma = {
    project: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    taskDependency: { findMany: jest.fn() },
    scheduleProgramProject: { findMany: jest.fn() },
    workCalendar: { findFirst: jest.fn(), findMany: jest.fn() },
    taskBaseline: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    taskAssignee: { findMany: jest.fn() },
    taskCostEntry: { groupBy: jest.fn() },
  };

  const eventsGateway = {};
  const taskService = {
    findById: jest.fn(),
    broadcastTaskUpdated: jest.fn(),
  };

  const userId = 'u1';
  const projectId = 'p1';

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.project.findFirst.mockImplementation((args: { where?: { id?: string } }) => {
      const id = args?.where?.id;
      return Promise.resolve(id ? { id } : null);
    });
    prisma.workCalendar.findFirst.mockResolvedValue(null);
    prisma.workCalendar.findMany.mockResolvedValue([]);
    prisma.scheduleProgramProject.findMany.mockResolvedValue([]);
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    prisma.taskCostEntry.groupBy.mockResolvedValue([]);
    prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      startDate: null,
      dueDate: null,
      workCalendar: null,
      workspaceLinks: [{ workspaceId: 'ws1' }],
    });
    prisma.project.findMany.mockResolvedValue([
      {
        id: projectId,
        workCalendar: null,
        workspaceLinks: [{ workspaceId: 'ws1' }],
      },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScheduleProjectService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: TaskService, useValue: taskService },
      ],
    }).compile();
    service = moduleRef.get(ScheduleProjectService);
  });

  function mockProjectFindUniqueForCriticalPath(opts: {
    project?: { id: string; startDate: Date | null; dueDate: Date | null };
    tasks: Array<{
      id: string;
      projectId?: string;
      startDate: Date | null;
      dueDate: Date | null;
      isManuallyScheduled: boolean;
      isMilestone: boolean;
      constraintType: string;
      constraintDate: Date | null;
      durationWorkingMinutes: number | null;
      sortOrder: number;
      dependencies: unknown[];
    }>;
    deps: Array<{
      dependentId: string;
      blockingId: string;
      linkType: string;
      lagDays: number;
    }>;
    programLinks?: Array<{ programId: string; projectId: string }>;
  }) {
    prisma.project.findUnique.mockImplementation((args: { include?: unknown }) => {
      if (args.include && typeof args.include === 'object') {
        return Promise.resolve({
          ...(opts.project ?? { id: projectId, startDate: null, dueDate: null }),
          workspaceLinks: [{ workspaceId: 'ws1' }],
        });
      }
      return Promise.resolve(
        opts.project ?? { id: projectId, startDate: null, dueDate: null },
      );
    });
    prisma.task.findMany.mockResolvedValue(
      opts.tasks.map((t) => {
        const x = t as Record<string, unknown>;
        return {
          ...t,
          projectId: t.projectId ?? projectId,
          parentTaskId: (x.parentTaskId as string | null | undefined) ?? null,
          deadlineDate: (x.deadlineDate as Date | null | undefined) ?? null,
          workMinutes: (x.workMinutes as number | null | undefined) ?? null,
          scheduleMode: (x.scheduleMode as string | undefined) ?? 'MANUAL',
          effortDriven: (x.effortDriven as boolean | undefined) ?? false,
          isSummaryRollup: (x.isSummaryRollup as boolean | undefined) ?? false,
          workCalendarId: (x.workCalendarId as string | null | undefined) ?? null,
          workCalendar: (x.workCalendar as object | null | undefined) ?? null,
          assignees: (x.assignees as unknown[]) ?? [],
        };
      }),
    );
    prisma.taskDependency.findMany.mockResolvedValue(
      opts.deps.map((d) => ({
        ...d,
        lagIsElapsed: (d as { lagIsElapsed?: boolean }).lagIsElapsed ?? false,
      })),
    );

    if (opts.programLinks) {
      prisma.scheduleProgramProject.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        const w = args?.where as
          | { projectId?: string; programId?: { in: string[] } }
          | undefined;
        if (w?.projectId) {
          return Promise.resolve(
            opts.programLinks!.filter((l) => l.projectId === w.projectId),
          );
        }
        if (w?.programId?.in) {
          const ids = w.programId.in;
          return Promise.resolve(
            opts.programLinks!.filter((l) => ids.includes(l.programId)),
          );
        }
        return Promise.resolve([]);
      });
    }
  }

  it('getCriticalPath rejects unknown project for user', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    await expect(service.getCriticalPath(projectId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getCriticalPath returns tasks and critical ids for two-task FS chain', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    mockProjectFindUniqueForCriticalPath({
      project: { id: projectId, startDate: d0, dueDate: null },
      tasks: [
        {
          id: 'a',
          startDate: d0,
          dueDate: d0,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
        {
          id: 'b',
          startDate: null,
          dueDate: null,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 1,
          dependencies: [],
        },
      ],
      deps: [{ dependentId: 'b', blockingId: 'a', linkType: 'FS', lagDays: 0 }],
    });

    const cp = await service.getCriticalPath(projectId, userId);

    expect(cp.projectId).toBe(projectId);
    expect(cp.criticalTaskIds).toContain('a');
    expect(cp.criticalTaskIds).toContain('b');
    expect(cp.tasks).toHaveLength(2);
    expect(cp.tasks.every((t) => t.taskId && t.startDate && t.dueDate)).toBe(true);
    expect(cp.drivingEdges?.some((e) => e.fromTaskId === 'a' && e.toTaskId === 'b')).toBe(
      true,
    );
  });

  it('recalculate throws BadRequest when dependencies cycle', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    mockProjectFindUniqueForCriticalPath({
      tasks: [
        {
          id: 'a',
          startDate: d0,
          dueDate: d0,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
        {
          id: 'b',
          startDate: d0,
          dueDate: d0,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 1,
          dependencies: [],
        },
      ],
      deps: [
        { dependentId: 'b', blockingId: 'a', linkType: 'FS', lagDays: 0 },
        { dependentId: 'a', blockingId: 'b', linkType: 'FS', lagDays: 0 },
      ],
    });

    await expect(service.recalculate(projectId, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('saveBaseline rejects baselineIndex outside 0–10', async () => {
    await expect(service.saveBaseline(projectId, userId, 11)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('saveBaseline upserts a row per task', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        startDate: new Date(),
        dueDate: new Date(),
        workMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        assignees: [],
      },
    ]);
    prisma.taskBaseline.upsert.mockResolvedValue({});

    const res = await service.saveBaseline(projectId, userId, 0);
    expect(res.saved).toBe(1);
    expect(prisma.taskBaseline.upsert).toHaveBeenCalledTimes(1);
  });

  it('clearBaseline deletes rows for project and index', async () => {
    prisma.taskBaseline.deleteMany.mockResolvedValue({ count: 2 });

    const res = await service.clearBaseline(projectId, userId, 1);
    expect(res.deleted).toBe(2);
    expect(prisma.taskBaseline.deleteMany).toHaveBeenCalledWith({
      where: { baselineIndex: 1, task: { projectId, deletedAt: null } },
    });
  });

  it('compareBaselines returns variance fields', async () => {
    const bs = new Date('2026-01-01T12:00:00.000Z');
    const bf = new Date('2026-01-05T12:00:00.000Z');
    const cs = new Date('2026-01-03T12:00:00.000Z');
    const cf = new Date('2026-01-08T12:00:00.000Z');
    const savedAt = new Date('2026-02-01T00:00:00.000Z');
    prisma.taskBaseline.findMany.mockResolvedValue([
      {
        taskId: 't1',
        baselineIndex: 0,
        baselineStart: bs,
        baselineFinish: bf,
        baselineWorkMinutes: 100,
        baselineCost: new Prisma.Decimal(50),
        createdAt: savedAt,
        task: {
          startDate: cs,
          dueDate: cf,
          workMinutes: 120,
          estimatedMin: null,
          fixedCost: null,
          assignees: [],
        },
      },
    ]);

    const rows = await service.compareBaselines(projectId, userId, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].startVarianceDays).toBe(2);
    expect(rows[0].finishVarianceDays).toBe(3);
    expect(rows[0].workVarianceMinutes).toBe(20);
    expect(rows[0].baselineCost).toBe(50);
    expect(rows[0].currentCost).toBe(0);
    expect(rows[0].costVariance).toBe(-50);
    expect(rows[0].savedAt).toBe(savedAt.toISOString());
    expect(rows[0].startVarianceWorkingDays).toBeNull();
    expect(rows[0].finishVarianceWorkingDays).toBeNull();
  });

  it('compareBaselines computes working-day variance when project calendar exists', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      workCalendar: {
        weeklyPattern: {
          mon: 480,
          tue: 480,
          wed: 480,
          thu: 480,
          fri: 480,
          sat: 0,
          sun: 0,
        },
        exceptions: [],
        timeZone: 'UTC',
      },
      workspaceLinks: [],
    });
    const fri = new Date(Date.UTC(2026, 0, 9, 12, 0, 0));
    const mon = new Date(Date.UTC(2026, 0, 12, 12, 0, 0));
    prisma.taskBaseline.findMany.mockResolvedValue([
      {
        taskId: 't1',
        baselineIndex: 0,
        baselineStart: fri,
        baselineFinish: fri,
        baselineWorkMinutes: null,
        baselineCost: null,
        createdAt: new Date(),
        task: {
          startDate: mon,
          dueDate: mon,
          workMinutes: null,
          estimatedMin: null,
          fixedCost: null,
          assignees: [],
        },
      },
    ]);

    const rows = await service.compareBaselines(projectId, userId, 0);
    expect(rows[0].finishVarianceWorkingDays).toBe(1);
    expect(rows[0].startVarianceWorkingDays).toBe(1);
  });

  it('compareBaselines passes taskId into query when set', async () => {
    prisma.taskBaseline.findMany.mockResolvedValue([]);

    await service.compareBaselines(projectId, userId, 1, 'task-99');

    expect(prisma.taskBaseline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          baselineIndex: 1,
          taskId: 'task-99',
          task: { projectId, deletedAt: null, isTemplate: false },
        }),
      }),
    );
  });

  it('getBaselineSummary aggregates rows', async () => {
    const bs = new Date('2026-01-01T12:00:00.000Z');
    const bf = new Date('2026-01-05T12:00:00.000Z');
    prisma.task.count.mockResolvedValue(5);
    prisma.taskBaseline.findMany.mockResolvedValue([
      {
        taskId: 't1',
        baselineIndex: 0,
        baselineStart: bs,
        baselineFinish: bf,
        baselineWorkMinutes: 100,
        baselineCost: new Prisma.Decimal(10),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        task: {
          startDate: bs,
          dueDate: new Date('2026-01-10T12:00:00.000Z'),
          workMinutes: 100,
          estimatedMin: null,
          fixedCost: null,
          assignees: [],
        },
      },
      {
        taskId: 't2',
        baselineIndex: 0,
        baselineStart: bs,
        baselineFinish: bf,
        baselineWorkMinutes: 60,
        baselineCost: new Prisma.Decimal(5),
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        task: {
          startDate: bs,
          dueDate: new Date('2026-01-03T12:00:00.000Z'),
          workMinutes: 60,
          estimatedMin: null,
          fixedCost: null,
          assignees: [],
        },
      },
    ]);
    prisma.taskBaseline.aggregate.mockResolvedValue({
      _max: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
    });

    const s = await service.getBaselineSummary(projectId, userId, 0);
    expect(s.projectTaskCount).toBe(5);
    expect(s.tasksWithBaselineCount).toBe(2);
    expect(s.finishLateCount).toBe(1);
    expect(s.finishEarlyCount).toBe(1);
    expect(s.finishOnTimeCount).toBe(0);
    expect(s.maxFinishSlipDays).toBe(5);
    expect(s.sumWorkVarianceMinutes).toBe(0);
    expect(s.sumCostVariance).toBe(-15);
    expect(s.latestBaselineSavedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(s.avgFinishVarianceWorkingDays).toBeNull();
    expect(s.sumFinishVarianceWorkingDays).toBeNull();
    expect(s.maxFinishSlipWorkingDays).toBeNull();
  });

  it('listBaselines maps rows to DTOs', async () => {
    const t = new Date('2026-01-01T12:00:00.000Z');
    const createdAt = new Date('2026-01-15T08:00:00.000Z');
    prisma.taskBaseline.findMany.mockResolvedValue([
      {
        taskId: 't1',
        baselineIndex: 0,
        baselineStart: t,
        baselineFinish: t,
        baselineWorkMinutes: 60,
        baselineCost: 12.5 as never,
        createdAt,
      },
    ]);

    const rows = await service.listBaselines(projectId, userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe('t1');
    expect(rows[0].baselineCost).toBe(12.5);
    expect(rows[0].savedAt).toBe(createdAt.toISOString());
  });

  it('getOverallocations sums unitsPercent per user per Monday week in project TZ (UTC fallback)', async () => {
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const userRow = { workCalendar: null as null };
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        projectId,
        startDate: mon,
        dueDate: mon,
        assignees: [
          { userId: 'alice', unitsPercent: 60, user: userRow },
          { userId: 'alice', unitsPercent: 50, user: userRow },
        ],
        genericResourceAssignments: [],
      },
    ]);

    const over = await service.getOverallocations(projectId, userId);
    expect(over.length).toBe(1);
    expect(over[0].resourceKind).toBe('user');
    expect(over[0].userId).toBe('alice');
    expect(over[0].capacityPercent).toBe(100);
    expect(over[0].allocatedPercent).toBe(110);
    expect(over[0].capacityMinutes).toBe(480);
    expect(over[0].allocatedMinutes).toBe(528);
    expect(over[0].taskIds).toContain('t1');
  });

  it('getOverallocations returns empty when user allocation is at or below capacity', async () => {
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const userRow = { workCalendar: null as null };
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        projectId,
        startDate: mon,
        dueDate: mon,
        assignees: [{ userId: 'bob', unitsPercent: 100, user: userRow }],
        genericResourceAssignments: [],
      },
    ]);

    const over = await service.getOverallocations(projectId, userId);
    expect(over).toEqual([]);
  });

  it('getOverallocations skips tasks missing start or due date', async () => {
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const userRow = { workCalendar: null as null };
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't-bad',
        projectId,
        startDate: null,
        dueDate: mon,
        assignees: [{ userId: 'carol', unitsPercent: 200, user: userRow }],
        genericResourceAssignments: [],
      },
      {
        id: 't-ok',
        projectId,
        startDate: mon,
        dueDate: mon,
        assignees: [{ userId: 'carol', unitsPercent: 40, user: userRow }],
        genericResourceAssignments: [],
      },
    ]);

    const over = await service.getOverallocations(projectId, userId);
    expect(over).toEqual([]);
  });

  it('getCriticalPath rejects when merged program includes inaccessible project', async () => {
    prisma.scheduleProgramProject.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
      const w = args.where as { projectId?: string; programId?: { in: string[] } } | undefined;
      if (w?.projectId === projectId) {
        return Promise.resolve([{ programId: 'prog1', projectId }]);
      }
      if (w?.programId?.in) {
        return Promise.resolve([
          { programId: 'prog1', projectId },
          { programId: 'prog1', projectId: 'p2' },
        ]);
      }
      return Promise.resolve([]);
    });
    prisma.project.findFirst.mockImplementation((args: { where?: { id?: string } }) => {
      const id = args?.where?.id;
      if (id === 'p2') return Promise.resolve(null);
      return Promise.resolve(id ? { id } : null);
    });

    await expect(service.getCriticalPath(projectId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('level shifts highest sortOrder task with slack when user-overallocated', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    let scheduleUpdateCount = 0;
    prisma.task.update.mockImplementation(async () => {
      scheduleUpdateCount += 1;
      return {};
    });
    prisma.project.findUnique.mockImplementation((args: { include?: unknown }) => {
      if (args.include) {
        return Promise.resolve({
          id: projectId,
          workCalendar: null,
          workspaceLinks: [{ workspaceId: 'ws1' }],
        });
      }
      return Promise.resolve({ id: projectId, startDate: d0, dueDate: null });
    });

    prisma.task.findMany.mockImplementation((args: { where?: Record<string, unknown>; select?: unknown }) => {
      const w = args.where as Record<string, unknown> | undefined;
      const isOverallocationsQuery =
        w &&
        Array.isArray((w as { OR?: unknown[] }).OR) &&
        (w as { projectId?: unknown }).projectId != null &&
        (w as { id?: unknown }).id == null;
      if (isOverallocationsQuery) {
        if (scheduleUpdateCount > 0) {
          return Promise.resolve([]);
        }
        return Promise.resolve([
          {
            id: 'short',
            projectId,
            startDate: d0,
            dueDate: d0,
            assignees: [
              {
                userId: 'alice',
                unitsPercent: 150,
                user: { workCalendar: null },
              },
            ],
            genericResourceAssignments: [],
          },
        ]);
      }
      if (w && (w as { id?: { in: string[] } }).id?.in && args.select) {
        return Promise.resolve([
          {
            id: 'short',
            isManuallyScheduled: false,
            startDate: d0,
            dueDate: d0,
            sortOrder: 10,
            levelingPriority: 500,
            levelingCanSplit: false,
          },
        ]);
      }
      if (w && (w as { projectId?: unknown }).projectId && typeof (w as { projectId: unknown }).projectId === 'object') {
        const longFinish = new Date(Date.UTC(2026, 0, 16, 12, 0, 0));
        return Promise.resolve([
          {
            id: 'long',
            projectId,
            startDate: d0,
            dueDate: longFinish,
            isManuallyScheduled: false,
            isMilestone: false,
            constraintType: 'ASAP',
            constraintDate: null,
            durationWorkingMinutes: 5 * 480,
            sortOrder: 0,
            dependencies: [],
          },
          {
            id: 'short',
            projectId,
            startDate: d0,
            dueDate: d0,
            isManuallyScheduled: false,
            isMilestone: false,
            constraintType: 'ASAP',
            constraintDate: null,
            durationWorkingMinutes: 480,
            sortOrder: 10,
            dependencies: [],
          },
        ]);
      }
      return Promise.resolve([]);
    });

    prisma.taskDependency.findMany.mockResolvedValue([]);
    prisma.task.findUnique.mockResolvedValue({
      id: 'short',
      projectId,
      startDate: d0,
      dueDate: d0,
    } as never);
    taskService.findById.mockResolvedValue({ id: 'short' } as never);

    const res = await service.level(projectId, userId);

    expect(res.shiftedTaskIds).toContain('short');
    expect(res.stoppedReason).toBe('resolved');
    expect(res.remainingOverallocations).toBe(0);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'short' },
        data: expect.objectContaining({
          startDate: expect.any(Date),
          dueDate: expect.any(Date),
          levelingDelayWorkingDays: { increment: 1 },
        }),
      }),
    );
  });

  it('level with clearLevelingDelays resets delay counters in scope', async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 4 });
    prisma.task.findMany.mockResolvedValue([]);

    const res = await service.level(projectId, userId, {
      clearLevelingDelays: true,
    });

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: { in: [projectId] },
        deletedAt: null,
      },
      data: { levelingDelayWorkingDays: 0 },
    });
    expect(res.clearedLevelingDelaysTaskCount).toBe(4);
    expect(res.shiftedTaskIds).toEqual([]);
    expect(res.stoppedReason).toBe('resolved');
  });

  it('getOverallocations includes generic resources using maxUnitsPercent', async () => {
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    prisma.task.findMany.mockResolvedValueOnce([
      {
        id: 't2',
        projectId,
        startDate: mon,
        dueDate: mon,
        assignees: [],
        genericResourceAssignments: [
          {
            genericResourceId: 'gr1',
            unitsPercent: 100,
            genericResource: { name: 'Excavator', maxUnitsPercent: 50 },
          },
        ],
      },
      {
        id: 't3',
        projectId,
        startDate: mon,
        dueDate: mon,
        assignees: [],
        genericResourceAssignments: [
          {
            genericResourceId: 'gr1',
            unitsPercent: 80,
            genericResource: { name: 'Excavator', maxUnitsPercent: 50 },
          },
        ],
      },
    ]);

    const over = await service.getOverallocations(projectId, userId);
    expect(over.length).toBe(1);
    expect(over[0].resourceKind).toBe('generic_resource');
    expect(over[0].genericResourceId).toBe('gr1');
    expect(over[0].capacityPercent).toBe(100);
    expect(over[0].capacityMinutes).toBe(240);
    expect(over[0].allocatedMinutes).toBe(432);
    expect(over[0].allocatedPercent).toBe(180);
  });

  it('getCriticalPath runs merged CPM for schedule program; response lists focal project tasks only', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    mockProjectFindUniqueForCriticalPath({
      project: { id: projectId, startDate: d0, dueDate: null },
      programLinks: [
        { programId: 'prog1', projectId: 'p1' },
        { programId: 'prog1', projectId: 'p2' },
      ],
      tasks: [
        {
          id: 'a',
          projectId: 'p1',
          startDate: d0,
          dueDate: d0,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
        {
          id: 'b',
          projectId: 'p2',
          startDate: null,
          dueDate: null,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
      ],
      deps: [{ dependentId: 'b', blockingId: 'a', linkType: 'FS', lagDays: 0 }],
    });

    const cp = await service.getCriticalPath(projectId, userId);

    expect(cp.tasks).toHaveLength(1);
    expect(cp.tasks[0].taskId).toBe('a');
    expect(cp.criticalTaskIds).toContain('a');
  });

  it('evm aggregates BAC and EV from fixedCost and percentComplete', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'A',
        baselines: [],
        fixedCost: 100 as never,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 40,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId);
    expect(sum.bac).toBe(100);
    expect(sum.ev).toBe(40);
    expect(sum.ac).toBe(40);
    expect(sum.projectId).toBe(projectId);
    expect(sum.baselineIndex).toBe(0);
    expect(sum.earnedValueBasis).toBe('PERCENT_COMPLETE');
    expect(sum.pvModel).toBe('BASELINE_DURATION_LINEAR');
    expect(sum.tasks).toHaveLength(1);
    expect(sum.tasks?.[0].taskId).toBe('t1');
  });

  it('evm omits per-task rows when includeTasks is false', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'A',
        baselines: [],
        fixedCost: 50 as never,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 20,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId, false);
    expect(sum.bac).toBe(50);
    expect(sum.ev).toBe(10);
    expect(sum.tasks).toBeUndefined();
  });

  it('evm prefers baseline 0 cost over fixedCost when baseline has positive cost', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'A',
        baselines: [{ baselineIndex: 0, baselineCost: new Prisma.Decimal(200) }],
        fixedCost: 50 as never,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 50,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId);
    expect(sum.bac).toBe(200);
    expect(sum.ev).toBe(100);
  });

  it('evm uses baselineIndex for BAC and baseline dates', async () => {
    const bs = new Date('2020-01-01T00:00:00.000Z');
    const bf = new Date('2020-01-11T00:00:00.000Z');
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'A',
        baselines: [
          {
            baselineIndex: 2,
            baselineCost: new Prisma.Decimal(100),
            baselineStart: bs,
            baselineFinish: bf,
            baselineWorkMinutes: 480,
          },
        ],
        fixedCost: 10 as never,
        actualCost: null,
        workMinutes: 480,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 50,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId, true, { baselineIndex: 2 });
    expect(sum.baselineIndex).toBe(2);
    expect(sum.bac).toBe(100);
    expect(sum.ev).toBe(50);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          baselines: { where: { baselineIndex: 2 } },
        }),
      }),
    );
  });

  it('evm WORK_VS_BASELINE uses actualMin over percent when baseline work set', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'A',
        baselines: [
          {
            baselineIndex: 0,
            baselineCost: new Prisma.Decimal(100),
            baselineWorkMinutes: 100,
            baselineStart: null,
            baselineFinish: null,
          },
        ],
        fixedCost: null as never,
        actualCost: null,
        workMinutes: 100,
        estimatedMin: null,
        actualMin: 25,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 99,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId, true, {
      earnedValueBasis: 'WORK_VS_BASELINE',
    });
    expect(sum.ev).toBeCloseTo(25, 5);
  });

  it('evm uses cost entry sum for AC when actualCost unset', async () => {
    prisma.taskCostEntry.groupBy.mockResolvedValue([
      { taskId: 't1', _sum: { amount: new Prisma.Decimal(77) } },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'A',
        baselines: [],
        fixedCost: 100 as never,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 40,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId);
    expect(sum.ac).toBe(77);
    expect(sum.tasks?.[0].ac).toBe(77);
  });

  it('evm WORK_SCHEDULE_LINEAR uses working minutes for labor-weighted PV', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-07T12:00:00.000Z'));
    prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      startDate: null,
      dueDate: null,
      workCalendar: {
        weeklyPattern: {
          mon: 480,
          tue: 480,
          wed: 480,
          thu: 480,
          fri: 480,
          sat: 0,
          sun: 0,
        },
        exceptions: [],
        timeZone: 'UTC',
      },
      workspaceLinks: [{ workspaceId: 'ws1' }],
    });
    const bs = new Date('2026-01-05T12:00:00.000Z');
    const bf = new Date('2026-01-09T12:00:00.000Z');
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Labor',
        baselines: [
          {
            baselineIndex: 0,
            baselineStart: bs,
            baselineFinish: bf,
            baselineCost: new Prisma.Decimal(100),
            baselineWorkMinutes: 2400,
          },
        ],
        fixedCost: null,
        actualCost: null,
        workMinutes: 100,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [
          {
            unitsPercent: 100,
            workMinutes: null,
            costPerUse: null,
            user: {
              resourceStandardRatePerHour: new Prisma.Decimal(60),
              resourceOvertimeRatePerHour: null,
            },
          },
        ],
        genericResourceAssignments: [],
        percentComplete: 0,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sumLinear = await service.evm(projectId, userId, true, {
      pvModel: 'BASELINE_DURATION_LINEAR',
    });
    const sumWork = await service.evm(projectId, userId, true, {
      pvModel: 'WORK_SCHEDULE_LINEAR',
    });
    jest.useRealTimers();

    expect(sumLinear.pv).toBeCloseTo(50, 0);
    expect(sumWork.pv).toBeCloseTo(60, 0);
  });

  it('evm BAC includes assignee overtime labor premium', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Labor',
        baselines: [],
        fixedCost: null,
        actualCost: null,
        workMinutes: 120,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: 60,
        isBudgetTask: false,
        assignees: [
          {
            unitsPercent: 100,
            workMinutes: null,
            costPerUse: null,
            user: {
              resourceStandardRatePerHour: new Prisma.Decimal(100),
              resourceOvertimeRatePerHour: new Prisma.Decimal(150),
            },
          },
        ],
        genericResourceAssignments: [],
        percentComplete: 0,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId);
    expect(sum.bac).toBe(250);
  });

  it('evm separates budget tasks into budget rollup', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Work',
        baselines: [],
        fixedCost: 100 as never,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 50,
        startDate: null,
        dueDate: null,
      },
      {
        id: 't2',
        title: 'Budget line',
        baselines: [],
        fixedCost: 200 as never,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: true,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 0,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId);
    expect(sum.bac).toBe(100);
    expect(sum.budget?.bac).toBe(200);
    expect(sum.tasks).toHaveLength(2);
  });

  it('evm skips tasks with no computable budget', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't-skip',
        title: 'No budget',
        baselines: [],
        fixedCost: null,
        actualCost: null,
        workMinutes: null,
        estimatedMin: null,
        actualMin: null,
        overtimeWorkMinutes: null,
        isBudgetTask: false,
        assignees: [],
        genericResourceAssignments: [],
        percentComplete: 100,
        startDate: null,
        dueDate: null,
      },
    ]);

    const sum = await service.evm(projectId, userId);
    expect(sum.bac).toBe(0);
    expect(sum.tasks).toEqual([]);
  });

  it('clearBaseline rejects baselineIndex outside 0–10', async () => {
    await expect(service.clearBaseline(projectId, userId, -1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.clearBaseline(projectId, userId, 12)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('compareBaselines rejects invalid baselineIndex', async () => {
    await expect(service.compareBaselines(projectId, userId, 11)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getBaselineSummary rejects invalid baselineIndex', async () => {
    await expect(service.getBaselineSummary(projectId, userId, -2)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recalculate persists engine dates for auto-scheduled tasks and broadcasts', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    mockProjectFindUniqueForCriticalPath({
      project: { id: projectId, startDate: d0, dueDate: null },
      tasks: [
        {
          id: 'auto1',
          startDate: null,
          dueDate: null,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
      ],
      deps: [],
    });

    prisma.task.findUnique.mockResolvedValue({ isManuallyScheduled: false });
    prisma.task.update.mockResolvedValue({} as never);
    taskService.findById.mockResolvedValue({ id: 'auto1', title: 'X' } as never);

    const cp = await service.recalculate(projectId, userId);

    expect(cp.projectId).toBe(projectId);
    expect(cp.tasks).toHaveLength(1);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'auto1' },
        data: expect.objectContaining({
          startDate: expect.any(Date),
          dueDate: expect.any(Date),
        }),
      }),
    );
    expect(taskService.broadcastTaskUpdated).toHaveBeenCalled();
  });

  it('recalculate does not update manually scheduled tasks after engine run', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    mockProjectFindUniqueForCriticalPath({
      project: { id: projectId, startDate: d0, dueDate: null },
      tasks: [
        {
          id: 'man1',
          startDate: d0,
          dueDate: d0,
          isManuallyScheduled: true,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
      ],
      deps: [],
    });

    prisma.task.findUnique.mockResolvedValue({ isManuallyScheduled: true });

    await service.recalculate(projectId, userId);

    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(taskService.broadcastTaskUpdated).not.toHaveBeenCalled();
  });

  it('getCriticalPath uses workspace default calendar when project has no workCalendar', async () => {
    const d0 = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    prisma.workCalendar.findFirst.mockResolvedValue({
      weeklyPattern: {
        mon: 480,
        tue: 480,
        wed: 480,
        thu: 480,
        fri: 480,
        sat: 0,
        sun: 0,
      },
      exceptions: [],
      timeZone: 'UTC',
    });
    mockProjectFindUniqueForCriticalPath({
      project: { id: projectId, startDate: d0, dueDate: null },
      tasks: [
        {
          id: 'only',
          startDate: null,
          dueDate: null,
          isManuallyScheduled: false,
          isMilestone: false,
          constraintType: 'ASAP',
          constraintDate: null,
          durationWorkingMinutes: 480,
          sortOrder: 0,
          dependencies: [],
        },
      ],
      deps: [],
    });

    await service.getCriticalPath(projectId, userId);

    expect(prisma.workCalendar.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: { in: ['ws1'] },
          isDefault: true,
        }),
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('getNetworkGraph returns nodes and predecessor→successor edges', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'First',
        dependencies: [],
      },
      {
        id: 't2',
        title: 'Second',
        dependencies: [{ blockingId: 't1', linkType: 'SS', lagDays: 1 }],
      },
    ]);

    const res = await service.getNetworkGraph(projectId, userId);

    expect(res.projectId).toBe(projectId);
    expect(res.nodes).toEqual([
      { id: 't1', title: 'First' },
      { id: 't2', title: 'Second' },
    ]);
    expect(res.edges).toEqual([
      {
        fromTaskId: 't1',
        toTaskId: 't2',
        linkType: 'SS',
        lagDays: 1,
        lagIsElapsed: false,
      },
    ]);
  });

  it('getNetworkGraph throws NotFound when project is not accessible', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(service.getNetworkGraph('missing', userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('getTimephased week buckets sum to task workMinutes for single-week span', async () => {
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const sun = new Date(Date.UTC(2026, 0, 11, 12, 0, 0));
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'One week',
        startDate: mon,
        dueDate: sun,
        workMinutes: 700,
        durationWorkingMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        assignees: [],
        genericResourceAssignments: [],
      },
    ]);

    const res = await service.getTimephased(projectId, userId, 'week');

    expect(res.projectId).toBe(projectId);
    expect(res.granularity).toBe('week');
    expect(res.basis).toBe('calendar');
    const sum = res.cells.reduce((s, c) => s + c.workMinutes, 0);
    expect(sum).toBe(700);
    expect(res.cells.every((c) => c.taskId === 't1')).toBe(true);
    expect(res.resourceCells.reduce((s, c) => s + c.workMinutes, 0)).toBe(700);
    expect(res.resourceCells.every((c) => c.resourceKey === 'unassigned')).toBe(true);
  });

  it('getTimephased day granularity splits work across days', async () => {
    const d0 = new Date(Date.UTC(2026, 2, 2, 12, 0, 0));
    const d2 = new Date(Date.UTC(2026, 2, 4, 12, 0, 0));
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Three days',
        startDate: d0,
        dueDate: d2,
        workMinutes: 300,
        durationWorkingMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        assignees: [],
        genericResourceAssignments: [],
      },
    ]);

    const res = await service.getTimephased(projectId, userId, 'day');

    expect(res.granularity).toBe('day');
    expect(res.basis).toBe('calendar');
    expect(res.cells).toHaveLength(3);
    expect(res.cells.reduce((s, c) => s + c.workMinutes, 0)).toBe(300);
    expect(res.resourceCells.reduce((s, c) => s + c.workMinutes, 0)).toBe(300);
  });

  it('getTimephased returns no cells when task has dates but no work or cost', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'No budget',
        startDate: new Date(Date.UTC(2026, 0, 1)),
        dueDate: new Date(Date.UTC(2026, 0, 2)),
        workMinutes: null,
        durationWorkingMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        assignees: [],
        genericResourceAssignments: [],
      },
    ]);

    const res = await service.getTimephased(projectId, userId, 'week');

    expect(res.basis).toBe('calendar');
    expect(res.cells).toHaveLength(0);
    expect(res.resourceCells).toHaveLength(0);
  });

  it('getTimephased skips tasks missing start or due date', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Undated',
        startDate: null,
        dueDate: new Date(Date.UTC(2026, 0, 2)),
        workMinutes: 100,
        durationWorkingMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        assignees: [],
        genericResourceAssignments: [],
      },
    ]);

    const res = await service.getTimephased(projectId, userId, 'week');

    expect(res.basis).toBe('calendar');
    expect(res.cells).toHaveLength(0);
    expect(res.resourceCells).toHaveLength(0);
  });

  it('getTimephased basis working uses project calendar when present', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      workspaceLinks: [{ workspaceId: 'ws1' }],
      workCalendar: {
        weeklyPattern: {
          mon: 480,
          tue: 480,
          wed: 480,
          thu: 480,
          fri: 480,
          sat: 0,
          sun: 0,
        },
        exceptions: [],
        timeZone: 'UTC',
      },
    });
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const sun = new Date(Date.UTC(2026, 0, 11, 12, 0, 0));
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Week',
        startDate: mon,
        dueDate: sun,
        workMinutes: 1000,
        durationWorkingMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        scheduleSegments: null,
        workContour: 'FLAT',
        assignees: [],
        genericResourceAssignments: [],
      },
    ]);

    const res = await service.getTimephased(projectId, userId, 'day', 'working');

    expect(res.basis).toBe('working');
    expect(res.cells.reduce((s, c) => s + c.workMinutes, 0)).toBe(1000);
    expect(res.resourceCells.reduce((s, c) => s + c.workMinutes, 0)).toBe(1000);
    expect(res.cells.some((c) => c.periodStart.startsWith('2026-01-10'))).toBe(false);
  });

  it('getTimephased throws NotFound when project is not accessible', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(service.getTimephased('bad', userId, 'week')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('saveBaseline accepts baselineIndex 10', async () => {
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        startDate: new Date(),
        dueDate: new Date(),
        workMinutes: null,
        estimatedMin: null,
        fixedCost: null,
        assignees: [],
      },
    ]);
    prisma.taskBaseline.upsert.mockResolvedValue({});

    const out = await service.saveBaseline(projectId, userId, 10);

    expect(out.saved).toBe(1);
    expect(prisma.taskBaseline.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId_baselineIndex: { taskId: 't1', baselineIndex: 10 } },
      }),
    );
  });
});
