import { Test } from '@nestjs/testing';
import { AutomationService } from './automation.service';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { NotificationService } from '../notification/notification.service';
import {
  AutomationTriggerType,
  AutomationActionType,
  TaskStatus,
  NotificationType,
  ActorTier,
} from '@prisma/client';

describe('AutomationService', () => {
  let service: AutomationService;
  const prisma = {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskAssignee: {
      upsert: jest.fn(),
    },
    taskTag: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    automation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    automationAction: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    projectWorkspace: {
      findMany: jest.fn(),
    },
  };

  const gateway = {
    emitToWorkspace: jest.fn(),
    emitToTask: jest.fn(),
    emitToUser: jest.fn(),
  };

  const notificationService = {
    create: jest.fn(),
  };

  const workspaceTask = {
    id: 'task-1',
    workspaceId: 'ws-1',
    projectId: null,
    title: 'Task',
    status: TaskStatus.BACKLOG,
    sectionId: null,
    deletedAt: null,
    createdById: 'user-1',
    assignees: [],
    project: null,
  };

  const taskForEmit = {
    ...workspaceTask,
    tags: [],
    subtasks: [],
    createdBy: { id: 'user-1' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.task.findUnique.mockResolvedValue(taskForEmit);
    prisma.projectWorkspace.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: gateway },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();
    service = moduleRef.get(AutomationService);
  });

  describe('evaluate', () => {
    it('returns empty when no task payload', async () => {
      const r = await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        undefined,
      );
      expect(r.matchedAutomations).toEqual([]);
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });

    it('returns empty when task row missing in database', async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);

      const r = await service.evaluate(
        'missing',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        { id: 'missing', status: TaskStatus.BACKLOG },
      );

      expect(r.matchedAutomations).toEqual([]);
      expect(prisma.automation.findMany).not.toHaveBeenCalled();
    });

    it('returns empty when task has no workspace context', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({
        ...workspaceTask,
        workspaceId: null,
        project: null,
      });

      const r = await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        { id: 'task-1' },
      );

      expect(r.matchedAutomations).toEqual([]);
      expect(prisma.automation.findMany).not.toHaveBeenCalled();
    });

    it('runs CHANGE_STATUS on TASK_CREATED when rule matches', async () => {
      prisma.automation.findMany.mockResolvedValue([
        {
          id: 'auto-1',
          workspaceId: 'ws-1',
          projectId: null,
          name: 'On create',
          triggerType: AutomationTriggerType.TASK_CREATED,
          triggerConfig: {},
          isActive: true,
          actions: [
            {
              id: 'act-1',
              automationId: 'auto-1',
              actionType: AutomationActionType.CHANGE_STATUS,
              actionConfig: { targetStatus: TaskStatus.READY },
              sortOrder: 0,
            },
          ],
        },
      ]);
      prisma.task.update.mockResolvedValue({
        ...workspaceTask,
        status: TaskStatus.READY,
      });

      const r = await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        { id: 'task-1', status: TaskStatus.BACKLOG },
      );

      expect(r.matchedAutomations).toHaveLength(1);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: TaskStatus.READY },
      });
      expect(gateway.emitToWorkspace).toHaveBeenCalledWith(
        'ws-1',
        'task:updated',
        expect.objectContaining({
          action: 'updated',
          task: expect.objectContaining({ id: 'task-1' }),
        }),
      );
    });

    it('skips project-scoped automation when task.projectId differs', async () => {
      prisma.automation.findMany.mockResolvedValue([
        {
          id: 'auto-p',
          workspaceId: 'ws-1',
          projectId: 'project-a',
          name: 'Project only',
          triggerType: AutomationTriggerType.TASK_CREATED,
          triggerConfig: {},
          isActive: true,
          actions: [
            {
              id: 'act-1',
              automationId: 'auto-p',
              actionType: AutomationActionType.CHANGE_STATUS,
              actionConfig: { targetStatus: TaskStatus.READY },
              sortOrder: 0,
            },
          ],
        },
      ]);

      const r = await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        { id: 'task-1' },
      );

      expect(r.matchedAutomations).toEqual([]);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('TASK_STATUS_CHANGED requires old and new status and respects from/to config', async () => {
      prisma.automation.findMany.mockResolvedValue([
        {
          id: 'auto-s',
          workspaceId: 'ws-1',
          projectId: null,
          name: 'Status flow',
          triggerType: AutomationTriggerType.TASK_STATUS_CHANGED,
          triggerConfig: {
            fromStatus: TaskStatus.IN_PROGRESS,
            toStatus: TaskStatus.DONE,
          },
          isActive: true,
          actions: [
            {
              id: 'act-1',
              automationId: 'auto-s',
              actionType: AutomationActionType.CHANGE_STATUS,
              actionConfig: { targetStatus: TaskStatus.IN_REVIEW },
              sortOrder: 0,
            },
          ],
        },
      ]);
      prisma.task.update.mockResolvedValue(workspaceTask);

      const oldSnap = {
        status: TaskStatus.IN_PROGRESS,
        assignees: [],
      };
      const newSnap = { status: TaskStatus.DONE, assignees: [] };

      const r = await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_STATUS_CHANGED,
        oldSnap,
        newSnap,
      );

      expect(r.matchedAutomations).toHaveLength(1);
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('TASK_STATUS_CHANGED does not match when fromStatus wrong', async () => {
      prisma.automation.findMany.mockResolvedValue([
        {
          id: 'auto-s',
          workspaceId: 'ws-1',
          projectId: null,
          name: 'Status flow',
          triggerType: AutomationTriggerType.TASK_STATUS_CHANGED,
          triggerConfig: {
            fromStatus: TaskStatus.IN_PROGRESS,
            toStatus: TaskStatus.DONE,
          },
          isActive: true,
          actions: [
            {
              id: 'act-1',
              automationId: 'auto-s',
              actionType: AutomationActionType.CHANGE_STATUS,
              actionConfig: { targetStatus: TaskStatus.IN_REVIEW },
              sortOrder: 0,
            },
          ],
        },
      ]);

      const r = await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_STATUS_CHANGED,
        { status: TaskStatus.BACKLOG, assignees: [] },
        { status: TaskStatus.DONE, assignees: [] },
      );

      expect(r.matchedAutomations).toEqual([]);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('NOTIFY_USER calls NotificationService.create', async () => {
      prisma.automation.findMany.mockResolvedValue([
        {
          id: 'auto-n',
          workspaceId: 'ws-1',
          projectId: null,
          name: 'Notify',
          triggerType: AutomationTriggerType.TASK_CREATED,
          triggerConfig: {},
          isActive: true,
          actions: [
            {
              id: 'act-1',
              automationId: 'auto-n',
              actionType: AutomationActionType.NOTIFY_USER,
              actionConfig: {
                userId: 'recipient-1',
                title: 'Hello',
                body: 'World',
              },
              sortOrder: 0,
            },
          ],
        },
      ]);

      await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        { id: 'task-1' },
      );

      expect(notificationService.create).toHaveBeenCalledWith(
        'recipient-1',
        null,
        NotificationType.RULE_TRIGGERED,
        'Hello',
        'World',
        'task-1',
        'task',
      );
    });

    it('TRIGGER_AGENT sets actor tier and READY status', async () => {
      prisma.automation.findMany.mockResolvedValue([
        {
          id: 'auto-a',
          workspaceId: 'ws-1',
          projectId: null,
          name: 'Agent',
          triggerType: AutomationTriggerType.TASK_CREATED,
          triggerConfig: {},
          isActive: true,
          actions: [
            {
              id: 'act-1',
              automationId: 'auto-a',
              actionType: AutomationActionType.TRIGGER_AGENT,
              actionConfig: { actorTier: ActorTier.CLAUDE_SONNET },
              sortOrder: 0,
            },
          ],
        },
      ]);
      prisma.task.update.mockResolvedValue(workspaceTask);

      await service.evaluate(
        'task-1',
        AutomationTriggerType.TASK_CREATED,
        undefined,
        { id: 'task-1' },
      );

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          actorTier: ActorTier.CLAUDE_SONNET,
          status: TaskStatus.READY,
        },
      });
    });
  });
});
