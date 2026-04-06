import { Test } from '@nestjs/testing';
import { AuditEventType } from '@prisma/client';
import { TaskActivityLogService } from './task-activity-log.service';
import { PrismaService } from '../common/prisma.service';

describe('TaskActivityLogService', () => {
  let service: TaskActivityLogService;
  const prisma = {
    activityLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskActivityLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TaskActivityLogService);
  });

  it('creates activity row with core fields', async () => {
    prisma.activityLog.create.mockResolvedValue({ id: 'log-1' });

    await service.log({
      actorId: 'user-1',
      taskId: 'task-1',
      projectId: 'proj-1',
      eventType: AuditEventType.TASK_UPDATED,
      description: 'Something happened',
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 'task-1',
        projectId: 'proj-1',
        actorId: 'user-1',
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Something happened',
      }),
    });
  });

  it('includes oldValue and newValue when provided', async () => {
    prisma.activityLog.create.mockResolvedValue({});

    await service.log({
      actorId: 'user-1',
      taskId: 'task-1',
      eventType: AuditEventType.ATTACHMENT_ADDED,
      description: 'Attached file',
      oldValue: { a: 1 },
      newValue: { b: 2 },
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldValue: { a: 1 },
        newValue: { b: 2 },
      }),
    });
  });

  it('omits optional projectId when null', async () => {
    prisma.activityLog.create.mockResolvedValue({});

    await service.log({
      actorId: 'user-1',
      taskId: 'task-1',
      projectId: null,
      eventType: AuditEventType.TASK_UPDATED,
      description: 'No project',
    });

    const data = prisma.activityLog.create.mock.calls[0][0].data;
    expect(data.projectId).toBeUndefined();
  });

  it('stores null taskId for project-level rows', async () => {
    prisma.activityLog.create.mockResolvedValue({});

    await service.log({
      actorId: 'user-1',
      taskId: null,
      projectId: 'proj-1',
      eventType: AuditEventType.TASK_UPDATED,
      description: 'Project event',
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: null,
        projectId: 'proj-1',
      }),
    });
  });
});
