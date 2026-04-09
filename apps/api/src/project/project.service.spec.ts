import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { PrismaService } from '../common/prisma.service';
import { TaskService } from '../task/task.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import { CustomFieldRollupService } from '../custom-field/custom-field-rollup.service';
import { ProjectColor, ProjectStatus, type ProjectSavedViewConfigDto } from '@vineroot/shared-types';
import { TaskStatus } from '@prisma/client';
import {
  calendarDayToIsoKey,
  eachCalendarDayInclusive,
  prismaDateFromIsoKey,
} from './project-sprint-metrics.util';

describe('ProjectService', () => {
  let service: ProjectService;

  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
    team: { findFirst: jest.fn() },
    projectCfdSnapshot: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sprintMetricSnapshot: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    task: {
      groupBy: jest.fn().mockImplementation((args: { where?: { status?: { in?: string[]; notIn?: string[] } } }) => {
        const st = args?.where?.status;
        if (st && 'in' in st && st.in) {
          return Promise.resolve([
            { projectId: 'proj-1', _count: { _all: 3 } },
          ]);
        }
        if (st && 'notIn' in st && st.notIn) {
          return Promise.resolve([
            { projectId: 'proj-1', _count: { _all: 5 } },
          ]);
        }
        return Promise.resolve([]);
      }),
      findMany: jest.fn(),
    },
    sprint: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workCalendar: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };

  const taskService = {
    toTaskDto: jest.fn((t: any) => ({ id: t.id, title: t.title })),
  };

  const taskActivityLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const customFieldRollupService = {
    mergeRollupsIntoProjectTree: jest.fn().mockResolvedValue(undefined),
  };

  const now = new Date();

  const baseCreatedProject = {
    id: 'proj-1',
    teamId: null,
    createdById: 'user-1',
    name: 'Alpha',
    description: null,
    color: ProjectColor.BLUE,
    emoji: null,
    status: ProjectStatus.ACTIVE,
    isPrivate: false,
    isArchived: false,
    startDate: null,
    dueDate: null,
    defaultView: 'list',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    sections: [],
    members: [{ id: 'm1', userId: 'user-1', role: 'OWNER', user: {}, joinedAt: now }],
    workspaceLinks: [{ workspaceId: 'ws-a' }, { workspaceId: 'ws-b' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'wm1' });
    prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        portfolioItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        projectWorkspace: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: prisma },
        { provide: TaskService, useValue: taskService },
        { provide: TaskActivityLogService, useValue: taskActivityLog },
        {
          provide: CustomFieldRollupService,
          useValue: customFieldRollupService,
        },
      ],
    }).compile();

    service = moduleRef.get(ProjectService);
  });

  describe('createFromRequest', () => {
    it('throws BadRequest when workspaceIds is missing or empty', async () => {
      await expect(
        service.createFromRequest('user-1', { name: 'X' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.createFromRequest('user-1', { name: 'X', workspaceIds: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create', () => {
    it('throws BadRequest when workspaceIds normalizes to empty', async () => {
      await expect(
        service.create([], 'user-1', { name: 'X' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws Forbidden when user is not a member of a workspace', async () => {
      prisma.workspaceMember.findUnique
        .mockResolvedValueOnce({ id: 'wm' })
        .mockResolvedValueOnce(null);

      await expect(
        service.create(['ws-a', 'ws-b'], 'user-1', { name: 'X' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates project with deduped workspace links and default kanban sections', async () => {
      prisma.project.create.mockResolvedValue(baseCreatedProject);

      const dto = await service.create(
        ['ws-a', 'ws-a', 'ws-b'],
        'user-1',
        { name: 'Alpha', description: 'd' },
      );

      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Alpha',
            description: 'd',
            createdById: 'user-1',
            workspaceLinks: {
              create: [{ workspaceId: 'ws-a' }, { workspaceId: 'ws-b' }],
            },
            sections: {
              create: [
                { name: 'To do', isDefault: true, sortOrder: 0 },
                { name: 'In progress', isDefault: false, sortOrder: 1 },
                { name: 'In review', isDefault: false, sortOrder: 2 },
                { name: 'Done', isDefault: false, sortOrder: 3 },
              ],
            },
            members: { create: { userId: 'user-1', role: 'OWNER' } },
          }),
        }),
      );
      expect(dto.workspaceIds).toEqual(['ws-a', 'ws-b']);
      expect(dto.name).toBe('Alpha');
    });

    it('throws BadRequest when team workspace is not among project workspaces', async () => {
      prisma.team.findFirst.mockResolvedValue({
        id: 'team-1',
        workspaceId: 'ws-other',
        deletedAt: null,
      });

      await expect(
        service.create(['ws-a'], 'user-1', {
          name: 'T',
          teamId: 'team-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows team when its workspace is included', async () => {
      prisma.team.findFirst.mockResolvedValue({
        id: 'team-1',
        workspaceId: 'ws-a',
        deletedAt: null,
      });
      prisma.project.create.mockResolvedValue({
        ...baseCreatedProject,
        teamId: 'team-1',
      });

      await service.create(['ws-a'], 'user-1', {
        name: 'With team',
        teamId: 'team-1',
      });

      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamId: 'team-1' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns null when project not visible to user', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      const dto = await service.findById('proj-1', 'user-1');

      expect(dto).toBeNull();
    });

    it('returns dto when accessible', async () => {
      prisma.project.findFirst.mockResolvedValue({
        ...baseCreatedProject,
        sections: [],
      });

      const dto = await service.findById('proj-1', 'user-1');

      expect(dto?.id).toBe('proj-1');
      expect(dto?.workspaceIds).toEqual(['ws-a', 'ws-b']);
    });

    it('loads deeply nested subtasks on section tasks for list/board', async () => {
      prisma.project.findFirst.mockResolvedValue({
        ...baseCreatedProject,
        sections: [],
      });

      await service.findById('proj-1', 'user-1');

      const arg = prisma.project.findFirst.mock.calls[0][0] as {
        include: { sections: { include: { tasks: { include: { subtasks: unknown } } } } };
      };
      const sub = arg.include.sections.include.tasks.include.subtasks as {
        include: {
          assignees?: unknown;
          tags?: unknown;
          createdBy?: unknown;
          subtasks?: { include?: unknown };
        };
      };
      expect(sub).toBeDefined();
      expect(sub.include.assignees).toBeDefined();
      expect(sub.include.subtasks).toBeDefined();
    });
  });

  describe('listForUser', () => {
    it('returns mapped projects for creator or member', async () => {
      prisma.project.findMany.mockResolvedValue([baseCreatedProject]);

      const rows = await service.listForUser('user-1');

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: expect.any(Array),
          }),
        }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].workspaceIds.length).toBeGreaterThan(0);
      expect(rows[0].taskCount).toBe(5);
      expect(rows[0].completedTaskCount).toBe(3);
    });
  });

  describe('listByWorkspace', () => {
    it('queries projects linked via ProjectWorkspace', async () => {
      prisma.project.findMany.mockResolvedValue([baseCreatedProject]);

      const rows = await service.listByWorkspace('ws-a');

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceLinks: { some: { workspaceId: 'ws-a' } },
            deletedAt: null,
          }),
        }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].workspaceIds).toEqual(['ws-a', 'ws-b']);
      expect(rows[0].taskCount).toBe(5);
      expect(rows[0].completedTaskCount).toBe(3);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.project.findUnique.mockResolvedValue({
        workspaceLinks: [{ workspaceId: 'ws-a' }, { workspaceId: 'ws-b' }],
      });
      prisma.project.update.mockResolvedValue({
        ...baseCreatedProject,
        workspaceLinks: [{ workspaceId: 'ws-b' }],
        sections: [],
      });
    });

    it('throws NotFound when user lacks access', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.update('proj-1', 'user-1', { name: 'N' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest when workspaceIds would be empty', async () => {
      await expect(
        service.update('proj-1', 'user-1', { workspaceIds: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('runs transaction to remove portfolio items for dropped workspaces and replace links', async () => {
      await service.update('proj-1', 'user-1', { workspaceIds: ['ws-b'] });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws BadRequest when team workspace not linked after patch', async () => {
      prisma.project.update.mockResolvedValue({
        ...baseCreatedProject,
        workspaceLinks: [{ workspaceId: 'ws-b' }],
        sections: [],
      });
      prisma.team.findFirst.mockResolvedValue({
        id: 't1',
        workspaceId: 'ws-a',
        deletedAt: null,
      });

      await expect(
        service.update('proj-1', 'user-1', {
          workspaceIds: ['ws-b'],
          teamId: 't1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('delete', () => {
    it('soft-deletes when access ok', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.project.update.mockResolvedValue({});

      await service.delete('proj-1', 'user-1');

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('listSprints', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
    });

    it('throws NotFound when project is not accessible', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.listSprints('proj-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns sprint DTOs ordered by API query', async () => {
      prisma.sprint.findMany.mockResolvedValue([
        {
          id: 's1',
          projectId: 'proj-1',
          name: 'A',
          goal: null,
          startDate: new Date('2024-01-02'),
          endDate: new Date('2024-01-09'),
          state: 'ACTIVE',
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const rows = await service.listSprints('proj-1', 'user-1');

      expect(prisma.sprint.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { startDate: 'desc' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('s1');
      expect(rows[0].name).toBe('A');
    });
  });

  describe('createSprint', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.sprint.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    });

    it('throws BadRequest when name is empty', async () => {
      await expect(
        service.createSprint('proj-1', 'user-1', {
          name: '   ',
          startDate: '2024-01-01',
          endDate: '2024-01-08',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when end is not after start', async () => {
      await expect(
        service.createSprint('proj-1', 'user-1', {
          name: 'S',
          startDate: '2024-01-08',
          endDate: '2024-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates sprint with next sortOrder', async () => {
      prisma.sprint.create.mockResolvedValue({
        id: 'new-sp',
        projectId: 'proj-1',
        name: 'Beta',
        goal: null,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-14'),
        state: 'PLANNED',
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      });

      const dto = await service.createSprint('proj-1', 'user-1', {
        name: 'Beta',
        startDate: '2024-02-01',
        endDate: '2024-02-14',
      });

      expect(prisma.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            name: 'Beta',
            sortOrder: 3,
            state: 'PLANNED',
          }),
        }),
      );
      expect(dto.id).toBe('new-sp');
      expect(dto.name).toBe('Beta');
    });
  });

  describe('getSprintBurndown', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.sprintMetricSnapshot.findMany.mockResolvedValue([]);
    });

    it('throws NotFound when project is not accessible', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getSprintBurndown('proj-1', 'sp-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.sprint.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFound when sprint does not exist on project', async () => {
      prisma.sprint.findFirst.mockResolvedValue(null);

      await expect(
        service.getSprintBurndown('proj-1', 'sp-missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('returns ideal and remaining series for a two-day sprint', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 11),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.IN_PROGRESS,
          storyPoints: 3,
          completedAt: null,
          updatedAt: now,
        },
      ]);

      const result = await service.getSprintBurndown('proj-1', 'sp-1', 'user-1');

      expect(result.sprintId).toBe('sp-1');
      expect(result.projectId).toBe('proj-1');
      expect(result.totalScope).toBe(3);
      expect(result.days).toHaveLength(2);
      expect(result.days[0].remaining).toBe(3);
      expect(result.days[1].remaining).toBe(3);
      expect(result.days[0].ideal).toBe(3);
      expect(result.days[1].ideal).toBe(0);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sprintId: 'sp-1',
            projectId: 'proj-1',
            isTemplate: false,
          }),
        }),
      );
    });

    it('excludes CANCELLED tasks from totalScope and remaining', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 10),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.CANCELLED,
          storyPoints: 8,
          completedAt: null,
          updatedAt: now,
        },
      ]);

      const result = await service.getSprintBurndown('proj-1', 'sp-1', 'user-1');

      expect(result.totalScope).toBe(0);
      expect(result.days).toHaveLength(1);
      expect(result.days[0].remaining).toBe(0);
    });

    it('counts DONE toward scope and zeroes remaining after completion within sprint day', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 10),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      const doneAt = new Date(2024, 5, 10, 12, 0, 0);
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.DONE,
          storyPoints: 5,
          completedAt: doneAt,
          updatedAt: doneAt,
        },
      ]);

      const result = await service.getSprintBurndown('proj-1', 'sp-1', 'user-1');

      expect(result.totalScope).toBe(5);
      expect(result.days[0].remaining).toBe(0);
    });

    it('uses sprint metric snapshot for a day when a row exists', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 11),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.IN_PROGRESS,
          storyPoints: 3,
          completedAt: null,
          updatedAt: now,
        },
      ]);
      const day0 = eachCalendarDayInclusive(
        new Date(2024, 5, 10),
        new Date(2024, 5, 10),
      )[0];
      const k0 = calendarDayToIsoKey(day0);
      prisma.sprintMetricSnapshot.findMany.mockResolvedValue([
        {
          sprintId: 'sp-1',
          day: prismaDateFromIsoKey(k0),
          remainingPoints: 0.25,
          scopePoints: 10,
          completedCumulative: 0,
        },
      ]);

      const result = await service.getSprintBurndown('proj-1', 'sp-1', 'user-1');

      expect(result.days[0].remaining).toBe(0.25);
      expect(result.days[0].ideal).toBe(10);
      expect(result.days[1].remaining).toBe(3);
    });

    it('from/to returns a slice of days with ideal from full-sprint index', async () => {
      const sprintStart = new Date(2024, 5, 10);
      const sprintEnd = new Date(2024, 5, 12);
      const midDay = eachCalendarDayInclusive(sprintStart, sprintEnd)[1];
      const midKey = calendarDayToIsoKey(midDay);

      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: sprintStart,
        endDate: sprintEnd,
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.IN_PROGRESS,
          storyPoints: 6,
          completedAt: null,
          updatedAt: now,
        },
      ]);

      const result = await service.getSprintBurndown(
        'proj-1',
        'sp-1',
        'user-1',
        midKey,
        midKey,
      );

      expect(result.days).toHaveLength(1);
      expect(result.days[0].date).toBe(midKey);
      expect(result.days[0].ideal).toBe(3);
      expect(result.totalScope).toBe(6);
    });

    it('throws BadRequest for invalid from', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 11),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        service.getSprintBurndown('proj-1', 'sp-1', 'user-1', 'bogus'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSprintBurnup', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.sprintMetricSnapshot.findMany.mockResolvedValue([]);
    });

    it('throws NotFound when sprint is missing', async () => {
      prisma.sprint.findFirst.mockResolvedValue(null);
      await expect(
        service.getSprintBurnup('proj-1', 'sp-x', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns cumulative completed through each day and flat scope', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 11),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      const d1 = new Date(2024, 5, 10, 14, 0, 0);
      const d2 = new Date(2024, 5, 11, 10, 0, 0);
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.IN_PROGRESS,
          storyPoints: 2,
          completedAt: null,
          updatedAt: now,
        },
        {
          status: TaskStatus.DONE,
          storyPoints: 3,
          completedAt: d1,
          updatedAt: d1,
        },
        {
          status: TaskStatus.DONE,
          storyPoints: 5,
          completedAt: d2,
          updatedAt: d2,
        },
      ]);

      const result = await service.getSprintBurnup('proj-1', 'sp-1', 'user-1');

      expect(result.totalScope).toBe(10);
      expect(result.days).toHaveLength(2);
      expect(result.days[0].completedCumulative).toBe(3);
      expect(result.days[0].scopeTotal).toBe(10);
      expect(result.days[1].completedCumulative).toBe(8);
      expect(result.days[1].scopeTotal).toBe(10);
      expect(result.initialScope).toBe(10);
      expect(result.scopeChanges).toEqual([]);
    });

    it('uses snapshot completedCumulative and scopeTotal when present', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 11),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      prisma.task.findMany.mockResolvedValue([
        {
          status: TaskStatus.DONE,
          storyPoints: 3,
          completedAt: new Date(2024, 5, 10, 14, 0, 0),
          updatedAt: now,
        },
      ]);
      const day0 = eachCalendarDayInclusive(
        new Date(2024, 5, 10),
        new Date(2024, 5, 10),
      )[0];
      const day1 = eachCalendarDayInclusive(
        new Date(2024, 5, 11),
        new Date(2024, 5, 11),
      )[0];
      const k0 = calendarDayToIsoKey(day0);
      const k1 = calendarDayToIsoKey(day1);
      prisma.sprintMetricSnapshot.findMany.mockResolvedValue([
        {
          sprintId: 'sp-1',
          day: prismaDateFromIsoKey(k0),
          remainingPoints: 0,
          scopePoints: 20,
          completedCumulative: 15,
        },
        {
          sprintId: 'sp-1',
          day: prismaDateFromIsoKey(k1),
          remainingPoints: 0,
          scopePoints: 20,
          completedCumulative: 3,
        },
      ]);

      const result = await service.getSprintBurnup('proj-1', 'sp-1', 'user-1');

      expect(result.days[0].completedCumulative).toBe(15);
      expect(result.days[0].scopeTotal).toBe(20);
      expect(result.days[1].completedCumulative).toBe(3);
      expect(result.initialScope).toBe(20);
      expect(result.scopeChanges).toEqual([]);
    });

    it('records scopeChanges when snapshot scope shifts mid-sprint', async () => {
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sp-1',
        projectId: 'proj-1',
        name: 'S',
        goal: null,
        startDate: new Date(2024, 5, 10),
        endDate: new Date(2024, 5, 11),
        state: 'ACTIVE',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      prisma.task.findMany.mockResolvedValue([]);
      const d0 = eachCalendarDayInclusive(
        new Date(2024, 5, 10),
        new Date(2024, 5, 10),
      )[0];
      const d1 = eachCalendarDayInclusive(
        new Date(2024, 5, 11),
        new Date(2024, 5, 11),
      )[0];
      const k0 = calendarDayToIsoKey(d0);
      const k1 = calendarDayToIsoKey(d1);
      prisma.sprintMetricSnapshot.findMany.mockResolvedValue([
        {
          sprintId: 'sp-1',
          day: prismaDateFromIsoKey(k0),
          remainingPoints: 5,
          scopePoints: 10,
          completedCumulative: 0,
        },
        {
          sprintId: 'sp-1',
          day: prismaDateFromIsoKey(k1),
          remainingPoints: 8,
          scopePoints: 13,
          completedCumulative: 2,
        },
      ]);

      const result = await service.getSprintBurnup('proj-1', 'sp-1', 'user-1');

      expect(result.days).toHaveLength(2);
      expect(result.initialScope).toBe(10);
      expect(result.scopeChanges).toEqual([
        { date: k1, delta: 3, scopeAfter: 13 },
      ]);
    });
  });

  describe('getProjectCfd', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.task.groupBy.mockResolvedValue([
        { status: 'BACKLOG', _count: { _all: 1 } },
      ]);
      prisma.projectCfdSnapshot.findMany.mockResolvedValue([]);
      prisma.projectCfdSnapshot.findFirst.mockResolvedValue(null);
    });

    it('throws NotFound when project is not accessible', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.getProjectCfd('proj-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequest when from is after to', async () => {
      await expect(
        service.getProjectCfd('proj-1', 'user-1', '2026-04-10', '2026-04-01'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns days and statusOrder for explicit range', async () => {
      const r = await service.getProjectCfd('proj-1', 'user-1', '2026-01-01', '2026-01-03');
      expect(r.projectId).toBe('proj-1');
      expect(r.days).toHaveLength(3);
      expect(r.statusOrder.length).toBeGreaterThan(3);
    });
  });

  describe('getEpicRollups', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
    });

    it('throws NotFound when project is not accessible', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.getEpicRollups('proj-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('aggregates nested descendants under each EPIC', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'e1',
          title: 'Epic A',
          workItemType: 'EPIC',
          parentTaskId: null,
          storyPoints: null,
          status: TaskStatus.BACKLOG,
        },
        {
          id: 't1',
          title: 'Story',
          workItemType: 'STORY',
          parentTaskId: 'e1',
          storyPoints: 3,
          status: TaskStatus.DONE,
        },
        {
          id: 't2',
          title: 'Sub',
          workItemType: 'TASK',
          parentTaskId: 't1',
          storyPoints: 2,
          status: TaskStatus.IN_PROGRESS,
        },
      ]);

      const r = await service.getEpicRollups('proj-1', 'user-1');

      expect(r.projectId).toBe('proj-1');
      expect(r.epics).toHaveLength(1);
      expect(r.epics[0].epicId).toBe('e1');
      expect(r.epics[0].taskCount).toBe(2);
      expect(r.epics[0].storyPointsTotal).toBe(5);
      expect(r.epics[0].storyPointsDone).toBe(3);
      expect(r.epics[0].doneCount).toBe(1);
    });
  });

  describe('getProjectSprintVelocity', () => {
    beforeEach(() => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
    });

    it('throws NotFound when project is not accessible', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getProjectSprintVelocity('proj-1', 'user-1', 6),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.sprint.findMany).not.toHaveBeenCalled();
    });

    it('returns empty bars when there are no sprints', async () => {
      prisma.sprint.findMany.mockResolvedValue([]);

      const result = await service.getProjectSprintVelocity('proj-1', 'user-1', 6);

      expect(result.projectId).toBe('proj-1');
      expect(result.sprints).toEqual([]);
      expect(result.averageCompletedPoints).toBe(0);
    });

    it('aggregates completed points per sprint window and averages', async () => {
      prisma.sprint.findMany.mockResolvedValue([
        {
          id: 'sp-recent',
          projectId: 'proj-1',
          name: 'Recent',
          goal: null,
          startDate: new Date(2024, 5, 1),
          endDate: new Date(2024, 5, 14),
          state: 'CLOSED',
          sortOrder: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'sp-old',
          projectId: 'proj-1',
          name: 'Old',
          goal: null,
          startDate: new Date(2024, 2, 1),
          endDate: new Date(2024, 2, 14),
          state: 'CLOSED',
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      prisma.task.findMany.mockResolvedValue([
        {
          sprintId: 'sp-recent',
          storyPoints: 5,
          completedAt: new Date(2024, 5, 7, 15, 0, 0),
          updatedAt: now,
        },
        {
          sprintId: 'sp-recent',
          storyPoints: 2,
          completedAt: new Date(2024, 5, 10, 10, 0, 0),
          updatedAt: now,
        },
        {
          sprintId: 'sp-old',
          storyPoints: 3,
          completedAt: new Date(2024, 2, 5, 10, 0, 0),
          updatedAt: now,
        },
      ]);

      const result = await service.getProjectSprintVelocity('proj-1', 'user-1', 6);

      expect(result.sprints).toHaveLength(2);
      expect(result.sprints[0].sprintId).toBe('sp-recent');
      expect(result.sprints[0].completedPoints).toBe(7);
      expect(result.sprints[0].completedTaskCount).toBe(2);
      expect(result.sprints[1].completedPoints).toBe(3);
      expect(result.sprints[1].completedTaskCount).toBe(1);
      expect(result.averageCompletedPoints).toBe(5);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TaskStatus.DONE,
            sprintId: { in: ['sp-recent', 'sp-old'] },
          }),
        }),
      );
    });

    it('clamps take between 1 and 12', async () => {
      prisma.sprint.findMany.mockResolvedValue([]);

      await service.getProjectSprintVelocity('proj-1', 'user-1', 0);
      expect(prisma.sprint.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 1 }),
      );

      await service.getProjectSprintVelocity('proj-1', 'user-1', 99);
      expect(prisma.sprint.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 12 }),
      );
    });
  });

  describe('normalizeSavedViewConfig', () => {
    function norm(raw: unknown): ProjectSavedViewConfigDto {
      return (
        service as unknown as {
          normalizeSavedViewConfig: (r: unknown) => ProjectSavedViewConfigDto;
        }
      ).normalizeSavedViewConfig(raw);
    }

    it('accepts timephased surface and timephased* fields', () => {
      expect(
        norm({
          surface: 'timephased',
          sprintFilter: 'all',
          timephasedGranularity: 'day',
          timephasedBasis: 'working',
          timephasedGridMode: 'resource_usage',
        }),
      ).toEqual({
        surface: 'timephased',
        sprintFilter: 'all',
        timephasedGranularity: 'day',
        timephasedBasis: 'working',
        timephasedGridMode: 'resource_usage',
      });
    });

    it('accepts network surface', () => {
      expect(
        norm({
          surface: 'network',
          epicFilter: 'all',
        }),
      ).toEqual({ surface: 'network', epicFilter: 'all' });
    });

    it('strips invalid timephasedGridMode and unknown surface values', () => {
      expect(
        norm({
          surface: 'timephased',
          timephasedGridMode: 'invalid',
        }),
      ).toEqual({ surface: 'timephased' });
      expect(
        norm({
          surface: 'not-a-real-surface',
          timephasedGranularity: 'week',
        }),
      ).toEqual({ timephasedGranularity: 'week' });
    });

    it('ignores malformed timephasedGranularity and basis', () => {
      expect(
        norm({
          surface: 'timephased',
          timephasedGranularity: 'hourly',
          timephasedBasis: 'maybe',
        }),
      ).toEqual({ surface: 'timephased' });
    });
  });

  describe('toProjectDto', () => {
    it('maps workspaceIds from links and sections when present', () => {
      const dto = service.toProjectDto({
        ...baseCreatedProject,
        taskCount: 2,
        completedTaskCount: 8,
        sections: [
          {
            id: 's1',
            projectId: 'proj-1',
            name: 'Backlog',
            sortOrder: 0,
            isDefault: true,
            createdAt: now,
            updatedAt: now,
            tasks: [{ id: 't1', title: 'Task' }],
          },
        ],
      });

      expect(dto.workspaceIds).toEqual(['ws-a', 'ws-b']);
      expect(dto.taskCount).toBe(2);
      expect(dto.completedTaskCount).toBe(8);
      expect(dto.sections?.[0]?.tasks).toEqual([{ id: 't1', title: 'Task' }]);
      expect(taskService.toTaskDto).toHaveBeenCalled();
    });
  });
});
