import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import {
  AutomationTriggerType,
  AutomationActionType,
  TaskStatus,
  NotificationType,
  ActorTier,
  TaskPriority,
} from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateAutomationActionDto {
  @IsEnum(AutomationActionType)
  actionType: AutomationActionType;

  @IsObject()
  actionConfig: Record<string, any>;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateAutomationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsEnum(AutomationTriggerType)
  triggerType: AutomationTriggerType;

  @IsObject()
  triggerConfig: Record<string, any>;

  @IsArray()
  actions: CreateAutomationActionDto[];
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class AutomationService {
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
    private notificationService: NotificationService,
  ) {}

  async findAll(workspaceId: string, projectId?: string) {
    const automations = await this.prisma.automation.findMany({
      where: {
        workspaceId,
        ...(projectId && { projectId }),
      },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return automations;
  }

  async findOne(id: string, workspaceId: string) {
    const automation = await this.prisma.automation.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    return automation;
  }

  async create(workspaceId: string, dto: CreateAutomationDto) {
    return await this.prisma.$transaction(async (tx) => {
      const automation = await tx.automation.create({
        data: {
          workspaceId,
          name: dto.name,
          projectId: dto.projectId,
          triggerType: dto.triggerType,
          triggerConfig: dto.triggerConfig,
        },
      });

      if (dto.actions && dto.actions.length > 0) {
        await tx.automationAction.createMany({
          data: dto.actions.map((action, index) => ({
            automationId: automation.id,
            actionType: action.actionType,
            actionConfig: action.actionConfig,
            sortOrder: action.sortOrder ?? index,
          })),
        });
      }

      return await tx.automation.findUnique({
        where: { id: automation.id },
        include: {
          actions: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateAutomationDto) {
    // Verify automation exists and belongs to workspace
    await this.findOne(id, workspaceId);

    return await this.prisma.$transaction(async (tx) => {
      // Update automation fields
      const updateData: any = {};
      if (dto.name) updateData.name = dto.name;
      if (dto.projectId !== undefined) updateData.projectId = dto.projectId;
      if (dto.triggerType) updateData.triggerType = dto.triggerType;
      if (dto.triggerConfig) updateData.triggerConfig = dto.triggerConfig;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      await tx.automation.update({
        where: { id },
        data: updateData,
      });

      // Replace actions if provided
      if (dto.actions) {
        await tx.automationAction.deleteMany({
          where: { automationId: id },
        });

        if (dto.actions.length > 0) {
          await tx.automationAction.createMany({
            data: dto.actions.map((action, index) => ({
              automationId: id,
              actionType: action.actionType,
              actionConfig: action.actionConfig,
              sortOrder: action.sortOrder ?? index,
            })),
          });
        }
      }

      return await tx.automation.findUnique({
        where: { id },
        include: {
          actions: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return await this.prisma.automation.delete({
      where: { id },
    });
  }

  async toggleActive(id: string, workspaceId: string) {
    const automation = await this.findOne(id, workspaceId);

    return await this.prisma.automation.update({
      where: { id },
      data: { isActive: !automation.isActive },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async evaluate(
    taskId: string,
    triggerType: AutomationTriggerType,
    oldTask?: any,
    newTask?: any,
  ) {
    const task = newTask || oldTask;
    if (!task) return { matchedAutomations: [] };

    // Get the workspace from the task
    const fullTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: true,
        project: {
          include: {
            workspaceLinks: { orderBy: { joinedAt: 'asc' }, take: 1 },
          },
        },
      },
    });

    if (!fullTask) {
      return { matchedAutomations: [] };
    }

    const workspaceId =
      fullTask.workspaceId ||
      fullTask.project?.workspaceLinks?.[0]?.workspaceId;
    if (!workspaceId) {
      return { matchedAutomations: [] };
    }

    // Find all active automations for this workspace with matching trigger
    const automations = await this.prisma.automation.findMany({
      where: {
        workspaceId,
        triggerType,
        isActive: true,
      },
      include: {
        actions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const matchedAutomations: any[] = [];

    for (const automation of automations) {
      if (
        automation.projectId &&
        automation.projectId !== fullTask.projectId
      ) {
        continue;
      }

      // Check if trigger config matches current task state
      const matches = this.evaluateTriggerConfig(
        automation.triggerConfig as Record<string, any>,
        triggerType,
        oldTask,
        newTask,
      );

      if (matches) {
        matchedAutomations.push({
          automationId: automation.id,
          automationName: automation.name,
          triggerType: automation.triggerType,
          actions: automation.actions.map((action) => ({
            actionType: action.actionType,
            actionConfig: action.actionConfig,
            status: 'pending',
          })),
        });

        for (const action of automation.actions) {
          await this.executeAction(action, fullTask);
        }
      }
    }

    return { matchedAutomations };
  }

  private evaluateTriggerConfig(
    config: Record<string, any>,
    triggerType: AutomationTriggerType,
    oldTask?: any,
    newTask?: any,
  ): boolean {
    switch (triggerType) {
      case AutomationTriggerType.TASK_STATUS_CHANGED:
        if (!oldTask || !newTask) return false;
        if (oldTask.status === newTask.status) return false;
        if (
          config.fromStatus != null &&
          String(oldTask.status) !== String(config.fromStatus)
        ) {
          return false;
        }
        if (
          config.toStatus != null &&
          String(newTask.status) !== String(config.toStatus)
        ) {
          return false;
        }
        return true;

      case AutomationTriggerType.TASK_CREATED:
        return true;

      case AutomationTriggerType.TASK_COMPLETED:
        if (!newTask) return false;
        return newTask.status === TaskStatus.DONE;

      case AutomationTriggerType.TASK_OVERDUE:
        if (!newTask) return false;
        if (!newTask.dueDate) return false;
        return (
          new Date(newTask.dueDate) < new Date() &&
          newTask.status !== TaskStatus.DONE
        );

      case AutomationTriggerType.ASSIGNEE_CHANGED:
        if (!oldTask || !newTask) return false;
        return (
          this.assigneeSignature(oldTask) !== this.assigneeSignature(newTask)
        );

      case AutomationTriggerType.SECTION_CHANGED:
        if (!oldTask || !newTask) return false;
        return oldTask.sectionId !== newTask.sectionId;

      case AutomationTriggerType.AGENT_COMPLETED:
        if (!newTask) return false;
        return !!(
          newTask.agentCompletedAt &&
          (!oldTask?.agentCompletedAt ||
            new Date(newTask.agentCompletedAt) >
              new Date(oldTask.agentCompletedAt))
        );

      case AutomationTriggerType.TASK_DUE_DATE_APPROACHING:
      case AutomationTriggerType.CUSTOM_FIELD_CHANGED:
        return false;

      default:
        return false;
    }
  }

  private assigneeSignature(task: any): string {
    const ids = (task.assignees || [])
      .map((a: any) => (typeof a === 'string' ? a : a.userId))
      .filter(Boolean)
      .sort();
    return ids.join(',');
  }

  private async emitTaskUpdated(taskId: string) {
    const t = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { include: { user: true } },
        tags: { include: { tag: true } },
        subtasks: true,
        createdBy: true,
      },
    });
    if (!t || t.deletedAt) return;
    const payload = {
      task: {
        id: t.id,
        title: t.title,
        status: t.status,
        projectId: t.projectId,
        sectionId: t.sectionId,
        workspaceId: t.workspaceId,
      },
      action: 'updated' as const,
    };
    if (t.projectId) {
      const links = await this.prisma.projectWorkspace.findMany({
        where: { projectId: t.projectId },
        select: { workspaceId: true },
      });
      for (const l of links) {
        this.gateway.emitToWorkspace(l.workspaceId, 'task:updated', payload);
      }
    } else if (t.workspaceId) {
      this.gateway.emitToWorkspace(t.workspaceId, 'task:updated', payload);
    }
  }

  private async executeAction(action: any, task: any) {
    const cfg = action.actionConfig as Record<string, any>;

    switch (action.actionType) {
      case AutomationActionType.CHANGE_STATUS: {
        const target = cfg.targetStatus as TaskStatus;
        if (!target) break;
        await this.prisma.task.update({
          where: { id: task.id },
          data: { status: target },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.ASSIGN_TO: {
        const userId = cfg.userId as string;
        if (!userId) break;
        await this.prisma.taskAssignee.upsert({
          where: { taskId_userId: { taskId: task.id, userId } },
          create: { taskId: task.id, userId },
          update: {},
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.MOVE_TO_SECTION: {
        const sectionId = cfg.sectionId as string | null;
        if (sectionId === undefined) break;
        await this.prisma.task.update({
          where: { id: task.id },
          data: { sectionId: sectionId || null },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.ADD_TAG: {
        const tagId = cfg.tagId as string;
        if (!tagId) break;
        await this.prisma.taskTag
          .create({
            data: { taskId: task.id, tagId },
          })
          .catch(() => undefined);
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.REMOVE_TAG: {
        const tagId = cfg.tagId as string;
        if (!tagId) break;
        await this.prisma.taskTag.deleteMany({
          where: { taskId: task.id, tagId },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.NOTIFY_USER: {
        const userId = cfg.userId as string;
        if (!userId) break;
        await this.notificationService.create(
          userId,
          null,
          NotificationType.RULE_TRIGGERED,
          cfg.title || 'Automation',
          cfg.body || `Task: ${task.title}`,
          task.id,
          'task',
        );
        break;
      }

      case AutomationActionType.SET_PRIORITY: {
        const priority = cfg.priority as TaskPriority;
        if (!priority) break;
        await this.prisma.task.update({
          where: { id: task.id },
          data: { priority },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.SET_DUE_DATE: {
        const due = cfg.dueDate as string | Date | null;
        if (due === undefined) break;
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            dueDate: due ? new Date(due) : null,
          },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.TRIGGER_AGENT: {
        const tier = cfg.actorTier as ActorTier;
        if (!tier) break;
        await this.prisma.task.update({
          where: { id: task.id },
          data: { actorTier: tier, status: TaskStatus.READY },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.CREATE_SUBTASK: {
        const title = (cfg.title as string) || 'Subtask';
        await this.prisma.task.create({
          data: {
            parentTaskId: task.id,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            sectionId: task.sectionId,
            createdById: task.createdById,
            title,
            status: TaskStatus.BACKLOG,
          },
        });
        await this.emitTaskUpdated(task.id);
        break;
      }

      case AutomationActionType.POST_WEBHOOK: {
        const url = (cfg.url as string)?.trim();
        if (!url) break;
        const headers =
          (cfg.headers as Record<string, string> | undefined) || {};
        const safeHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(headers)) {
          if (typeof k === 'string' && typeof v === 'string') {
            safeHeaders[k] = v;
          }
        }
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 10_000);
        try {
          await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...safeHeaders,
            },
            body: JSON.stringify({
              source: 'vineroot-automation',
              task: this.automationWebhookTaskPayload(task),
            }),
            signal: ac.signal,
          });
        } catch {
          /* fire-and-forget */
        } finally {
          clearTimeout(timer);
        }
        break;
      }

      case AutomationActionType.SLACK_NOTIFY: {
        let hookUrl = (cfg.webhookUrl as string | undefined)?.trim();
        const workspaceId =
          task.workspaceId ||
          task.project?.workspaceLinks?.[0]?.workspaceId;
        if (!hookUrl && workspaceId) {
          const ws = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { slackIncomingWebhookUrl: true },
          });
          hookUrl = ws?.slackIncomingWebhookUrl?.trim() || undefined;
        }
        if (!hookUrl) break;
        const base = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
        const taskPath = task.projectId
          ? `/projects/${task.projectId}`
          : '/my-tasks';
        const link = base ? `${base}${taskPath}` : taskPath;
        const rawText =
          (cfg.text as string) || '*{title}* — automation ran in Vineroot.';
        const text = rawText
          .replace(/\{title\}/g, task.title || 'Task')
          .replace(/\{link\}/g, link);
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 10_000);
        try {
          await fetch(hookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: ac.signal,
          });
        } catch {
          /* fire-and-forget */
        } finally {
          clearTimeout(timer);
        }
        break;
      }

      default:
        break;
    }
  }

  private automationWebhookTaskPayload(task: any) {
    const ids = (task.assignees || [])
      .map((a: any) => (typeof a === 'string' ? a : a.userId))
      .filter(Boolean);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      projectId: task.projectId,
      sectionId: task.sectionId,
      workspaceId: task.workspaceId,
      dueDate: task.dueDate,
      assigneeUserIds: ids,
    };
  }
}
