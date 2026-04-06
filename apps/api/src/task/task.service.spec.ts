import { Test } from '@nestjs/testing';
import { AuditEventType, DependencyType } from '@prisma/client';
import { TaskService } from './task.service';
import { AttachmentService } from '../attachment/attachment.service';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { AutomationService } from '../automation/automation.service';
import { OutboundWebhookService } from '../outbound-webhook/outbound-webhook.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import {
  TaskPriority,
  TaskStatus,
  ActorTier,
  TaskDomain,
  TaskComplexity,
  ReviewGate,
  CustomFieldType,
} from '@vineroot/shared-types';

function minimalTaskRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'task-1',
    projectId: 'proj-1',
    sectionId: undefined,
    parentTaskId: undefined,
    createdById: 'user-1',
    title: 'Example',
    description: undefined,
    htmlContent: undefined,
    status: TaskStatus.BACKLOG,
    priority: TaskPriority.NONE,
    startDate: undefined,
    dueDate: undefined,
    completedAt: undefined,
    estimatedMin: undefined,
    actualMin: undefined,
    sortOrder: 0,
    actorTier: ActorTier.HUMAN,
    domain: TaskDomain.GENERAL,
    complexity: TaskComplexity.LOW,
    reviewGate: ReviewGate.NONE,
    phase: undefined,
    parallelGroup: undefined,
    agentContext: undefined,
    agentOutput: undefined,
    agentStartedAt: undefined,
    agentCompletedAt: undefined,
    retryCount: 0,
    escalationNote: undefined,
    isArchived: false,
    isTemplate: false,
    isMilestone: false,
    workItemType: 'TASK',
    storyPoints: null,
    sprintId: null,
    createdAt: now,
    updatedAt: now,
    assignees: [],
    subtasks: [],
    tags: [],
    createdBy: { id: 'user-1', email: 'u@x.com', displayName: 'U' },
    ...overrides,
  };
}

