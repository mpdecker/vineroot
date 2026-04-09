import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ScheduleProgramService } from './schedule-program.service';
import { ScheduleProjectService } from './schedule-project.service';

describe('ScheduleProgramService', () => {
  let service: ScheduleProgramService;
  const scheduleProject = {
    getCriticalPath: jest.fn(),
  };
  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
    scheduleProgram: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    scheduleProgramProject: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    project: { findFirst: jest.fn() },
    task: { aggregate: jest.fn() },
  };

  const ws = 'ws1';
  const uid = 'u1';
  const now = new Date();

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScheduleProgramService,
        { provide: PrismaService, useValue: prisma },
        { provide: ScheduleProjectService, useValue: scheduleProject },
      ],
    }).compile();
    service = moduleRef.get(ScheduleProgramService);
  });

  it('list requires workspace membership', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValueOnce(null);
    await expect(service.list(ws, uid)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create returns program with empty projectIds', async () => {
    prisma.scheduleProgram.create.mockResolvedValue({
      id: 'prog1',
      workspaceId: ws,
      name: 'P',
      createdAt: now,
      updatedAt: now,
    });

    const dto = await service.create(ws, uid, { name: 'P' });
    expect(dto.id).toBe('prog1');
    expect(dto.projectIds).toEqual([]);
  });

  it('addProject rejects project not in workspace', async () => {
    prisma.scheduleProgram.findUnique.mockResolvedValue({
      id: 'prog1',
      workspaceId: ws,
      name: 'P',
      createdAt: now,
      updatedAt: now,
    });
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.addProject('prog1', uid, { projectId: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findById throws when program missing', async () => {
    prisma.scheduleProgram.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope', uid)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findSharedProgramForProjects returns program when both linked', async () => {
    prisma.scheduleProgramProject.findMany.mockResolvedValue([
      { programId: 'g1', projectId: 'pa' },
      { programId: 'g1', projectId: 'pb' },
    ]);

    const id = await service.findSharedProgramForProjects('pa', 'pb');
    expect(id).toBe('g1');
  });

  it('findSharedProgramForProjects returns null when only one project linked', async () => {
    prisma.scheduleProgramProject.findMany.mockResolvedValue([
      { programId: 'g1', projectId: 'pa' },
    ]);

    expect(await service.findSharedProgramForProjects('pa', 'pb')).toBeNull();
  });

  it('findSharedProgramForProjects returns null for same id twice', async () => {
    expect(await service.findSharedProgramForProjects('x', 'x')).toBeNull();
  });

  it('scheduleRollup merges bounds and critical path per project', async () => {
    prisma.scheduleProgram.findUnique.mockResolvedValue({
      id: 'prog1',
      workspaceId: ws,
      name: 'G',
      createdAt: now,
      updatedAt: now,
      projects: [{ projectId: 'p1' }],
    });
    scheduleProject.getCriticalPath.mockResolvedValue({
      projectId: 'p1',
      criticalTaskIds: ['t1'],
      tasks: [],
    });
    prisma.project.findFirst.mockResolvedValue({
      name: 'Alpha',
      startDate: null,
      dueDate: null,
    });
    const d1 = new Date('2026-03-01T00:00:00.000Z');
    const d2 = new Date('2026-03-15T00:00:00.000Z');
    prisma.task.aggregate.mockResolvedValue({
      _min: { startDate: d1 },
      _max: { dueDate: d2 },
    });

    const roll = await service.scheduleRollup('prog1', uid);
    expect(roll.programId).toBe('prog1');
    expect(roll.projects).toHaveLength(1);
    expect(roll.projects[0].projectName).toBe('Alpha');
    expect(roll.projects[0].criticalTaskCount).toBe(1);
    expect(roll.programEarliestStart).toBe(d1.toISOString());
    expect(roll.programLatestFinish).toBe(d2.toISOString());
  });

  it('scheduleRollup skips projects user cannot access', async () => {
    prisma.scheduleProgram.findUnique.mockResolvedValue({
      id: 'prog1',
      workspaceId: ws,
      name: 'G',
      createdAt: now,
      updatedAt: now,
      projects: [{ projectId: 'p1' }, { projectId: 'p2' }],
    });
    scheduleProject.getCriticalPath
      .mockRejectedValueOnce(new NotFoundException())
      .mockResolvedValueOnce({
        projectId: 'p2',
        criticalTaskIds: [],
        tasks: [],
      });
    prisma.project.findFirst.mockResolvedValue({
      name: 'B',
      startDate: null,
      dueDate: null,
    });
    prisma.task.aggregate.mockResolvedValue({
      _min: { startDate: null },
      _max: { dueDate: null },
    });

    const roll = await service.scheduleRollup('prog1', uid);
    expect(roll.projects).toHaveLength(1);
    expect(roll.projects[0].projectId).toBe('p2');
  });
});