function minimalDetailRow(overrides: Record<string, unknown> = {}) {
  const base = minimalTaskRow(overrides);
  const now = new Date();
  return {
    ...base,
    deletedAt: null,
    dependencies: [],
    blockedBy: [],
    attachments: [],
    customFieldValues: [],
    activityLogs: [],
    subtasks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TaskService', () => {
  let service: TaskService;
  const prisma = {
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    sprint: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    section: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    projectWorkspace: {
      findMany: jest.fn(),
    },
    taskAssignee: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    taskDependency: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    attachment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    projectCustomField: {
      findMany: jest.fn(),
    },
    customFieldValue: {
      findMany: jest.fn(),
    },
    projectCfdSnapshot: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    sprintMetricSnapshot: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const eventsGateway = {
    emitToWorkspace: jest.fn(),
    emitToUser: jest.fn(),
    emitToTask: jest.fn(),
  };
  const automationService = {
    evaluate: jest.fn().mockResolvedValue({ matchedAutomations: [] }),
  };
  const outboundWebhookService = {
    resolveWorkspaceIds: jest.fn().mockResolvedValue(['ws-1']),
    deliverTaskEvent: jest.fn().mockResolvedValue(undefined),
  };
  const taskActivityLog = { log: jest.fn().mockResolvedValue(undefined) };
  const attachmentService = {
    removeLocalStoredFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: AutomationService, useValue: automationService },
        { provide: OutboundWebhookService, useValue: outboundWebhookService },
        { provide: TaskActivityLogService, useValue: taskActivityLog },
        { provide: AttachmentService, useValue: attachmentService },
      ],
    }).compile();

    service = moduleRef.get(TaskService);
  });

  it('create persists task and emits workspace event when project resolves', async () => {
    const row = minimalTaskRow();
    prisma.task.create.mockResolvedValue(row);
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      deletedAt: null,
      workspaceLinks: [{ workspaceId: 'ws-1' }],
    });

    const dto = await service.create('proj-1', 'user-1', { title: 'New task' });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          workspaceId: 'ws-1',
          createdById: 'user-1',
          title: 'New task',
        }),
      }),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'task:created',
      expect.objectContaining({
        action: 'created',
        task: expect.objectContaining({ id: 'task-1', title: 'Example' }),
      }),
    );
    expect(dto.id).toBe('task-1');
    expect(automationService.evaluate).toHaveBeenCalled();
    expect(prisma.projectCfdSnapshot.upsert).toHaveBeenCalled();
    expect(prisma.sprintMetricSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('create throws when project is missing', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.create('proj-1', 'user-1', { title: 'Orphan' }),
    ).rejects.toThrow('Project not found');

    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(eventsGateway.emitToWorkspace).not.toHaveBeenCalled();
  });

  it('createWithOptionalProject creates workspace-only task when projectId omitted', async () => {
    const row = minimalTaskRow({
      projectId: undefined,
      workspaceId: 'ws-1',
    });
    prisma.task.create.mockResolvedValue(row);

    await service.createWithOptionalProject('user-1', 'ws-1', { title: 'Personal' });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          projectId: null,
          title: 'Personal',
          createdById: 'user-1',
        }),
      }),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'task:created',
      expect.objectContaining({ action: 'created' }),
    );
  });

  it('createWithOptionalProject uses project path when projectId provided', async () => {
    const row = minimalTaskRow();
    prisma.task.create.mockResolvedValue(row);
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      deletedAt: null,
      workspaceLinks: [{ workspaceId: 'ws-1' }],
    });

    await service.createWithOptionalProject('user-1', 'ws-1', {
      title: 'In project',
      projectId: 'proj-1',
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          workspaceId: 'ws-1',
          title: 'In project',
        }),
      }),
    );
  });

  it('create emits task:created to each workspace linked to the project', async () => {
    const row = minimalTaskRow();
    prisma.task.create.mockResolvedValue(row);
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      deletedAt: null,
      workspaceLinks: [{ workspaceId: 'ws-a' }, { workspaceId: 'ws-b' }],
    });

    await service.create('proj-1', 'user-1', { title: 'Multi' });

    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledTimes(2);
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws-a',
      'task:created',
      expect.any(Object),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws-b',
      'task:created',
      expect.any(Object),
    );
  });

  it('update emits task:updated to all workspaces for a project task', async () => {
    const prior = minimalTaskRow({ title: 'Old' });
    const updated = minimalTaskRow({ title: 'Renamed' });
    prisma.task.findUnique.mockResolvedValue(prior);
    prisma.task.update.mockResolvedValue(updated);
    prisma.projectWorkspace.findMany.mockResolvedValue([
      { workspaceId: 'w1' },
      { workspaceId: 'w2' },
    ]);

    await service.update('task-1', 'user-1', { title: 'Renamed' });

    expect(prisma.projectWorkspace.findMany).toHaveBeenCalledWith({
      where: { projectId: 'proj-1' },
      select: { workspaceId: true },
    });
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'w1',
      'task:updated',
      expect.objectContaining({ action: 'updated' }),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'w2',
      'task:updated',
      expect.objectContaining({ action: 'updated' }),
    );
    expect(prisma.projectCfdSnapshot.upsert).toHaveBeenCalled();
  });

  it('update emits to task.workspaceId when task has no project', async () => {
    const prior = minimalTaskRow({
      projectId: undefined,
      workspaceId: 'ws-only',
      title: 'Was',
    });
    const updated = minimalTaskRow({
      projectId: undefined,
      workspaceId: 'ws-only',
      title: 'Solo',
    });
    prisma.task.findUnique.mockResolvedValue(prior);
    prisma.task.update.mockResolvedValue(updated);

    await service.update('task-1', 'user-1', { title: 'Solo' });

    expect(prisma.projectWorkspace.findMany).not.toHaveBeenCalled();
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'ws-only',
      'task:updated',
      expect.objectContaining({ action: 'updated' }),
    );
    expect(prisma.projectCfdSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('update rejects marking task DONE when a required project custom field is empty', async () => {
    const prior = minimalTaskRow({
      status: TaskStatus.BACKLOG,
      projectId: 'proj-1',
    });
    prisma.task.findUnique.mockResolvedValue(prior);
    prisma.projectCustomField.findMany.mockResolvedValue([
      {
        field: {
          id: 'f1',
          name: 'Estimate',
          type: CustomFieldType.TEXT,
          isRequired: true,
        },
      },
    ]);
    prisma.customFieldValue.findMany.mockResolvedValue([]);

    await expect(
      service.update('task-1', 'user-1', { status: TaskStatus.DONE }),
    ).rejects.toThrow(/Complete required field/);

    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('delete emits task:deleted to all workspaces for a project task', async () => {
    const existing = minimalTaskRow();
    prisma.task.findUnique.mockResolvedValue(existing);
    prisma.task.update.mockResolvedValue({ ...existing, deletedAt: new Date() });
    prisma.projectWorkspace.findMany.mockResolvedValue([{ workspaceId: 'wx' }]);

    await service.delete('task-1');

    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'wx',
      'task:deleted',
      expect.objectContaining({ action: 'deleted' }),
    );
  });

  it('addAssignee logs TASK_ASSIGNED and emits task:updated', async () => {
    const prior = minimalTaskRow({ assignees: [] });
    const next = minimalTaskRow({
      assignees: [{ userId: 'u-new' }],
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-new',
      displayName: 'Pat',
      email: 'p@x.com',
    });
    prisma.taskAssignee.create.mockResolvedValue({});
    const detail = minimalDetailRow({
      assignees: [
        {
          id: 'ta-1',
          taskId: 'task-1',
          userId: 'u-new',
          user: { id: 'u-new', email: 'p@x.com', displayName: 'Pat' },
          assignedAt: new Date(),
        },
      ],
    });
    prisma.task.findUnique
      .mockResolvedValueOnce(prior)
      .mockResolvedValueOnce(next)
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({ projectId: 'proj-1', workspaceId: null });
    prisma.projectWorkspace.findMany.mockResolvedValue([{ workspaceId: 'w1' }]);

    await service.addAssignee('task-1', 'actor-1', 'u-new');

    expect(taskActivityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        taskId: 'task-1',
        eventType: AuditEventType.TASK_ASSIGNED,
        description: 'Assigned Pat',
        newValue: { assigneeId: 'u-new' },
      }),
    );
    expect(eventsGateway.emitToWorkspace).toHaveBeenCalledWith(
      'w1',
      'task:updated',
      expect.objectContaining({ action: 'updated' }),
    );
  });

  it('removeAssignee logs removal', async () => {
    const prior = minimalTaskRow({
      assignees: [{ userId: 'u-old' }],
    });
    const next = minimalTaskRow({ assignees: [] });
    prisma.user.findUnique.mockResolvedValue({
      displayName: 'Old',
      email: 'o@x.com',
    });
    prisma.taskAssignee.delete.mockResolvedValue({});
    const detail = minimalDetailRow({ assignees: [] });
    prisma.task.findUnique
      .mockResolvedValueOnce(prior)
      .mockResolvedValueOnce(next)
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({ projectId: 'proj-1', workspaceId: null });
    prisma.projectWorkspace.findMany.mockResolvedValue([{ workspaceId: 'w1' }]);

    await service.removeAssignee('task-1', 'actor-1', 'u-old');

    expect(taskActivityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        taskId: 'task-1',
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Removed assignee Old',
        oldValue: { assigneeId: 'u-old' },
      }),
    );
  });

  it('reorderTasks applies sortOrder and optional sectionId', async () => {
    prisma.task.update.mockResolvedValue(minimalTaskRow());
    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'a',
          projectId: 'proj-1',
          parentTaskId: null,
          sectionId: 'sec-0',
          sortOrder: 0,
        },
        {
          id: 'b',
          projectId: 'proj-1',
          parentTaskId: null,
          sectionId: null,
          sortOrder: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'a',
          parentTaskId: null,
          sectionId: 'sec-0',
          sortOrder: 0,
        },
        {
          id: 'b',
          parentTaskId: null,
          sectionId: null,
          sortOrder: 1,
        },
      ])
      .mockResolvedValueOnce([
        { id: 'a', sectionId: 'sec-0', assignees: [], workspaceId: 'ws-1', projectId: 'p1', status: TaskStatus.BACKLOG, agentCompletedAt: undefined, createdById: 'user-1' },
        { id: 'b', sectionId: null, assignees: [], workspaceId: 'ws-1', projectId: 'p1', status: TaskStatus.BACKLOG, agentCompletedAt: undefined, createdById: 'user-1' },
      ])
      .mockResolvedValueOnce([
        { id: 'a', sectionId: 'sec-1', assignees: [], workspaceId: 'ws-1', projectId: 'p1', status: TaskStatus.BACKLOG, agentCompletedAt: undefined, createdById: 'user-1' },
        { id: 'b', sectionId: null, assignees: [], workspaceId: 'ws-1', projectId: 'p1', status: TaskStatus.BACKLOG, agentCompletedAt: undefined, createdById: 'user-1' },
      ]);

    await service.reorderTasks({
      items: [
        { taskId: 'a', sortOrder: 1, sectionId: 'sec-1' },
        { taskId: 'b', sortOrder: 2 },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.task.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'a' },
      data: { sortOrder: 1, sectionId: 'sec-1' },
    });
    expect(prisma.task.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'b' },
      data: { sortOrder: 2 },
    });
    expect(automationService.evaluate).toHaveBeenCalled();
  });

  it('reorderTasks rejects when STRICT Kanban WIP would be exceeded', async () => {
    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'a',
          projectId: 'proj-1',
          parentTaskId: null,
          sectionId: 'sec-0',
          sortOrder: 0,
        },
        {
          id: 'b',
          projectId: 'proj-1',
          parentTaskId: null,
          sectionId: 'sec-0',
          sortOrder: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'a',
          parentTaskId: null,
          sectionId: 'sec-0',
          sortOrder: 0,
        },
        {
          id: 'b',
          parentTaskId: null,
          sectionId: 'sec-0',
          sortOrder: 1,
        },
      ]);
    prisma.project.findFirst.mockResolvedValue({
      kanbanWipEnforcement: 'STRICT',
    });
    prisma.section.findMany.mockResolvedValue([
      { id: 'sec-0', name: 'Doing', wipLimit: 1 },
    ]);

    await expect(
      service.reorderTasks({
        items: [
          { taskId: 'a', sortOrder: 0, sectionId: 'sec-0' },
          { taskId: 'b', sortOrder: 1, sectionId: 'sec-0' },
        ],
      }),
    ).rejects.toThrow(/WIP limit/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reorderTasks applies parentTaskId when reparenting', async () => {
    prisma.task.update.mockResolvedValue(minimalTaskRow());
    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'child',
          projectId: 'proj-1',
          parentTaskId: 'p1',
          sectionId: 's1',
          sortOrder: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'root',
          parentTaskId: null,
          sectionId: 's1',
          sortOrder: 0,
        },
        {
          id: 'p1',
          parentTaskId: null,
          sectionId: 's1',
          sortOrder: 1,
        },
        {
          id: 'child',
          parentTaskId: 'p1',
          sectionId: 's1',
          sortOrder: 0,
        },
      ])
      .mockResolvedValueOnce([
        { id: 'child', sectionId: 's1', assignees: [], workspaceId: 'ws-1', projectId: 'proj-1', status: TaskStatus.BACKLOG, agentCompletedAt: undefined, createdById: 'user-1' },
      ])
      .mockResolvedValueOnce([
        { id: 'child', sectionId: 's1', assignees: [], workspaceId: 'ws-1', projectId: 'proj-1', status: TaskStatus.BACKLOG, agentCompletedAt: undefined, createdById: 'user-1' },
      ]);

    await service.reorderTasks({
      items: [
        { taskId: 'child', sortOrder: 0, parentTaskId: 'root', sectionId: 's1' },
      ],
    });

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'child' },
      data: { sortOrder: 0, sectionId: 's1', parentTaskId: 'root' },
    });
  });

  it('create logs activity on parent when parentTaskId is set', async () => {
    const row = minimalTaskRow({ id: 'child-1', parentTaskId: 'parent-1', title: 'Sub' });
    prisma.task.create.mockResolvedValue(row);
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      deletedAt: null,
      workspaceLinks: [{ workspaceId: 'ws-1' }],
    });

    await service.create('proj-1', 'user-1', {
      title: 'Sub',
      parentTaskId: 'parent-1',
    });

    expect(taskActivityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'parent-1',
        actorId: 'user-1',
        projectId: 'proj-1',
        description: expect.stringContaining('Subtask created'),
        newValue: { subtaskId: 'child-1' },
      }),
    );
  });

  it('findById maps waitingOn, attachments, and activityLogs', async () => {
    const now = new Date();
    prisma.task.findUnique.mockResolvedValue(
      minimalDetailRow({
        id: 'task-1',
        dependencies: [
          {
            id: 'd1',
            dependentId: 'task-1',
            blockingId: 'task-2',
            type: DependencyType.WAITING_ON,
            createdAt: now,
            blockingTask: {
              id: 'task-2',
              title: 'Blocker',
              status: TaskStatus.IN_PROGRESS,
              projectId: 'proj-1',
            },
          },
        ],
        attachments: [
          {
            id: 'a1',
            taskId: 'task-1',
            filename: 'doc.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 500,
            url: 'https://example.com/doc.pdf',
            createdAt: now,
            uploadedById: 'u1',
          },
        ],
        activityLogs: [
          {
            id: 'l1',
            taskId: 'task-1',
            projectId: 'proj-1',
            actorId: 'u1',
            eventType: AuditEventType.TASK_UPDATED,
            description: 'Field changed',
            createdAt: now,
            actor: { id: 'u1', email: 'a@b.com', displayName: 'Alex' },
          },
        ],
      }),
    );

    const dto = await service.findById('task-1');

    expect(dto?.waitingOn).toHaveLength(1);
    expect(dto?.waitingOn?.[0].blockingTask?.title).toBe('Blocker');
    expect(dto?.attachments?.[0].filename).toBe('doc.pdf');
    expect(dto?.activityLogs?.[0].description).toBe('Field changed');
    expect(dto?.activityLogs?.[0].actor?.displayName).toBe('Alex');
  });

  it('findById returns null when task is deleted', async () => {
    prisma.task.findUnique.mockResolvedValue(
      minimalDetailRow({ deletedAt: new Date() }),
    );
    await expect(service.findById('gone')).resolves.toBeNull();
  });

  it('addDependency rejects self-dependency', async () => {
    await expect(
      service.addDependency('u1', 'same', { blockingTaskId: 'same' }),
    ).rejects.toThrow('cannot depend on itself');
    expect(prisma.taskDependency.create).not.toHaveBeenCalled();
  });

  it('addDependency rejects tasks in different projects', async () => {
    prisma.task.findUnique.mockImplementation((args: { where: { id: string } }) => {
      const id = args.where.id;
      if (id === 'a')
        return { id: 'a', projectId: 'p1', deletedAt: null, title: 'A' };
      if (id === 'b')
        return { id: 'b', projectId: 'p2', deletedAt: null, title: 'B' };
      return null;
    });

    await expect(
      service.addDependency('u1', 'a', { blockingTaskId: 'b' }),
    ).rejects.toThrow('same project');
  });

  it('addDependency maps unique violation to BadRequest', async () => {
    prisma.task.findUnique.mockImplementation((args: { where: { id: string } }) => {
      const id = args.where.id;
      if (id === 'a')
        return { id: 'a', projectId: 'p1', deletedAt: null, title: 'A' };
      if (id === 'b')
        return { id: 'b', projectId: 'p1', deletedAt: null, title: 'B' };
      return null;
    });
    prisma.taskDependency.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.addDependency('u1', 'a', { blockingTaskId: 'b' }),
    ).rejects.toThrow('already exists');
  });

  it('addDependency creates row, logs, and returns findById dto', async () => {
    prisma.task.findUnique.mockImplementation((args: any) => {
      if (args.include?.dependencies !== undefined) {
        return minimalDetailRow({
          id: 'a',
          dependencies: [],
        });
      }
      const id = args.where.id;
      if (id === 'a')
        return { id: 'a', projectId: 'p1', deletedAt: null, title: 'Dep' };
      if (id === 'b')
        return { id: 'b', projectId: 'p1', deletedAt: null, title: 'Block' };
      return null;
    });
    prisma.taskDependency.create.mockResolvedValue({});

    const dto = await service.addDependency('u1', 'a', { blockingTaskId: 'b' });

    expect(prisma.taskDependency.create).toHaveBeenCalledWith({
      data: {
        dependentId: 'a',
        blockingId: 'b',
        type: DependencyType.WAITING_ON,
      },
    });
    expect(taskActivityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'a',
        description: expect.stringContaining('Block'),
        eventType: AuditEventType.TASK_UPDATED,
      }),
    );
    expect(dto.id).toBe('a');
  });

  it('removeDependency maps missing row to NotFound', async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 'a',
      projectId: 'p1',
      deletedAt: null,
      title: 'A',
    });
    prisma.taskDependency.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.removeDependency('u1', 'a', 'b')).rejects.toThrow('not found');
  });

  it('removeDependency deletes, logs, and returns findById dto', async () => {
    prisma.task.findUnique.mockImplementation((args: any) => {
      if (args.include?.dependencies !== undefined) {
        return minimalDetailRow({ id: 'a' });
      }
      const id = args.where.id;
      if (id === 'a')
        return { id: 'a', projectId: 'p1', deletedAt: null, title: 'A' };
      if (id === 'b')
        return { id: 'b', projectId: 'p1', deletedAt: null, title: 'B' };
      return null;
    });
    prisma.taskDependency.delete.mockResolvedValue({});

    const dto = await service.removeDependency('u1', 'a', 'b');

    expect(prisma.taskDependency.delete).toHaveBeenCalledWith({
      where: { dependentId_blockingId: { dependentId: 'a', blockingId: 'b' } },
    });
    expect(taskActivityLog.log).toHaveBeenCalled();
    expect(dto.id).toBe('a');
  });

  it('addAttachment throws when task missing', async () => {
    prisma.task.findUnique.mockResolvedValue(null);

    await expect(
      service.addAttachment('u1', 'missing', {
        filename: 'f',
        mimeType: 'text/plain',
        sizeBytes: 1,
        url: 'https://x',
      }),
    ).rejects.toThrow('not found');
  });

  it('addAttachment creates link storageKey when omitted and logs ATTACHMENT_ADDED', async () => {
    prisma.task.findUnique.mockImplementation((args: any) => {
      if (args.include?.dependencies !== undefined) {
        return minimalDetailRow({ id: 't1' });
      }
      return { id: 't1', projectId: 'p1', deletedAt: null };
    });
    prisma.attachment.create.mockResolvedValue({});

    await service.addAttachment('u1', 't1', {
      filename: 'readme.md',
      mimeType: 'text/markdown',
      sizeBytes: 10,
      url: 'https://example.com/r.md',
    });

    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 't1',
        filename: 'readme.md',
        storageKey: expect.stringMatching(/^link:/),
      }),
    });
    expect(taskActivityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.ATTACHMENT_ADDED,
        description: expect.stringContaining('readme.md'),
      }),
    );
  });

  it('deleteAttachment throws when attachment belongs to another task', async () => {
    prisma.attachment.findUnique.mockResolvedValue({
      id: 'att',
      taskId: 'other',
      filename: 'x',
    });

    await expect(service.deleteAttachment('u1', 't1', 'att')).rejects.toThrow('not found');
  });

  it('deleteAttachment removes file and logs', async () => {
    prisma.attachment.findUnique.mockResolvedValue({
      id: 'att',
      taskId: 't1',
      filename: 'old.bin',
      storageKey: 'tasks/t1/abc-old.bin',
    });
    prisma.task.findUnique.mockImplementation((args: any) => {
      if (args.select?.projectId) return { projectId: 'p1' };
      if (args.include?.dependencies !== undefined) return minimalDetailRow({ id: 't1' });
      return null;
    });
    prisma.attachment.delete.mockResolvedValue({});

    const dto = await service.deleteAttachment('u1', 't1', 'att');

    expect(attachmentService.removeLocalStoredFile).toHaveBeenCalledWith('tasks/t1/abc-old.bin');
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att' } });
    expect(taskActivityLog.log).toHaveBeenCalled();
    expect(dto.id).toBe('t1');
  });
});
