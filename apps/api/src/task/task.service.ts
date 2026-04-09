import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActorTier,
  AuditEventType,
  AutomationTriggerType,
  CustomFieldComputedKind,
  DependencyType,
  KanbanWipEnforcement,
  Prisma,
  ReviewGate,
  ScheduleLinkType,
  TaskComplexity,
  TaskDomain,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { computeNextRecurrenceWindow, parseRecurrenceRule } from './task-recurrence.util';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { AutomationService } from '../automation/automation.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import {
  TaskDto,
  TaskScheduleSegmentDto,
  CreateTaskRequest,
  UpdateTaskRequest,
  ReorderTasksRequest,
  AddTaskDependencyRequest,
  UpdateTaskDependencyLagRequest,
  UpdateTaskDependencyScheduleRequest,
  CreateTaskAttachmentRequest,
  DuplicateTaskRequest,
  CustomFieldType,
  AddTaskGenericResourceAssignmentRequest,
  PatchTaskGenericResourceAssignmentRequest,
  AddTaskAssigneeRequest,
  PatchTaskAssigneeRequest,
  CreateTaskCostEntryRequest,
  TaskCostEntryDto,
  UpdateTaskCostEntryRequest,
  TaskWorkContour,
} from '@vineroot/shared-types';
import { AttachmentService } from '../attachment/attachment.service';
import { isCustomFieldValueEmpty } from '../custom-field/custom-field-value.validation';
import { CustomFieldRollupService } from '../custom-field/custom-field-rollup.service';
import { refreshPmSnapshotsForProjectTask } from '../project/project-pm-snapshots.util';
import { OutboundWebhookService } from '../outbound-webhook/outbound-webhook.service';
import { GoalMetricComputeService } from '../goal/goal-metric-compute.service';

const LAG_DAYS_MIN = -10_000;
const LAG_DAYS_MAX = 10_000;
const ASSIGNMENT_UNITS_MAX = 10_000;

function parseScheduleLinkType(raw: unknown): ScheduleLinkType {
  if (raw === undefined || raw === null) return ScheduleLinkType.FS;
  const s = String(raw);
  if (s === 'FS' || s === 'SS' || s === 'FF' || s === 'SF') {
    return s as ScheduleLinkType;
  }
  throw new BadRequestException('linkType must be FS, SS, FF, or SF');
}

function normalizeLagDays(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new BadRequestException('lagDays must be a whole number');
  }
  if (n < LAG_DAYS_MIN || n > LAG_DAYS_MAX) {
    throw new BadRequestException(`lagDays must be between ${LAG_DAYS_MIN} and ${LAG_DAYS_MAX}`);
  }
  return n;
}

/** Nested subtasks up to 4 levels for task detail (each level loads custom fields). */
function subtaskDetailInclude(depth: number): Record<string, unknown> {
  const include: Record<string, unknown> = {
    customFieldValues: { include: { field: true } },
    sprint: { select: { id: true, name: true } },
  };
  if (depth > 1) {
    include.subtasks = subtaskDetailInclude(depth - 1);
  }
  return {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include,
  };
}

const SUBTASK_DETAIL_INCLUDE = subtaskDetailInclude(4);

async function resolveTaskPrimaryWorkspaceId(
  prisma: PrismaService,
  task: { workspaceId: string | null; projectId: string | null },
): Promise<string | null> {
  if (task.workspaceId) return task.workspaceId;
  if (!task.projectId) return null;
  const link = await prisma.projectWorkspace.findFirst({
    where: { projectId: task.projectId },
    orderBy: { joinedAt: 'asc' },
  });
  return link?.workspaceId ?? null;
}

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private automationService: AutomationService,
    private taskActivityLog: TaskActivityLogService,
    private attachmentService: AttachmentService,
    private outboundWebhookService: OutboundWebhookService,
    private goalMetricCompute: GoalMetricComputeService,
    private customFieldRollupService: CustomFieldRollupService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    req: CreateTaskRequest,
  ): Promise<TaskDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        workspaceLinks: {
          orderBy: { joinedAt: 'asc' },
          select: { workspaceId: true },
        },
      },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const primaryWs = project.workspaceLinks[0]?.workspaceId;
    if (!primaryWs) {
      throw new BadRequestException(
        'Project is not linked to a workspace; cannot create a task',
      );
    }

    const rule = req.recurrenceRule?.trim();
    if (rule) {
      parseRecurrenceRule(rule);
    }

    if (req.sprintId) {
      const sp = await this.prisma.sprint.findFirst({
        where: { id: req.sprintId, projectId },
      });
      if (!sp) {
        throw new BadRequestException('Sprint not found in this project');
      }
    }

    if (req.backlogRank != null) {
      if (req.sprintId) {
        throw new BadRequestException('backlogRank applies only when no sprint is set');
      }
      if (!Number.isInteger(req.backlogRank)) {
        throw new BadRequestException('backlogRank must be an integer');
      }
    }

    if (!req.parentTaskId && req.sectionId) {
      await this.assertNewRootFitsKanbanWip(projectId, req.sectionId);
    }

    const itemType = req.workItemType ?? 'TASK';
    if (req.epicTaskId != null) {
      if (itemType === 'EPIC') {
        throw new BadRequestException('EPIC tasks cannot link to another epic');
      }
      const epic = await this.prisma.task.findFirst({
        where: { id: req.epicTaskId, projectId, deletedAt: null },
        select: { workItemType: true },
      });
      if (!epic || epic.workItemType !== 'EPIC') {
        throw new BadRequestException(
          'Epic link must point to an EPIC task in this project',
        );
      }
    }

    const task = await this.prisma.task.create({
      data: {
        projectId,
        workspaceId: primaryWs,
        sectionId: req.sectionId,
        createdById: userId,
        title: req.title,
        description: req.description,
        priority: req.priority,
        startDate: req.startDate,
        dueDate: req.dueDate,
        recurrenceRule: rule || undefined,
        recurrenceUntil: req.recurrenceUntil,
        isTemplate: req.isTemplate ?? false,
        workItemType: itemType,
        storyPoints:
          req.storyPoints === undefined || req.storyPoints === null
            ? undefined
            : req.storyPoints,
        sprintId: req.sprintId ?? undefined,
        epicTaskId:
          req.epicTaskId && itemType !== 'EPIC' ? req.epicTaskId : undefined,
        backlogRank:
          !req.sprintId && req.backlogRank != null ? req.backlogRank : undefined,
        assignees: req.assigneeIds
          ? {
              create: req.assigneeIds.map((uid) => ({
                userId: uid,
              })),
            }
          : undefined,
        tags: req.tagIds
          ? {
              create: req.tagIds.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
        parentTaskId: req.parentTaskId,
        actorTier: req.actorTier,
        domain: req.domain,
        complexity: req.complexity,
        reviewGate: req.reviewGate,
        phase: req.phase,
        parallelGroup: req.parallelGroup,
        agentContext: req.agentContext === undefined ? undefined : (req.agentContext as object),
        isMilestone: req.isMilestone ?? false,
        isManuallyScheduled:
          req.isManuallyScheduled !== undefined
            ? req.isManuallyScheduled
            : project.defaultManualSchedule,
        constraintType: req.constraintType,
        constraintDate: req.constraintDate ?? undefined,
        deadlineDate: req.deadlineDate ?? undefined,
        durationWorkingMinutes: req.durationWorkingMinutes ?? undefined,
        workMinutes: req.workMinutes ?? undefined,
        scheduleMode: req.scheduleMode,
        ...(req.effortDriven !== undefined
          ? { effortDriven: req.effortDriven }
          : {}),
        ...(req.isSummaryRollup !== undefined
          ? { isSummaryRollup: req.isSummaryRollup }
          : {}),
        ...(req.levelingPriority !== undefined
          ? {
              levelingPriority: this.normalizeLevelingPriority(req.levelingPriority),
            }
          : {}),
        ...(req.levelingCanSplit !== undefined
          ? { levelingCanSplit: Boolean(req.levelingCanSplit) }
          : {}),
        ...(await this.resolveTaskWorkCalendarCreateData(
          project,
          req.workCalendarId,
        )),
        percentComplete: req.percentComplete,
        fixedCost: req.fixedCost ?? undefined,
        actualCost:
          req.actualCost === undefined
            ? undefined
            : req.actualCost === null
              ? null
              : new Prisma.Decimal(req.actualCost),
        ...(req.overtimeWorkMinutes != null
          ? { overtimeWorkMinutes: req.overtimeWorkMinutes }
          : {}),
        ...(req.isBudgetTask !== undefined
          ? { isBudgetTask: Boolean(req.isBudgetTask) }
          : {}),
        ...(req.scheduleSegments !== undefined && req.scheduleSegments !== null
          ? {
              scheduleSegments: this.normalizeScheduleSegmentsInput(
                req.scheduleSegments,
              ) as Prisma.InputJsonValue,
            }
          : {}),
        ...(req.workContour !== undefined
          ? { workContour: this.normalizeWorkContour(req.workContour) }
          : {}),
      },
      include: {
        assignees: { include: { user: true } },
        tags: { include: { tag: true } },
        subtasks: true,
        createdBy: true,
        sprint: { select: { id: true, name: true } },
      },
    });

    await refreshPmSnapshotsForProjectTask(this.prisma, {
      projectId,
      sprintIds: [task.sprintId],
    });

    const dto = this.taskToDto(task);
    for (const link of project.workspaceLinks) {
      this.eventsGateway.emitToWorkspace(link.workspaceId, 'task:created', {
        task: dto,
        action: 'created',
      });
    }
    this.scheduleGoalMetricRecompute(
      project.workspaceLinks.map((l) => l.workspaceId),
    );

    await this.automationService.evaluate(
      task.id,
      AutomationTriggerType.TASK_CREATED,
      undefined,
      this.automationTaskSnapshot(task),
    );
    await this.emitOutboundWebhook(
      { projectId: task.projectId, workspaceId: task.workspaceId },
      AutomationTriggerType.TASK_CREATED,
      task,
    );

    await this.taskActivityLog.log({
      actorId: userId,
      taskId: task.id,
      projectId,
      eventType: AuditEventType.TASK_CREATED,
      description: req.parentTaskId
        ? `Subtask created: "${task.title}"`
        : `Task created: "${task.title}"`,
      newValue: { title: task.title, parentTaskId: req.parentTaskId ?? null },
    });

    if (req.parentTaskId) {
      await this.taskActivityLog.log({
        actorId: userId,
        taskId: req.parentTaskId,
        projectId,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Subtask created: "${task.title}"`,
        newValue: { subtaskId: task.id },
      });
    }

    return dto;
  }

  /**
   * Create from POST /tasks: either in a project (projectId on body) or personal (workspace-only, no project).
   */
  async createWithOptionalProject(
    userId: string,
    workspaceId: string | undefined,
    req: CreateTaskRequest,
  ): Promise<TaskDto> {
    const { projectId, ...rest } = req;
    if (projectId) {
      return this.create(projectId, userId, rest);
    }
    return this.createPersonalInWorkspace(userId, workspaceId, rest);
  }

  private async createPersonalInWorkspace(
    userId: string,
    workspaceId: string | undefined,
    req: CreateTaskRequest,
  ): Promise<TaskDto> {
    if (!workspaceId) {
      throw new BadRequestException(
        'Workspace context is required to create a task without a project',
      );
    }
    if (req.sprintId) {
      throw new BadRequestException('Sprint can only be assigned to project tasks');
    }
    if (req.workCalendarId != null) {
      throw new BadRequestException(
        'workCalendarId can only be set when creating a project task',
      );
    }

    let assigneeIds: string[];
    if (req.assigneeIds === undefined) {
      assigneeIds = [userId];
    } else {
      assigneeIds = [...new Set(req.assigneeIds)];
    }

    const rule = req.recurrenceRule?.trim();
    if (rule) {
      parseRecurrenceRule(rule);
    }

    const task = await this.prisma.task.create({
      data: {
        workspaceId,
        projectId: null,
        sectionId: null,
        createdById: userId,
        title: req.title,
        description: req.description,
        priority: req.priority,
        startDate: req.startDate,
        dueDate: req.dueDate,
        recurrenceRule: rule || undefined,
        recurrenceUntil: req.recurrenceUntil,
        isTemplate: req.isTemplate ?? false,
        assignees:
          assigneeIds.length > 0
            ? {
                create: assigneeIds.map((uid) => ({ userId: uid })),
              }
            : undefined,
        tags: req.tagIds
          ? {
              create: req.tagIds.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
        parentTaskId: req.parentTaskId,
        actorTier: req.actorTier,
        domain: req.domain,
        complexity: req.complexity,
        reviewGate: req.reviewGate,
        phase: req.phase,
        parallelGroup: req.parallelGroup,
        agentContext: req.agentContext === undefined ? undefined : (req.agentContext as object),
        workItemType: req.workItemType ?? 'TASK',
        storyPoints:
          req.storyPoints === undefined || req.storyPoints === null
            ? undefined
            : req.storyPoints,
      },
      include: {
        assignees: { include: { user: true } },
        tags: { include: { tag: true } },
        subtasks: true,
        createdBy: true,
        sprint: { select: { id: true, name: true } },
      },
    });

    this.eventsGateway.emitToWorkspace(workspaceId, 'task:created', {
      task: this.taskToDto(task),
      action: 'created',
    });
    this.scheduleGoalMetricRecompute([workspaceId]);

    await this.automationService.evaluate(
      task.id,
      AutomationTriggerType.TASK_CREATED,
      undefined,
      this.automationTaskSnapshot(task),
    );
    await this.emitOutboundWebhook(
      { projectId: task.projectId, workspaceId: task.workspaceId },
      AutomationTriggerType.TASK_CREATED,
      task,
    );

    await this.taskActivityLog.log({
      actorId: userId,
      taskId: task.id,
      projectId: null,
      eventType: AuditEventType.TASK_CREATED,
      description: req.parentTaskId
        ? `Subtask created: "${task.title}"`
        : `Task created: "${task.title}"`,
      newValue: { title: task.title, parentTaskId: req.parentTaskId ?? null },
    });

    return this.taskToDto(task);
  }

  async listByProject(
    projectId: string,
    filters?: { status?: string; assigneeId?: string },
  ): Promise<TaskDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        isTemplate: false,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.assigneeId && {
          assignees: {
            some: { userId: filters.assigneeId },
          },
        }),
        deletedAt: null,
      },
      include: {
        assignees: { include: { user: true } },
        genericResourceAssignments: { include: { genericResource: true } },
        tags: { include: { tag: true } },
        subtasks: true,
        createdBy: true,
        sprint: { select: { id: true, name: true } },
        dependencies: { include: { blockingTask: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const wbsRows = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, isTemplate: false },
      select: { id: true, parentTaskId: true, sortOrder: true },
    });
    const wbsMap = this.computeWbsOutlineMap(
      Array.isArray(wbsRows) ? wbsRows : [],
    );
    return tasks.map((t) => this.taskToDto(t, wbsMap));
  }

  private async assertProjectAndTask(
    projectId: string,
    taskId: string,
    userId: string,
  ): Promise<void> {
    const p = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [{ createdById: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Project not found');
    const t = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!t) throw new NotFoundException('Task not found');
  }

  async listTaskCostEntries(
    projectId: string,
    taskId: string,
    actorId: string,
  ): Promise<TaskCostEntryDto[]> {
    await this.assertProjectAndTask(projectId, taskId, actorId);
    const rows = await this.prisma.taskCostEntry.findMany({
      where: { taskId },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      amount: Number(r.amount),
      description: r.description,
      entryDate: r.entryDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      createdById: r.createdById,
    }));
  }

  async createTaskCostEntry(
    projectId: string,
    taskId: string,
    actorId: string,
    body: CreateTaskCostEntryRequest,
  ): Promise<TaskCostEntryDto> {
    await this.assertProjectAndTask(projectId, taskId, actorId);
    const amt = Number(body.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      throw new BadRequestException('amount must be a non-negative number');
    }
    const entryDate =
      body.entryDate != null && String(body.entryDate).trim() !== ''
        ? new Date(body.entryDate as string)
        : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      throw new BadRequestException('entryDate must be a valid date');
    }
    const row = await this.prisma.taskCostEntry.create({
      data: {
        taskId,
        amount: new Prisma.Decimal(amt),
        description:
          body.description != null && String(body.description).trim() !== ''
            ? String(body.description).trim()
            : null,
        entryDate,
        createdById: actorId,
      },
    });
    return {
      id: row.id,
      taskId: row.taskId,
      amount: Number(row.amount),
      description: row.description,
      entryDate: row.entryDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      createdById: row.createdById,
    };
  }

  async patchTaskCostEntry(
    projectId: string,
    taskId: string,
    entryId: string,
    actorId: string,
    body: UpdateTaskCostEntryRequest,
  ): Promise<TaskCostEntryDto> {
    await this.assertProjectAndTask(projectId, taskId, actorId);
    const prev = await this.prisma.taskCostEntry.findFirst({
      where: { id: entryId, taskId },
    });
    if (!prev) throw new NotFoundException('Cost entry not found');
    if (
      body.amount === undefined &&
      body.description === undefined &&
      body.entryDate === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one of amount, description, entryDate',
      );
    }
    const data: Prisma.TaskCostEntryUpdateInput = {};
    if (body.amount !== undefined) {
      const amt = Number(body.amount);
      if (!Number.isFinite(amt) || amt < 0) {
        throw new BadRequestException('amount must be a non-negative number');
      }
      data.amount = new Prisma.Decimal(amt);
    }
    if (body.description !== undefined) {
      data.description =
        body.description === null || String(body.description).trim() === ''
          ? null
          : String(body.description).trim();
    }
    if (body.entryDate !== undefined) {
      const raw = String(body.entryDate).trim();
      if (raw === '') {
        throw new BadRequestException('entryDate cannot be empty');
      }
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('entryDate must be a valid date');
      }
      data.entryDate = d;
    }
    const row = await this.prisma.taskCostEntry.update({
      where: { id: entryId },
      data,
    });
    return {
      id: row.id,
      taskId: row.taskId,
      amount: Number(row.amount),
      description: row.description,
      entryDate: row.entryDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      createdById: row.createdById,
    };
  }

  async deleteTaskCostEntry(
    projectId: string,
    taskId: string,
    entryId: string,
    actorId: string,
  ): Promise<void> {
    await this.assertProjectAndTask(projectId, taskId, actorId);
    const res = await this.prisma.taskCostEntry.deleteMany({
      where: { id: entryId, taskId },
    });
    if (res.count === 0) throw new NotFoundException('Cost entry not found');
  }

  async listMyTasks(userId: string): Promise<TaskDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        assignees: {
          some: { userId },
        },
        isTemplate: false,
        deletedAt: null,
      },
      include: {
        assignees: { include: { user: true } },
        tags: { include: { tag: true } },
        subtasks: true,
        createdBy: true,
        sprint: { select: { id: true, name: true } },
      },
    });

    return tasks.map((t) => this.taskToDto(t));
  }

  async findById(id: string): Promise<TaskDto | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignees: { include: { user: true } },
        genericResourceAssignments: { include: { genericResource: true } },
        tags: { include: { tag: true } },
        subtasks: SUBTASK_DETAIL_INCLUDE,
        createdBy: true,
        sprint: { select: { id: true, name: true } },
        dependencies: { include: { blockingTask: true } },
        blockedBy: { include: { dependentTask: true } },
        attachments: { orderBy: { createdAt: 'desc' } },
        customFieldValues: { include: { field: true } },
        activityLogs: {
          include: { actor: true },
          orderBy: { createdAt: 'desc' },
          take: 120,
        },
      },
    });

    if (!task || task.deletedAt) return null;
    if (task.projectId) {
      await this.customFieldRollupService.mergeRollupsForTaskDetailTree(task);
    }
    let wbsMap: Map<string, string> | undefined;
    if (task.projectId) {
      const wbsRows = await this.prisma.task.findMany({
        where: {
          projectId: task.projectId,
          deletedAt: null,
          isTemplate: false,
        },
        select: { id: true, parentTaskId: true, sortOrder: true },
      });
      wbsMap = this.computeWbsOutlineMap(
        Array.isArray(wbsRows) ? wbsRows : [],
      );
    }
    return this.taskToDto(task, wbsMap);
  }

  private async assertTasksAllowDependency(
    dependent: { projectId: string | null },
    blocking: { projectId: string | null },
  ): Promise<void> {
    if (!dependent.projectId || !blocking.projectId) {
      throw new BadRequestException(
        'Dependencies require both tasks to belong to a project',
      );
    }
    if (dependent.projectId === blocking.projectId) return;
    const rows = await this.prisma.scheduleProgramProject.findMany({
      where: {
        projectId: { in: [dependent.projectId, blocking.projectId] },
      },
    });
    const byProg = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!byProg.has(r.programId)) byProg.set(r.programId, new Set());
      byProg.get(r.programId)!.add(r.projectId);
    }
    for (const set of byProg.values()) {
      if (
        set.has(dependent.projectId) &&
        set.has(blocking.projectId)
      ) {
        return;
      }
    }
    throw new BadRequestException(
      'Dependencies must be same project or both projects in one schedule program',
    );
  }

  async addDependency(
    userId: string,
    dependentId: string,
    body: AddTaskDependencyRequest,
  ): Promise<TaskDto> {
    const blockingId = body.blockingTaskId;
    if (dependentId === blockingId) {
      throw new BadRequestException('A task cannot depend on itself');
    }
    const [dependent, blocking] = await Promise.all([
      this.prisma.task.findUnique({ where: { id: dependentId } }),
      this.prisma.task.findUnique({ where: { id: blockingId } }),
    ]);
    if (!dependent || dependent.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    if (!blocking || blocking.deletedAt) {
      throw new NotFoundException('Blocking task not found');
    }
    await this.assertTasksAllowDependency(dependent, blocking);
    const lagDays = normalizeLagDays(body.lagDays);
    const linkType = parseScheduleLinkType(body.linkType);
    try {
      await this.prisma.taskDependency.create({
        data: {
          dependentId,
          blockingId,
          type: body.type ?? DependencyType.WAITING_ON,
          linkType,
          lagDays,
          lagIsElapsed: body.lagIsElapsed === true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('This dependency already exists');
      }
      throw e;
    }
    await this.taskActivityLog.log({
      actorId: userId,
      taskId: dependentId,
      projectId: dependent.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Now waiting on "${blocking.title}"`,
      newValue: { blockingTaskId: blockingId, lagDays, linkType },
    });
    const updated = await this.findById(dependentId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async updateDependencyLag(
    userId: string,
    dependentId: string,
    blockingId: string,
    body: UpdateTaskDependencyLagRequest | UpdateTaskDependencyScheduleRequest,
  ): Promise<TaskDto> {
    const lagDays =
      body.lagDays !== undefined ? normalizeLagDays(body.lagDays) : undefined;
    const sch = body as UpdateTaskDependencyScheduleRequest;
    const linkType =
      sch.linkType !== undefined
        ? parseScheduleLinkType(sch.linkType)
        : undefined;
    const lagIsElapsed = sch.lagIsElapsed;
    if (
      lagDays === undefined &&
      linkType === undefined &&
      lagIsElapsed === undefined
    ) {
      throw new BadRequestException(
        'Provide lagDays, linkType, and/or lagIsElapsed',
      );
    }
    const dependent = await this.prisma.task.findUnique({ where: { id: dependentId } });
    if (!dependent || dependent.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    try {
      await this.prisma.taskDependency.update({
        where: { dependentId_blockingId: { dependentId, blockingId } },
        data: {
          ...(lagDays !== undefined && { lagDays }),
          ...(linkType !== undefined && { linkType }),
          ...(lagIsElapsed !== undefined && { lagIsElapsed }),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('Dependency not found');
      }
      throw e;
    }
    await this.taskActivityLog.log({
      actorId: userId,
      taskId: dependentId,
      projectId: dependent.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description:
        lagDays !== undefined && linkType !== undefined
          ? `Dependency lag/link updated`
          : lagDays !== undefined
            ? `Dependency lag set to ${lagDays} day(s)`
            : `Dependency link type updated`,
      newValue: { blockingTaskId: blockingId, lagDays, linkType },
    });
    const updated = await this.findById(dependentId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async removeDependency(
    userId: string,
    dependentId: string,
    blockingId: string,
  ): Promise<TaskDto> {
    const dependent = await this.prisma.task.findUnique({ where: { id: dependentId } });
    const blocking = await this.prisma.task.findUnique({ where: { id: blockingId } });
    if (!dependent || dependent.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    try {
      await this.prisma.taskDependency.delete({
        where: { dependentId_blockingId: { dependentId, blockingId } },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('Dependency not found');
      }
      throw e;
    }
    await this.taskActivityLog.log({
      actorId: userId,
      taskId: dependentId,
      projectId: dependent.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: blocking
        ? `Removed dependency on "${blocking.title}"`
        : 'Removed a dependency',
      oldValue: { blockingTaskId: blockingId },
    });
    const updated = await this.findById(dependentId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async addAttachment(
    userId: string,
    taskId: string,
    body: CreateTaskAttachmentRequest,
  ): Promise<TaskDto> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    const storageKey = body.storageKey?.trim() || `link:${randomUUID()}`;
    await this.prisma.attachment.create({
      data: {
        taskId,
        uploadedById: userId,
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        url: body.url,
        storageKey,
      },
    });
    await this.taskActivityLog.log({
      actorId: userId,
      taskId,
      projectId: task.projectId,
      eventType: AuditEventType.ATTACHMENT_ADDED,
      description: `Attached "${body.filename}"`,
      newValue: { url: body.url, filename: body.filename },
    });
    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async deleteAttachment(userId: string, taskId: string, attachmentId: string): Promise<TaskDto> {
    const att = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!att || att.taskId !== taskId) {
      throw new NotFoundException('Attachment not found');
    }
    const taskRow = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    await this.attachmentService.removeLocalStoredFile(att.storageKey);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await this.taskActivityLog.log({
      actorId: userId,
      taskId,
      projectId: taskRow?.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Removed attachment "${att.filename}"`,
      oldValue: { attachmentId, filename: att.filename },
    });
    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  /** Maps API patch body to Prisma update data (assignees use dedicated endpoints). */
  private buildTaskUpdateData(req: UpdateTaskRequest): Prisma.TaskUncheckedUpdateInput {
    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (req.title !== undefined) data.title = req.title;
    if (req.description !== undefined) data.description = req.description;
    if (req.status !== undefined) data.status = req.status;
    if (req.priority !== undefined) data.priority = req.priority;
    if (req.sectionId !== undefined) data.sectionId = req.sectionId;
    if (req.parentTaskId !== undefined) data.parentTaskId = req.parentTaskId;
    if (req.sortOrder !== undefined) data.sortOrder = req.sortOrder;
    if (req.startDate !== undefined) {
      data.startDate =
        req.startDate === null
          ? null
          : req.startDate instanceof Date
            ? req.startDate
            : new Date(req.startDate as string | number);
    }
    if (req.dueDate !== undefined) {
      data.dueDate =
        req.dueDate === null
          ? null
          : req.dueDate instanceof Date
            ? req.dueDate
            : new Date(req.dueDate as string | number);
    }
    if (req.estimatedMin !== undefined) data.estimatedMin = req.estimatedMin;
    if (req.actualMin !== undefined) data.actualMin = req.actualMin;
    if (req.actorTier !== undefined) data.actorTier = req.actorTier;
    if (req.domain !== undefined) data.domain = req.domain;
    if (req.complexity !== undefined) data.complexity = req.complexity;
    if (req.reviewGate !== undefined) data.reviewGate = req.reviewGate;
    if (req.phase !== undefined) data.phase = req.phase;
    if (req.parallelGroup !== undefined) data.parallelGroup = req.parallelGroup;
    if (req.agentContext !== undefined) data.agentContext = req.agentContext as object;
    if (req.agentOutput !== undefined) data.agentOutput = req.agentOutput as object | null;
    if (req.escalationNote !== undefined) data.escalationNote = req.escalationNote;
    if (req.recurrenceRule !== undefined) {
      if (req.recurrenceRule === null || req.recurrenceRule === '') {
        data.recurrenceRule = null;
      } else {
        parseRecurrenceRule(req.recurrenceRule);
        data.recurrenceRule = req.recurrenceRule.trim();
      }
    }
    if (req.recurrenceUntil !== undefined) {
      data.recurrenceUntil =
        req.recurrenceUntil === null
          ? null
          : req.recurrenceUntil instanceof Date
            ? req.recurrenceUntil
            : new Date(req.recurrenceUntil as string | number);
    }
    if (req.isTemplate !== undefined) data.isTemplate = req.isTemplate;
    if (req.workItemType !== undefined) data.workItemType = req.workItemType;
    if (req.storyPoints !== undefined) {
      data.storyPoints =
        req.storyPoints === null || Number.isNaN(req.storyPoints as number)
          ? null
          : req.storyPoints;
    }
    if (req.sprintId !== undefined) {
      data.sprintId = req.sprintId;
    }
    if (req.isMilestone !== undefined) {
      data.isMilestone = req.isMilestone;
    }
    if (req.epicTaskId !== undefined) {
      data.epicTaskId = req.epicTaskId;
    }
    if (req.backlogRank !== undefined) {
      data.backlogRank = req.backlogRank;
    }
    if (req.isManuallyScheduled !== undefined) {
      data.isManuallyScheduled = req.isManuallyScheduled;
    }
    if (req.constraintType !== undefined) {
      data.constraintType = req.constraintType;
    }
    if (req.constraintDate !== undefined) {
      data.constraintDate =
        req.constraintDate === null
          ? null
          : req.constraintDate instanceof Date
            ? req.constraintDate
            : new Date(req.constraintDate as string | number);
    }
    if (req.deadlineDate !== undefined) {
      data.deadlineDate =
        req.deadlineDate === null
          ? null
          : req.deadlineDate instanceof Date
            ? req.deadlineDate
            : new Date(req.deadlineDate as string | number);
    }
    if (req.durationWorkingMinutes !== undefined) {
      data.durationWorkingMinutes = req.durationWorkingMinutes;
    }
    if (req.workMinutes !== undefined) {
      data.workMinutes = req.workMinutes;
    }
    if (req.scheduleMode !== undefined) {
      data.scheduleMode = req.scheduleMode;
    }
    if (req.effortDriven !== undefined) {
      data.effortDriven = req.effortDriven;
    }
    if (req.isSummaryRollup !== undefined) {
      data.isSummaryRollup = req.isSummaryRollup;
    }
    if (req.percentComplete !== undefined) {
      data.percentComplete = req.percentComplete;
    }
    if (req.fixedCost !== undefined) {
      data.fixedCost = req.fixedCost;
    }
    if (req.actualCost !== undefined) {
      data.actualCost =
        req.actualCost === null ? null : new Prisma.Decimal(req.actualCost);
    }
    if (req.overtimeWorkMinutes !== undefined) {
      if (req.overtimeWorkMinutes === null) {
        data.overtimeWorkMinutes = null;
      } else {
        const n = Math.round(Number(req.overtimeWorkMinutes));
        if (!Number.isFinite(n) || n < 0) {
          throw new BadRequestException(
            'overtimeWorkMinutes must be null or a non-negative integer',
          );
        }
        data.overtimeWorkMinutes = n;
      }
    }
    if (req.isBudgetTask !== undefined) {
      data.isBudgetTask = Boolean(req.isBudgetTask);
    }
    if (req.scheduleSegments !== undefined) {
      data.scheduleSegments =
        req.scheduleSegments === null
          ? Prisma.JsonNull
          : (this.normalizeScheduleSegmentsInput(
              req.scheduleSegments,
            ) as Prisma.InputJsonValue);
    }
    if (req.workContour !== undefined) {
      data.workContour = this.normalizeWorkContour(req.workContour);
    }
    if (req.levelingPriority !== undefined) {
      data.levelingPriority = this.normalizeLevelingPriority(req.levelingPriority);
    }
    if (req.levelingCanSplit !== undefined) {
      data.levelingCanSplit = Boolean(req.levelingCanSplit);
    }
    return data;
  }

  private normalizeLevelingPriority(raw: unknown): number {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      throw new BadRequestException('levelingPriority must be an integer from 0 to 1000');
    }
    return n;
  }

  private readonly workContourValues = new Set<string>(Object.values(TaskWorkContour));

  private normalizeWorkContour(raw: unknown): TaskWorkContour {
    if (typeof raw !== 'string' || !this.workContourValues.has(raw)) {
      throw new BadRequestException('workContour is not a valid TaskWorkContour value');
    }
    return raw as TaskWorkContour;
  }

  private scheduleSegmentsToDto(raw: unknown): TaskScheduleSegmentDto[] | null {
    if (raw == null) return null;
    if (!Array.isArray(raw)) return null;
    const out: TaskScheduleSegmentDto[] = [];
    for (const x of raw) {
      if (x && typeof x === 'object' && 'start' in x && 'end' in x) {
        const o = x as Record<string, unknown>;
        const wm = o.workMinutes;
        out.push({
          start: String(o.start),
          end: String(o.end),
          workMinutes:
            wm != null && Number.isFinite(Number(wm)) ? Number(wm) : null,
        });
      }
    }
    return out.length ? out : null;
  }

  private normalizeScheduleSegmentsInput(
    segs: TaskScheduleSegmentDto[],
  ): Prisma.InputJsonValue {
    if (!Array.isArray(segs)) {
      throw new BadRequestException('scheduleSegments must be an array');
    }
    const out: { start: string; end: string; workMinutes?: number }[] = [];
    for (const s of segs) {
      if (!s || typeof s.start !== 'string' || typeof s.end !== 'string') {
        throw new BadRequestException(
          'Each schedule segment requires string start and end',
        );
      }
      const row: { start: string; end: string; workMinutes?: number } = {
        start: s.start,
        end: s.end,
      };
      if (s.workMinutes != null) {
        const w = Number(s.workMinutes);
        if (!Number.isFinite(w)) {
          throw new BadRequestException('segment workMinutes must be a number');
        }
        row.workMinutes = w;
      }
      out.push(row);
    }
    return out;
  }

  private sameInstant(
    a: Date | null | undefined,
    b: Date | null | undefined,
  ): boolean {
    const ta = a == null ? null : new Date(a).getTime();
    const tb = b == null ? null : new Date(b).getTime();
    return ta === tb;
  }

  private async logHumanVisibleTaskUpdates(
    actorId: string,
    prior: Record<string, any>,
    task: Record<string, any>,
    req: UpdateTaskRequest,
  ): Promise<void> {
    const base = {
      actorId,
      taskId: task.id,
      projectId: task.projectId,
    };

    if (req.title !== undefined && prior.title !== task.title) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Changed title',
        oldValue: prior.title,
        newValue: task.title,
      });
    }
    if (req.description !== undefined && prior.description !== task.description) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Updated description',
        oldValue: prior.description,
        newValue: task.description,
      });
    }
    if (req.status !== undefined && prior.status !== task.status) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.STATUS_CHANGED,
        description: `Status changed to ${task.status}`,
        oldValue: prior.status,
        newValue: task.status,
      });
    }
    if (req.priority !== undefined && prior.priority !== task.priority) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Priority set to ${task.priority}`,
        oldValue: prior.priority,
        newValue: task.priority,
      });
    }
    if (req.sectionId !== undefined && prior.sectionId !== task.sectionId) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Section changed',
        oldValue: prior.sectionId,
        newValue: task.sectionId,
      });
    }
    if (req.startDate !== undefined && !this.sameInstant(prior.startDate, task.startDate)) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Start date changed',
        oldValue: prior.startDate?.toISOString?.() ?? prior.startDate,
        newValue: task.startDate?.toISOString?.() ?? task.startDate,
      });
    }
    if (req.dueDate !== undefined && !this.sameInstant(prior.dueDate, task.dueDate)) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Due date changed',
        oldValue: prior.dueDate?.toISOString?.() ?? prior.dueDate,
        newValue: task.dueDate?.toISOString?.() ?? task.dueDate,
      });
    }
    if (
      req.escalationNote !== undefined &&
      prior.escalationNote !== task.escalationNote
    ) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.ESCALATION,
        description: 'Escalation note updated',
        oldValue: prior.escalationNote,
        newValue: task.escalationNote,
      });
    }
    if (req.parentTaskId !== undefined && prior.parentTaskId !== task.parentTaskId) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Parent task changed (reparented)',
        oldValue: { parentTaskId: prior.parentTaskId },
        newValue: { parentTaskId: task.parentTaskId },
      });
    }
    if (req.recurrenceRule !== undefined) {
      const a = (prior.recurrenceRule as string | null)?.trim() || null;
      const b = (task.recurrenceRule as string | null)?.trim() || null;
      if (a !== b) {
        await this.taskActivityLog.log({
          ...base,
          eventType: AuditEventType.TASK_UPDATED,
          description: b ? 'Recurrence updated' : 'Recurrence removed',
          oldValue: a,
          newValue: b,
        });
      }
    }
    if (req.recurrenceUntil !== undefined && !this.sameInstant(prior.recurrenceUntil, task.recurrenceUntil)) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Recurrence end date changed',
        oldValue: prior.recurrenceUntil?.toISOString?.() ?? prior.recurrenceUntil,
        newValue: task.recurrenceUntil?.toISOString?.() ?? task.recurrenceUntil,
      });
    }
    if (req.isTemplate !== undefined && prior.isTemplate !== task.isTemplate) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: task.isTemplate
          ? 'Marked as task template'
          : 'Unmarked as task template',
        oldValue: prior.isTemplate,
        newValue: task.isTemplate,
      });
    }
    if (req.estimatedMin !== undefined && prior.estimatedMin !== task.estimatedMin) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Estimated time updated',
        oldValue: prior.estimatedMin,
        newValue: task.estimatedMin,
      });
    }
    if (req.actualMin !== undefined && prior.actualMin !== task.actualMin) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Actual time updated',
        oldValue: prior.actualMin,
        newValue: task.actualMin,
      });
    }
    if (req.actorTier !== undefined && prior.actorTier !== task.actorTier) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Actor tier set to ${task.actorTier as ActorTier}`,
        oldValue: prior.actorTier,
        newValue: task.actorTier,
      });
    }
    if (req.domain !== undefined && prior.domain !== task.domain) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Domain set to ${task.domain as TaskDomain}`,
        oldValue: prior.domain,
        newValue: task.domain,
      });
    }
    if (req.complexity !== undefined && prior.complexity !== task.complexity) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Complexity set to ${task.complexity as TaskComplexity}`,
        oldValue: prior.complexity,
        newValue: task.complexity,
      });
    }
    if (req.reviewGate !== undefined && prior.reviewGate !== task.reviewGate) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Review gate set to ${task.reviewGate as ReviewGate}`,
        oldValue: prior.reviewGate,
        newValue: task.reviewGate,
      });
    }
    if (req.phase !== undefined && prior.phase !== task.phase) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Phase updated',
        oldValue: prior.phase,
        newValue: task.phase,
      });
    }
    if (
      req.parallelGroup !== undefined &&
      prior.parallelGroup !== task.parallelGroup
    ) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Parallel group updated',
        oldValue: prior.parallelGroup,
        newValue: task.parallelGroup,
      });
    }
    if (req.workItemType !== undefined && prior.workItemType !== task.workItemType) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: `Work item type set to ${task.workItemType}`,
        oldValue: prior.workItemType,
        newValue: task.workItemType,
      });
    }
    if (
      req.storyPoints !== undefined &&
      (prior.storyPoints ?? null) !== (task.storyPoints ?? null)
    ) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Story points updated',
        oldValue: prior.storyPoints,
        newValue: task.storyPoints,
      });
    }
    if (req.sprintId !== undefined && prior.sprintId !== task.sprintId) {
      await this.taskActivityLog.log({
        ...base,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Sprint assignment changed',
        oldValue: { sprintId: prior.sprintId },
        newValue: { sprintId: task.sprintId },
      });
    }
  }

  async update(id: string, actorId: string, req: UpdateTaskRequest): Promise<TaskDto> {
    const prior = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignees: true,
        tags: true,
        customFieldValues: true,
      },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    if (req.parentTaskId !== undefined) {
      if (req.parentTaskId === prior.id) {
        throw new BadRequestException('Task cannot be its own parent');
      }
      if (
        req.parentTaskId === null &&
        prior.parentTaskId != null &&
        req.sectionId === undefined
      ) {
        throw new BadRequestException(
          'sectionId is required when promoting a task to top level',
        );
      }
      // Single-task PATCH: tree + depth. Batch DnD reparent/promote uses reorderTasks → assertSimTreeValid.
      await this.assertUpdateKeepsValidTaskTree(prior.id, prior.projectId, req);
    }

    if (req.sprintId !== undefined) {
      if (req.sprintId !== null && !prior.projectId) {
        throw new BadRequestException('Sprint can only be set on project tasks');
      }
      if (req.sprintId !== null && prior.projectId) {
        const sp = await this.prisma.sprint.findFirst({
          where: { id: req.sprintId, projectId: prior.projectId },
        });
        if (!sp) {
          throw new BadRequestException('Sprint not found in this project');
        }
      }
    }

    if (req.epicTaskId !== undefined) {
      if (!prior.projectId) {
        throw new BadRequestException('Epic link is only for project tasks');
      }
      if (req.epicTaskId !== null) {
        if (req.epicTaskId === id) {
          throw new BadRequestException('Task cannot be its own epic');
        }
        const epic = await this.prisma.task.findFirst({
          where: {
            id: req.epicTaskId,
            projectId: prior.projectId,
            deletedAt: null,
          },
          select: { workItemType: true },
        });
        if (!epic || epic.workItemType !== 'EPIC') {
          throw new BadRequestException(
            'Epic link must point to an EPIC task in this project',
          );
        }
      }
    }

    if (req.backlogRank !== undefined && req.backlogRank !== null) {
      if (!Number.isInteger(req.backlogRank)) {
        throw new BadRequestException('backlogRank must be an integer or null');
      }
    }

    if (
      req.status === TaskStatus.DONE &&
      prior.status !== TaskStatus.DONE
    ) {
      await this.assertRequiredProjectCustomFieldsForDone(prior.id, prior.projectId);
    }

    const data = this.buildTaskUpdateData(req);
    if (req.workCalendarId !== undefined) {
      if (!prior.projectId) {
        throw new BadRequestException(
          'workCalendarId can only be set on project tasks',
        );
      }
      const wsIds = await this.workspaceIdsForProject(prior.projectId);
      if (req.workCalendarId === null) {
        data.workCalendarId = null;
      } else {
        const cal = await this.prisma.workCalendar.findFirst({
          where: { id: req.workCalendarId, workspaceId: { in: wsIds } },
        });
        if (!cal) {
          throw new BadRequestException(
            'workCalendarId must reference a work calendar in this project workspace',
          );
        }
        data.workCalendarId = cal.id;
      }
    }
    if (req.workItemType === 'EPIC') {
      data.epicTaskId = null;
    }
    const nextSprintId =
      req.sprintId !== undefined ? req.sprintId : prior.sprintId;
    if (nextSprintId != null) {
      data.backlogRank = null;
    }
    if (
      typeof req.parentTaskId === 'string' &&
      req.sectionId === undefined
    ) {
      const par = await this.prisma.task.findUnique({
        where: { id: req.parentTaskId },
        select: { sectionId: true },
      });
      if (par?.sectionId) {
        data.sectionId = par.sectionId;
      }
    }

    if (
      req.status === TaskStatus.DONE &&
      prior.status !== TaskStatus.DONE
    ) {
      data.completedAt = new Date();
    } else if (
      req.status !== undefined &&
      req.status !== TaskStatus.DONE &&
      prior.status === TaskStatus.DONE
    ) {
      data.completedAt = null;
    }

    if (
      prior.projectId &&
      (data.sectionId !== undefined || data.parentTaskId !== undefined)
    ) {
      const all = await this.prisma.task.findMany({
        where: {
          projectId: prior.projectId,
          deletedAt: null,
          isTemplate: false,
        },
        select: { id: true, sectionId: true, parentTaskId: true },
      });
      const sim = new Map(
        all.map((r) => [
          r.id,
          { sectionId: r.sectionId, parentTaskId: r.parentTaskId },
        ]),
      );
      const row = sim.get(id);
      if (row) {
        if (data.sectionId !== undefined) {
          row.sectionId = (data.sectionId as string | null) ?? null;
        }
        if (data.parentTaskId !== undefined) {
          row.parentTaskId = data.parentTaskId as string | null;
        }
      }
      await this.assertKanbanWipForSectionRoots(prior.projectId, sim);
    }

    const updateInclude = {
      assignees: { include: { user: true } },
      genericResourceAssignments: { include: { genericResource: true } },
      tags: { include: { tag: true } },
      subtasks: true,
      createdBy: true,
      sprint: { select: { id: true, name: true } },
    } as const;

    const spawnRecurring =
      req.status === TaskStatus.DONE &&
      prior.status !== TaskStatus.DONE &&
      Boolean(prior.recurrenceRule?.trim()) &&
      !prior.isTemplate;

    let task: any;
    let createdFollowUp: TaskDto | null = null;
    let recurringFollowId: string | null = null;

    if (spawnRecurring) {
      const completion =
        (data.completedAt as Date | undefined) ?? new Date();
      const nextWindow = computeNextRecurrenceWindow({
        rule: prior.recurrenceRule!.trim(),
        dueDate: prior.dueDate,
        startDate: prior.startDate,
        completion,
      });
      const nextRef = nextWindow.dueDate ?? nextWindow.startDate;
      const shouldSpawn =
        nextRef != null &&
        (!prior.recurrenceUntil || nextRef <= prior.recurrenceUntil);

      data.recurrenceRule = null;
      data.recurrenceUntil = null;

      const followSourceRule = prior.recurrenceRule!.trim();
      const followUntil = prior.recurrenceUntil;

      const txResult = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id },
          data: data as Prisma.TaskUncheckedUpdateInput,
          include: updateInclude,
        });

        if (!shouldSpawn) {
          return { updated, followId: null as string | null };
        }

        const aggWhere: Prisma.TaskWhereInput = {
          parentTaskId: prior.parentTaskId,
          deletedAt: null,
        };
        if (prior.projectId) {
          aggWhere.projectId = prior.projectId;
        } else {
          aggWhere.projectId = null;
          if (prior.workspaceId) aggWhere.workspaceId = prior.workspaceId;
        }
        if (prior.sectionId === null) aggWhere.sectionId = null;
        else if (prior.sectionId) aggWhere.sectionId = prior.sectionId;

        const agg = await tx.task.aggregate({
          where: aggWhere,
          _max: { sortOrder: true },
        });
        const sortOrder = (agg._max.sortOrder ?? -1) + 1;

        const follow = await tx.task.create({
          data: {
            projectId: prior.projectId,
            workspaceId: prior.workspaceId,
            sectionId: prior.sectionId,
            parentTaskId: prior.parentTaskId,
            createdById: actorId,
            title: prior.title,
            description: prior.description,
            htmlContent: prior.htmlContent,
            status: TaskStatus.BACKLOG,
            priority: prior.priority,
            startDate: nextWindow.startDate,
            dueDate: nextWindow.dueDate,
            sortOrder,
            actorTier: prior.actorTier,
            domain: prior.domain,
            complexity: prior.complexity,
            reviewGate: prior.reviewGate,
            phase: prior.phase,
            parallelGroup: prior.parallelGroup,
            agentContext:
              prior.agentContext === null || prior.agentContext === undefined
                ? undefined
                : (prior.agentContext as object),
            recurrenceRule: followSourceRule,
            recurrenceUntil: followUntil,
            isTemplate: false,
            workItemType: prior.workItemType ?? 'TASK',
            storyPoints: prior.storyPoints,
            sprintId: prior.sprintId,
            epicTaskId: prior.epicTaskId ?? undefined,
            backlogRank: prior.sprintId ? undefined : prior.backlogRank ?? undefined,
            assignees:
              prior.assignees.length > 0
                ? {
                    create: prior.assignees.map((a) => ({
                      userId: a.userId,
                    })),
                  }
                : undefined,
            tags:
              prior.tags.length > 0
                ? {
                    create: prior.tags.map((t) => ({ tagId: t.tagId })),
                  }
                : undefined,
          },
          include: updateInclude,
        });

        for (const v of prior.customFieldValues) {
          await tx.customFieldValue.create({
            data: {
              taskId: follow.id,
              fieldId: v.fieldId,
              value: v.value as Prisma.InputJsonValue,
            },
          });
        }

        return { updated, followId: follow.id };
      });

      task = txResult.updated;
      if (txResult.followId) {
        recurringFollowId = txResult.followId;
        const full = await this.findById(txResult.followId);
        createdFollowUp = full;
      }
    } else {
      task = await this.prisma.task.update({
        where: { id },
        data,
        include: updateInclude,
      });
    }

    await this.logHumanVisibleTaskUpdates(actorId, prior, task, req);

    if (recurringFollowId) {
      await this.taskActivityLog.log({
        actorId,
        taskId: id,
        projectId: prior.projectId,
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Recurring instance completed; next occurrence created',
        newValue: { nextTaskId: recurringFollowId },
      });
      await this.taskActivityLog.log({
        actorId,
        taskId: recurringFollowId,
        projectId: prior.projectId,
        eventType: AuditEventType.TASK_CREATED,
        description: 'Created as next recurring occurrence',
        newValue: { previousTaskId: id },
      });
    }

    const oldSnap = this.automationTaskSnapshot(prior);
    const newSnap = this.automationTaskSnapshot(task);

    if (prior.status !== task.status) {
      await this.automationService.evaluate(
        id,
        AutomationTriggerType.TASK_STATUS_CHANGED,
        oldSnap,
        newSnap,
      );
      await this.emitOutboundWebhook(
        { projectId: task.projectId, workspaceId: task.workspaceId },
        AutomationTriggerType.TASK_STATUS_CHANGED,
        task,
      );
    }
    if (
      task.status === TaskStatus.DONE &&
      prior.status !== TaskStatus.DONE
    ) {
      await this.automationService.evaluate(
        id,
        AutomationTriggerType.TASK_COMPLETED,
        oldSnap,
        newSnap,
      );
      await this.emitOutboundWebhook(
        { projectId: task.projectId, workspaceId: task.workspaceId },
        AutomationTriggerType.TASK_COMPLETED,
        task,
      );
    }
    if (this.assigneeSignature(prior) !== this.assigneeSignature(task)) {
      await this.automationService.evaluate(
        id,
        AutomationTriggerType.ASSIGNEE_CHANGED,
        oldSnap,
        newSnap,
      );
      await this.emitOutboundWebhook(
        { projectId: task.projectId, workspaceId: task.workspaceId },
        AutomationTriggerType.ASSIGNEE_CHANGED,
        task,
      );
    }
    if (prior.sectionId !== task.sectionId) {
      await this.automationService.evaluate(
        id,
        AutomationTriggerType.SECTION_CHANGED,
        oldSnap,
        newSnap,
      );
      await this.emitOutboundWebhook(
        { projectId: task.projectId, workspaceId: task.workspaceId },
        AutomationTriggerType.SECTION_CHANGED,
        task,
      );
    }
    if (
      task.agentCompletedAt &&
      (!prior.agentCompletedAt ||
        new Date(task.agentCompletedAt) > new Date(prior.agentCompletedAt))
    ) {
      await this.automationService.evaluate(
        id,
        AutomationTriggerType.AGENT_COMPLETED,
        oldSnap,
        newSnap,
      );
      await this.emitOutboundWebhook(
        { projectId: task.projectId, workspaceId: task.workspaceId },
        AutomationTriggerType.AGENT_COMPLETED,
        task,
      );
    }

    const dto = this.taskToDto(task);
    if (task.projectId) {
      const links = await this.prisma.projectWorkspace.findMany({
        where: { projectId: task.projectId },
        select: { workspaceId: true },
      });
      for (const l of links) {
        this.eventsGateway.emitToWorkspace(l.workspaceId, 'task:updated', {
          task: dto,
          action: 'updated',
        });
      }
      if (links[0]) {
        this.eventsGateway.emitToTask(id, links[0].workspaceId, 'task:updated', {
          task: dto,
          action: 'updated',
        });
      }
      this.scheduleGoalMetricRecompute(links.map((l) => l.workspaceId));
    } else if (task.workspaceId) {
      this.eventsGateway.emitToWorkspace(task.workspaceId, 'task:updated', {
        task: dto,
        action: 'updated',
      });
      this.eventsGateway.emitToTask(id, task.workspaceId, 'task:updated', {
        task: dto,
        action: 'updated',
      });
      this.scheduleGoalMetricRecompute([task.workspaceId]);
    }

    await refreshPmSnapshotsForProjectTask(this.prisma, {
      projectId: prior.projectId,
      sprintIds: [prior.sprintId, task.sprintId],
    });

    if (createdFollowUp) {
      const followRow = await this.prisma.task.findUnique({
        where: { id: createdFollowUp.id },
        include: { assignees: true },
      });
      if (followRow) {
        await this.automationService.evaluate(
          createdFollowUp.id,
          AutomationTriggerType.TASK_CREATED,
          undefined,
          this.automationTaskSnapshot(followRow),
        );
        await this.emitOutboundWebhook(
          {
            projectId: followRow.projectId,
            workspaceId: followRow.workspaceId,
          },
          AutomationTriggerType.TASK_CREATED,
          followRow,
        );
      }
      const loc = await this.prisma.task.findUnique({
        where: { id: createdFollowUp.id },
        select: { projectId: true, workspaceId: true },
      });
      if (loc?.projectId) {
        const links = await this.prisma.projectWorkspace.findMany({
          where: { projectId: loc.projectId },
          select: { workspaceId: true },
        });
        for (const l of links) {
          this.eventsGateway.emitToWorkspace(l.workspaceId, 'task:created', {
            task: createdFollowUp,
            action: 'created',
          });
        }
      } else if (loc?.workspaceId) {
        this.eventsGateway.emitToWorkspace(loc.workspaceId, 'task:created', {
          task: createdFollowUp,
          action: 'created',
        });
      }
    }

    return dto;
  }

  async duplicateTask(
    actorId: string,
    taskId: string,
    req: DuplicateTaskRequest,
  ): Promise<TaskDto> {
    const source = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: true,
        genericResourceAssignments: { include: { genericResource: true } },
        tags: true,
        customFieldValues: true,
      },
    });
    if (!source || source.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const targetProjectId = req.projectId ?? source.projectId;
    if (!targetProjectId) {
      throw new BadRequestException(
        'projectId is required when duplicating a personal task',
      );
    }

    const project = await this.prisma.project.findFirst({
      where: { id: targetProjectId, deletedAt: null },
      include: {
        workspaceLinks: { orderBy: { joinedAt: 'asc' }, select: { workspaceId: true } },
      },
    });
    if (!project) {
      throw new BadRequestException('Target project not found');
    }
    const primaryWs = project.workspaceLinks[0]?.workspaceId;
    if (!primaryWs) {
      throw new BadRequestException('Target project has no workspace link');
    }

    const sectionId =
      req.sectionId !== undefined ? req.sectionId : source.sectionId ?? null;
    if (sectionId) {
      const sec = await this.prisma.section.findFirst({
        where: { id: sectionId, projectId: targetProjectId },
      });
      if (!sec) {
        throw new BadRequestException('sectionId is not in the target project');
      }
    }

    const agg = await this.prisma.task.aggregate({
      where: {
        projectId: targetProjectId,
        sectionId,
        parentTaskId: null,
        deletedAt: null,
      },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    const title = (req.title?.trim() || source.title).trim() || source.title;

    const genericCreates =
      source.genericResourceAssignments
        ?.filter((x) => x.genericResource.workspaceId === primaryWs)
        .map((x) => ({
          genericResourceId: x.genericResourceId,
          unitsPercent: x.unitsPercent ?? 100,
          ...(x.costPerUse != null
            ? { costPerUse: x.costPerUse }
            : {}),
        })) ?? [];

    if (!source.parentTaskId && sectionId) {
      await this.assertNewRootFitsKanbanWip(targetProjectId, sectionId);
    }

    let dupWorkCalId: string | null = source.workCalendarId;
    if (dupWorkCalId && targetProjectId !== source.projectId) {
      const wsIds = project.workspaceLinks.map((l) => l.workspaceId);
      const ok = await this.prisma.workCalendar.findFirst({
        where: { id: dupWorkCalId, workspaceId: { in: wsIds } },
      });
      dupWorkCalId = ok?.id ?? null;
    }

    let dupSprintId: string | null = null;
    if (targetProjectId === source.projectId && source.sprintId) {
      const ok = await this.prisma.sprint.findFirst({
        where: { id: source.sprintId, projectId: targetProjectId },
      });
      dupSprintId = ok ? source.sprintId : null;
    }

    let dupEpicId: string | null = null;
    if (targetProjectId === source.projectId && source.epicTaskId) {
      const okEpic = await this.prisma.task.findFirst({
        where: { id: source.epicTaskId, projectId: targetProjectId, deletedAt: null },
        select: { id: true },
      });
      dupEpicId = okEpic ? source.epicTaskId : null;
    }

    const created = await this.prisma.task.create({
      data: {
        projectId: targetProjectId,
        workspaceId: primaryWs,
        sectionId,
        parentTaskId: null,
        createdById: actorId,
        title,
        description: source.description,
        htmlContent: source.htmlContent,
        status: TaskStatus.BACKLOG,
        priority: source.priority,
        startDate: source.startDate,
        dueDate: source.dueDate,
        sortOrder,
        backlogRank: dupSprintId ? null : source.backlogRank,
        actorTier: source.actorTier,
        domain: source.domain,
        complexity: source.complexity,
        reviewGate: source.reviewGate,
        phase: source.phase,
        parallelGroup: source.parallelGroup,
        workItemType: source.workItemType ?? 'TASK',
        storyPoints: source.storyPoints,
        sprintId: dupSprintId ?? undefined,
        epicTaskId: dupEpicId ?? undefined,
        agentContext:
          source.agentContext === null || source.agentContext === undefined
            ? undefined
            : (source.agentContext as object),
        isTemplate: false,
        isMilestone: source.isMilestone ?? false,
        isManuallyScheduled: source.isManuallyScheduled,
        constraintType: source.constraintType,
        constraintDate: source.constraintDate,
        deadlineDate: source.deadlineDate,
        durationWorkingMinutes: source.durationWorkingMinutes,
        workMinutes: source.workMinutes,
        scheduleMode: source.scheduleMode,
        workCalendarId: dupWorkCalId ?? undefined,
        effortDriven: source.effortDriven ?? false,
        isSummaryRollup: source.isSummaryRollup ?? false,
        levelingPriority: source.levelingPriority ?? undefined,
        levelingDelayWorkingDays: 0,
        levelingCanSplit: source.levelingCanSplit ?? false,
        percentComplete: source.percentComplete,
        fixedCost: source.fixedCost,
        actualCost: source.actualCost,
        overtimeWorkMinutes: source.overtimeWorkMinutes ?? undefined,
        isBudgetTask: source.isBudgetTask ?? false,
        workContour: source.workContour ?? undefined,
        scheduleSegments:
          source.scheduleSegments === null || source.scheduleSegments === undefined
            ? undefined
            : (source.scheduleSegments as Prisma.InputJsonValue),
        assignees:
          source.assignees.length > 0
            ? {
                create: source.assignees.map((a) => ({
                  userId: a.userId,
                  unitsPercent: a.unitsPercent ?? 100,
                  ...(a.workMinutes != null ? { workMinutes: a.workMinutes } : {}),
                  ...(a.costPerUse != null ? { costPerUse: a.costPerUse } : {}),
                })),
              }
            : undefined,
        tags:
          source.tags.length > 0
            ? { create: source.tags.map((t) => ({ tagId: t.tagId })) }
            : undefined,
        genericResourceAssignments:
          genericCreates.length > 0
            ? { create: genericCreates }
            : undefined,
      },
      include: {
        assignees: { include: { user: true } },
        genericResourceAssignments: { include: { genericResource: true } },
        tags: { include: { tag: true } },
        subtasks: true,
        createdBy: true,
        sprint: { select: { id: true, name: true } },
      },
    });

    for (const v of source.customFieldValues) {
      await this.prisma.customFieldValue.create({
        data: {
          taskId: created.id,
          fieldId: v.fieldId,
          value: v.value as Prisma.InputJsonValue,
        },
      });
    }

    await this.taskActivityLog.log({
      actorId,
      taskId: created.id,
      projectId: targetProjectId,
      eventType: AuditEventType.TASK_CREATED,
      description: `Duplicated from "${source.title}"`,
      newValue: { sourceTaskId: source.id, title: created.title },
    });

    const dto = (await this.findById(created.id))!;
    const dupSnapRow = await this.prisma.task.findUnique({
      where: { id: created.id },
      include: { assignees: true },
    });
    if (dupSnapRow) {
      await this.automationService.evaluate(
        created.id,
        AutomationTriggerType.TASK_CREATED,
        undefined,
        this.automationTaskSnapshot(dupSnapRow),
      );
      await this.emitOutboundWebhook(
        {
          projectId: dupSnapRow.projectId,
          workspaceId: dupSnapRow.workspaceId,
        },
        AutomationTriggerType.TASK_CREATED,
        dupSnapRow,
      );
    }
    for (const l of project.workspaceLinks) {
      this.eventsGateway.emitToWorkspace(l.workspaceId, 'task:created', {
        task: dto,
        action: 'created',
      });
    }
    this.scheduleGoalMetricRecompute(
      project.workspaceLinks.map((l) => l.workspaceId),
    );
    await refreshPmSnapshotsForProjectTask(this.prisma, {
      projectId: targetProjectId,
      sprintIds: [created.sprintId],
    });
    return dto;
  }

  async delete(id: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (task?.projectId) {
      await refreshPmSnapshotsForProjectTask(this.prisma, {
        projectId: task.projectId,
        sprintIds: [task.sprintId],
      });
    }

    if (!task) return;

    const dto = this.taskToDto(task);
    if (task.projectId) {
      const links = await this.prisma.projectWorkspace.findMany({
        where: { projectId: task.projectId },
        select: { workspaceId: true },
      });
      for (const l of links) {
        this.eventsGateway.emitToWorkspace(l.workspaceId, 'task:deleted', {
          task: dto,
          action: 'deleted',
        });
      }
      this.scheduleGoalMetricRecompute(links.map((l) => l.workspaceId));
    } else if (task.workspaceId) {
      this.eventsGateway.emitToWorkspace(task.workspaceId, 'task:deleted', {
        task: dto,
        action: 'deleted',
      });
      this.scheduleGoalMetricRecompute([task.workspaceId]);
    }
  }

  async addAssignee(
    taskId: string,
    actorId: string,
    body: AddTaskAssigneeRequest,
  ): Promise<TaskDto> {
    const assigneeUserId = body.userId;
    const units = this.normalizeAssignmentUnits(body.unitsPercent, 100);
    const wmCreate = this.normalizeAssignmentWorkMinutes(body.workMinutes);
    const costPerUseCreate = this.optionalMoneyField(
      body.costPerUse,
      'costPerUse',
    );
    const prior = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const assigneeUser = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      select: { id: true, displayName: true, email: true },
    });
    if (!assigneeUser) {
      throw new NotFoundException('User not found');
    }

    try {
      await this.prisma.taskAssignee.create({
        data: {
          taskId,
          userId: assigneeUserId,
          unitsPercent: units,
          ...(wmCreate !== undefined ? { workMinutes: wmCreate } : {}),
          ...(costPerUseCreate !== undefined
            ? { costPerUse: costPerUseCreate }
            : {}),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('User is already assigned');
      }
      throw e;
    }

    const afterCreate = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (
      afterCreate?.effortDriven &&
      afterCreate.workMinutes != null &&
      afterCreate.workMinutes > 0 &&
      afterCreate.assignees.length > 0
    ) {
      const n = afterCreate.assignees.length;
      const total = afterCreate.workMinutes;
      const base = Math.floor(total / n);
      let rem = total - base * n;
      for (const a of afterCreate.assignees) {
        const add = rem > 0 ? 1 : 0;
        if (rem > 0) rem -= 1;
        await this.prisma.taskAssignee.update({
          where: { taskId_userId: { taskId, userId: a.userId } },
          data: { workMinutes: base + add },
        });
      }
    }

    const next = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (prior && next) {
      await this.automationService.evaluate(
        taskId,
        AutomationTriggerType.ASSIGNEE_CHANGED,
        this.automationTaskSnapshot(prior),
        this.automationTaskSnapshot(next),
      );
      await this.emitOutboundWebhook(
        { projectId: next.projectId, workspaceId: next.workspaceId },
        AutomationTriggerType.ASSIGNEE_CHANGED,
        next,
      );
    }

    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: prior.projectId,
      eventType: AuditEventType.TASK_ASSIGNED,
      description: `Assigned ${assigneeUser.displayName}`,
      newValue: {
        assigneeId: assigneeUserId,
        unitsPercent: units,
        ...(wmCreate !== undefined ? { workMinutes: wmCreate } : {}),
      },
    });

    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async patchAssignee(
    taskId: string,
    actorId: string,
    assigneeUserId: string,
    body: PatchTaskAssigneeRequest,
  ): Promise<TaskDto> {
    if (
      body.unitsPercent === undefined &&
      body.workMinutes === undefined &&
      body.costPerUse === undefined
    ) {
      throw new BadRequestException(
        'Provide unitsPercent, workMinutes, and/or costPerUse',
      );
    }
    const prior = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    const prevRow = prior.assignees.find((a) => a.userId === assigneeUserId);
    const data: Prisma.TaskAssigneeUpdateInput = {};
    let nextUnits = prevRow?.unitsPercent ?? 100;
    if (body.unitsPercent !== undefined) {
      nextUnits = this.normalizeAssignmentUnits(body.unitsPercent, 100);
      data.unitsPercent = nextUnits;
    }
    const wmUpd = this.normalizeAssignmentWorkMinutes(body.workMinutes);
    let nextWork = prevRow?.workMinutes ?? null;
    if (wmUpd !== undefined) {
      data.workMinutes = wmUpd;
      nextWork = wmUpd;
    }
    const cpuUpd = this.optionalMoneyField(body.costPerUse, 'costPerUse');
    let nextCostPerUse = prevRow?.costPerUse ?? null;
    if (cpuUpd !== undefined) {
      data.costPerUse = cpuUpd;
      nextCostPerUse = cpuUpd;
    }
    try {
      await this.prisma.taskAssignee.update({
        where: { taskId_userId: { taskId, userId: assigneeUserId } },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('Assignee not found on this task');
      }
      throw e;
    }

    const assigneeUser = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      select: { displayName: true },
    });

    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: prior.projectId,
      eventType: AuditEventType.TASK_ASSIGNED,
      description: `Updated allocation for ${assigneeUser?.displayName ?? assigneeUserId}`,
      oldValue: {
        assigneeId: assigneeUserId,
        unitsPercent: prevRow?.unitsPercent,
        workMinutes: prevRow?.workMinutes ?? null,
        costPerUse:
          prevRow?.costPerUse != null ? Number(prevRow.costPerUse) : null,
      },
      newValue: {
        assigneeId: assigneeUserId,
        unitsPercent: nextUnits,
        workMinutes: nextWork,
        costPerUse: nextCostPerUse != null ? Number(nextCostPerUse) : null,
      },
    });

    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async removeAssignee(
    taskId: string,
    actorId: string,
    assigneeUserId: string,
  ): Promise<TaskDto> {
    const prior = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const assigneeUser = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      select: { displayName: true, email: true },
    });

    try {
      await this.prisma.taskAssignee.delete({
        where: { taskId_userId: { taskId, userId: assigneeUserId } },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('Assignee not found on this task');
      }
      throw e;
    }

    const next = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (prior && next) {
      await this.automationService.evaluate(
        taskId,
        AutomationTriggerType.ASSIGNEE_CHANGED,
        this.automationTaskSnapshot(prior),
        this.automationTaskSnapshot(next),
      );
      await this.emitOutboundWebhook(
        { projectId: next.projectId, workspaceId: next.workspaceId },
        AutomationTriggerType.ASSIGNEE_CHANGED,
        next,
      );
    }

    const label = assigneeUser?.displayName ?? assigneeUserId;
    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: prior.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Removed assignee ${label}`,
      oldValue: { assigneeId: assigneeUserId },
    });

    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  private normalizeAssignmentUnits(raw: unknown, fallback = 100): number {
    const n = raw === undefined || raw === null ? fallback : Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > ASSIGNMENT_UNITS_MAX) {
      throw new BadRequestException(
        `unitsPercent must be between 0 exclusive and ${ASSIGNMENT_UNITS_MAX}`,
      );
    }
    return n;
  }

  /** undefined = omit; null = clear DB column. */
  private normalizeAssignmentWorkMinutes(raw: unknown): number | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      throw new BadRequestException(
        'workMinutes must be null or a non-negative number',
      );
    }
    return Math.round(n);
  }

  /** undefined = omit; null = clear. */
  private optionalMoneyField(
    raw: unknown,
    fieldLabel: string,
  ): Prisma.Decimal | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException(
        `${fieldLabel} must be null or a non-negative number`,
      );
    }
    return new Prisma.Decimal(n);
  }

  async addGenericResourceAssignment(
    taskId: string,
    actorId: string,
    body: AddTaskGenericResourceAssignmentRequest,
  ): Promise<TaskDto> {
    const prior = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    const wsId = await resolveTaskPrimaryWorkspaceId(this.prisma, prior);
    if (!wsId) {
      throw new BadRequestException(
        'Task must belong to a project with a workspace to use generic resources',
      );
    }
    const gr = await this.prisma.genericResource.findUnique({
      where: { id: body.genericResourceId },
    });
    if (!gr || gr.workspaceId !== wsId) {
      throw new BadRequestException(
        'Generic resource not found in this task workspace',
      );
    }
    const units = this.normalizeAssignmentUnits(body.unitsPercent, 100);
    const costPerUse =
      body.costPerUse === undefined || body.costPerUse === null
        ? undefined
        : new Prisma.Decimal(body.costPerUse);
    if (costPerUse != null && Number(costPerUse) < 0) {
      throw new BadRequestException('costPerUse must be non-negative');
    }
    try {
      await this.prisma.taskGenericResourceAssignment.create({
        data: {
          taskId,
          genericResourceId: body.genericResourceId,
          unitsPercent: units,
          ...(costPerUse !== undefined ? { costPerUse } : {}),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Resource is already assigned to this task');
      }
      throw e;
    }
    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: prior.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Assigned generic resource "${gr.name}"`,
      newValue: { genericResourceId: gr.id, unitsPercent: units },
    });
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async patchGenericResourceAssignment(
    taskId: string,
    actorId: string,
    genericResourceId: string,
    body: PatchTaskGenericResourceAssignmentRequest,
  ): Promise<TaskDto> {
    const prior = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    if (body.unitsPercent === undefined && body.costPerUse === undefined) {
      throw new BadRequestException('Provide unitsPercent and/or costPerUse');
    }
    const data: { unitsPercent?: number; costPerUse?: Prisma.Decimal | null } =
      {};
    if (body.unitsPercent !== undefined) {
      data.unitsPercent = this.normalizeAssignmentUnits(body.unitsPercent, 100);
    }
    if (body.costPerUse !== undefined) {
      data.costPerUse =
        body.costPerUse === null ? null : new Prisma.Decimal(body.costPerUse);
      if (data.costPerUse != null && Number(data.costPerUse) < 0) {
        throw new BadRequestException('costPerUse must be null or non-negative');
      }
    }
    try {
      await this.prisma.taskGenericResourceAssignment.update({
        where: {
          taskId_genericResourceId: { taskId, genericResourceId },
        },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('Assignment not found on this task');
      }
      throw e;
    }
    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: prior.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: 'Updated generic resource assignment',
      newValue: { genericResourceId, ...data },
    });
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  async removeGenericResourceAssignment(
    taskId: string,
    actorId: string,
    genericResourceId: string,
  ): Promise<TaskDto> {
    const prior = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!prior || prior.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    const gr = await this.prisma.genericResource.findUnique({
      where: { id: genericResourceId },
      select: { name: true },
    });
    try {
      await this.prisma.taskGenericResourceAssignment.delete({
        where: {
          taskId_genericResourceId: { taskId, genericResourceId },
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('Assignment not found on this task');
      }
      throw e;
    }
    const updated = await this.findById(taskId);
    if (!updated) throw new NotFoundException('Task not found');
    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: prior.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Removed generic resource "${gr?.name ?? genericResourceId}"`,
      oldValue: { genericResourceId },
    });
    await this.emitTaskUpdatedSocket(updated);
    return updated;
  }

  /**
   * Board/list DnD: reparent, promote to root (parentTaskId null + sectionId in items), reorder.
   * Validates cycles + max depth + Kanban WIP on simulated tree (same invariants as PATCH parent moves).
   */
  async reorderTasks(req: ReorderTasksRequest): Promise<void> {
    if (!req.items?.length) return;

    const requestedIds = [...new Set(req.items.map((i) => i.taskId))];
    const touched = await this.prisma.task.findMany({
      where: { id: { in: requestedIds }, deletedAt: null },
      select: {
        id: true,
        projectId: true,
        parentTaskId: true,
        sectionId: true,
        sortOrder: true,
      },
    });
    if (touched.length !== requestedIds.length) {
      throw new NotFoundException('One or more tasks not found');
    }
    const projectIds = [...new Set(touched.map((t) => t.projectId))];
    if (projectIds.length !== 1 || projectIds[0] == null) {
      throw new BadRequestException(
        'Reorder batch must target tasks in exactly one project',
      );
    }
    const projectId = projectIds[0];

    const allRows = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        parentTaskId: true,
        sectionId: true,
        sortOrder: true,
      },
    });

    type SimRow = {
      parentTaskId: string | null;
      sectionId: string | null;
      sortOrder: number;
    };
    const sim = new Map<string, SimRow>();
    for (const r of allRows) {
      sim.set(r.id, {
        parentTaskId: r.parentTaskId,
        sectionId: r.sectionId,
        sortOrder: r.sortOrder,
      });
    }

    for (const item of req.items) {
      if (item.parentTaskId === item.taskId) {
        throw new BadRequestException('Task cannot be its own parent');
      }
      const row = sim.get(item.taskId);
      if (!row) {
        throw new BadRequestException(
          `Task ${item.taskId} is not in this project`,
        );
      }
      row.sortOrder = item.sortOrder;
      if (item.sectionId !== undefined) row.sectionId = item.sectionId;
      if (item.parentTaskId !== undefined) {
        if (item.parentTaskId && !sim.has(item.parentTaskId)) {
          throw new BadRequestException('Parent task is not in this project');
        }
        row.parentTaskId = item.parentTaskId;
      }
    }

    this.assertSimTreeValid(sim);

    await this.assertKanbanWipForSectionRoots(projectId, sim);

    const before = await this.prisma.task.findMany({
      where: { id: { in: requestedIds } },
      include: { assignees: true },
    });
    const beforeMap = new Map(before.map((t) => [t.id, t]));

    await this.prisma.$transaction(
      req.items.map((item) =>
        this.prisma.task.update({
          where: { id: item.taskId },
          data: {
            sortOrder: item.sortOrder,
            ...(item.sectionId !== undefined && { sectionId: item.sectionId }),
            ...(item.parentTaskId !== undefined && {
              parentTaskId: item.parentTaskId,
            }),
          },
        }),
      ),
    );

    const after = await this.prisma.task.findMany({
      where: { id: { in: requestedIds } },
      include: { assignees: true },
    });
    for (const t of after) {
      const old = beforeMap.get(t.id);
      if (old && old.sectionId !== t.sectionId) {
        await this.automationService.evaluate(
          t.id,
          AutomationTriggerType.SECTION_CHANGED,
          this.automationTaskSnapshot(old),
          this.automationTaskSnapshot(t),
        );
        await this.emitOutboundWebhook(
          { projectId: t.projectId, workspaceId: t.workspaceId },
          AutomationTriggerType.SECTION_CHANGED,
          t,
        );
      }
    }
  }

  /**
   * Root tasks only (parentTaskId null) per section; enforced when project uses STRICT Kanban WIP.
   */
  private async assertKanbanWipForSectionRoots(
    projectId: string,
    sim: Map<string, { parentTaskId: string | null; sectionId: string | null }>,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      select: { kanbanWipEnforcement: true },
    });
    if (!project || project.kanbanWipEnforcement !== KanbanWipEnforcement.STRICT) {
      return;
    }
    const sections = await this.prisma.section.findMany({
      where: { projectId },
      select: { id: true, name: true, wipLimit: true },
    });
    const limits = new Map(
      sections.filter((s) => s.wipLimit != null).map((s) => [s.id, s.wipLimit!]),
    );
    if (limits.size === 0) return;

    const rootsBySection = new Map<string, number>();
    for (const [, row] of sim) {
      if (row.parentTaskId == null && row.sectionId) {
        rootsBySection.set(
          row.sectionId,
          (rootsBySection.get(row.sectionId) ?? 0) + 1,
        );
      }
    }
    for (const [sid, limit] of limits) {
      const n = rootsBySection.get(sid) ?? 0;
      if (n > limit) {
        const name = sections.find((s) => s.id === sid)?.name ?? sid;
        throw new BadRequestException(
          `WIP limit (${limit}) exceeded for column "${name}" (${n} root tasks). Move or complete work before adding more.`,
        );
      }
    }
  }

  private async assertNewRootFitsKanbanWip(
    projectId: string,
    sectionId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      select: { kanbanWipEnforcement: true },
    });
    if (!project || project.kanbanWipEnforcement !== KanbanWipEnforcement.STRICT) {
      return;
    }
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, projectId },
      select: { wipLimit: true, name: true },
    });
    if (!section?.wipLimit) return;
    const count = await this.prisma.task.count({
      where: {
        projectId,
        sectionId,
        parentTaskId: null,
        deletedAt: null,
        isTemplate: false,
      },
    });
    if (count >= section.wipLimit) {
      throw new BadRequestException(
        `WIP limit (${section.wipLimit}) reached for column "${section.name}". Move or complete a task before adding another.`,
      );
    }
  }

  private readonly maxTaskTreeDepth = 4;

  private depthInSim(
    taskId: string,
    sim: Map<string, { parentTaskId: string | null }>,
  ): number {
    let depth = 0;
    let cur: string | null = taskId;
    while (cur) {
      const p = sim.get(cur)?.parentTaskId ?? null;
      if (!p) break;
      depth++;
      cur = p;
    }
    return depth;
  }

  private assertSimTreeValid(
    sim: Map<string, { parentTaskId: string | null }>,
  ): void {
    for (const id of sim.keys()) {
      const seen = new Set<string>();
      let cur: string | null = id;
      while (cur) {
        if (seen.has(cur)) {
          throw new BadRequestException('Invalid task parent chain (cycle)');
        }
        seen.add(cur);
        cur = sim.get(cur)?.parentTaskId ?? null;
      }
    }
    for (const id of sim.keys()) {
      if (this.depthInSim(id, sim) > this.maxTaskTreeDepth) {
        throw new BadRequestException('Task nesting exceeds maximum depth');
      }
    }
  }

  private async assertUpdateKeepsValidTaskTree(
    taskId: string,
    projectId: string | null,
    req: UpdateTaskRequest,
  ): Promise<void> {
    if (!projectId) {
      throw new BadRequestException('Cannot reparent a task without a project');
    }
    const allRows = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        parentTaskId: true,
        sectionId: true,
        sortOrder: true,
      },
    });
    const sim = new Map<
      string,
      { parentTaskId: string | null; sectionId: string | null; sortOrder: number }
    >();
    for (const r of allRows) {
      sim.set(r.id, {
        parentTaskId: r.parentTaskId,
        sectionId: r.sectionId,
        sortOrder: r.sortOrder,
      });
    }
    const row = sim.get(taskId);
    if (!row) {
      throw new NotFoundException('Task not found');
    }
    if (req.parentTaskId !== undefined) {
      if (req.parentTaskId && !sim.has(req.parentTaskId)) {
        throw new BadRequestException('Parent task is not in this project');
      }
      row.parentTaskId = req.parentTaskId;
      if (typeof req.parentTaskId === 'string') {
        const ps = sim.get(req.parentTaskId)?.sectionId;
        if (ps) row.sectionId = ps;
      }
    }
    if (req.sectionId !== undefined) row.sectionId = req.sectionId;
    if (req.sortOrder !== undefined) row.sortOrder = req.sortOrder;
    this.assertSimTreeValid(sim);
  }

  /** Used when nesting tasks under projects/sections */
  toTaskDto(task: any): TaskDto {
    return this.taskToDto(task);
  }

  private assigneeSignature(task: { assignees?: { userId: string }[] }): string {
    return (task.assignees || [])
      .map((a) => a.userId)
      .sort()
      .join(',');
  }

  /** After attachment upload from controller (activity log lives in AttachmentService). */
  async broadcastTaskUpdated(dto: TaskDto): Promise<void> {
    await this.emitTaskUpdatedSocket(dto);
  }

  /** Socket fan-out for assignee / attachment paths that skip `update()`. */
  private async emitTaskUpdatedSocket(dto: TaskDto): Promise<void> {
    const row = await this.prisma.task.findUnique({
      where: { id: dto.id },
      select: { projectId: true, workspaceId: true },
    });
    if (!row) return;
    if (row.projectId) {
      const links = await this.prisma.projectWorkspace.findMany({
        where: { projectId: row.projectId },
        select: { workspaceId: true },
      });
      for (const l of links) {
        this.eventsGateway.emitToWorkspace(l.workspaceId, 'task:updated', {
          task: dto,
          action: 'updated',
        });
      }
      if (links[0]) {
        this.eventsGateway.emitToTask(dto.id, links[0].workspaceId, 'task:updated', {
          task: dto,
          action: 'updated',
        });
      }
      this.scheduleGoalMetricRecompute(links.map((l) => l.workspaceId));
    } else if (row.workspaceId) {
      this.eventsGateway.emitToWorkspace(row.workspaceId, 'task:updated', {
        task: dto,
        action: 'updated',
      });
      this.eventsGateway.emitToTask(dto.id, row.workspaceId, 'task:updated', {
        task: dto,
        action: 'updated',
      });
      this.scheduleGoalMetricRecompute([row.workspaceId]);
    }
  }

  /** Recompute workspace goal metrics that use task-backed definitions (async, non-blocking). */
  private scheduleGoalMetricRecompute(
    workspaceIds: (string | null | undefined)[],
  ): void {
    const seen = new Set<string>();
    for (const w of workspaceIds) {
      if (typeof w !== 'string' || !w || seen.has(w)) continue;
      seen.add(w);
      this.goalMetricCompute.scheduleRecomputeWorkspace(w);
    }
  }

  private automationTaskSnapshot(task: any) {
    return {
      id: task.id,
      status: task.status,
      dueDate: task.dueDate,
      sectionId: task.sectionId,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      agentCompletedAt: task.agentCompletedAt,
      assignees: task.assignees || [],
      createdById: task.createdById,
    };
  }

  private outboundWebhookTaskPayload(task: any) {
    return {
      ...this.automationTaskSnapshot(task),
      title: task.title,
    };
  }

  private async emitOutboundWebhook(
    taskLike: { projectId?: string | null; workspaceId?: string | null },
    trigger: AutomationTriggerType,
    taskEntity: any,
  ) {
    const wsIds = await this.outboundWebhookService.resolveWorkspaceIds(
      taskLike,
    );
    await this.outboundWebhookService.deliverTaskEvent(
      wsIds,
      trigger,
      this.outboundWebhookTaskPayload(taskEntity),
    );
  }

  private async workspaceIdsForProject(projectId: string): Promise<string[]> {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceLinks: { select: { workspaceId: true } } },
    });
    return (p?.workspaceLinks ?? []).map((l) => l.workspaceId);
  }

  private async resolveTaskWorkCalendarCreateData(
    project: { workspaceLinks: { workspaceId: string }[] },
    workCalendarId: string | null | undefined,
  ): Promise<{ workCalendarId?: string | null }> {
    if (workCalendarId === undefined) return {};
    const wsIds = project.workspaceLinks.map((l) => l.workspaceId);
    if (workCalendarId === null) return { workCalendarId: null };
    const cal = await this.prisma.workCalendar.findFirst({
      where: { id: workCalendarId, workspaceId: { in: wsIds } },
    });
    if (!cal) {
      throw new BadRequestException(
        'workCalendarId must reference a work calendar in this project workspace',
      );
    }
    return { workCalendarId: cal.id };
  }

  private computeWbsOutlineMap(
    rows: { id: string; parentTaskId: string | null; sortOrder: number }[],
  ): Map<string, string> {
    if (!Array.isArray(rows)) return new Map();
    const byParent = new Map<string | null, typeof rows>();
    for (const r of rows) {
      const p = r.parentTaskId ?? null;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(r);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    const out = new Map<string, string>();
    const walk = (parentId: string | null, prefix: string) => {
      const kids = byParent.get(parentId) ?? [];
      kids.forEach((k, i) => {
        const label = prefix ? `${prefix}.${i + 1}` : String(i + 1);
        out.set(k.id, label);
        walk(k.id, label);
      });
    };
    walk(null, '');
    return out;
  }

  private taskToDto(task: any, wbsMap?: Map<string, string>): TaskDto {
    return {
      id: task.id,
      projectId: task.projectId,
      sectionId: task.sectionId,
      parentTaskId: task.parentTaskId,
      epicTaskId: task.epicTaskId ?? null,
      createdById: task.createdById,
      title: task.title,
      description: task.description,
      htmlContent: task.htmlContent,
      status: task.status,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      estimatedMin: task.estimatedMin,
      actualMin: task.actualMin,
      sortOrder: task.sortOrder,
      backlogRank: task.backlogRank ?? null,
      actorTier: task.actorTier,
      domain: task.domain,
      complexity: task.complexity,
      reviewGate: task.reviewGate,
      phase: task.phase,
      parallelGroup: task.parallelGroup,
      agentContext: task.agentContext,
      agentOutput: task.agentOutput,
      agentStartedAt: task.agentStartedAt,
      agentCompletedAt: task.agentCompletedAt,
      retryCount: task.retryCount,
      escalationNote: task.escalationNote,
      workItemType: task.workItemType ?? 'TASK',
      storyPoints: task.storyPoints ?? null,
      sprintId: task.sprintId ?? null,
      sprint: task.sprint
        ? { id: task.sprint.id, name: task.sprint.name }
        : null,
      isArchived: task.isArchived,
      recurrenceRule: task.recurrenceRule ?? undefined,
      recurrenceUntil: task.recurrenceUntil ?? undefined,
      isTemplate: task.isTemplate ?? false,
      isMilestone: task.isMilestone ?? false,
      isManuallyScheduled: task.isManuallyScheduled ?? true,
      constraintType: task.constraintType,
      constraintDate: task.constraintDate ?? undefined,
      deadlineDate: task.deadlineDate ?? undefined,
      durationWorkingMinutes: task.durationWorkingMinutes ?? null,
      workMinutes: task.workMinutes ?? null,
      scheduleMode: task.scheduleMode,
      workCalendarId: task.workCalendarId ?? undefined,
      effortDriven: task.effortDriven ?? false,
      isSummaryRollup: task.isSummaryRollup ?? false,
      levelingPriority: task.levelingPriority ?? 500,
      levelingDelayWorkingDays: task.levelingDelayWorkingDays ?? 0,
      levelingCanSplit: task.levelingCanSplit ?? false,
      wbsOutlineNumber: wbsMap?.get(task.id) ?? undefined,
      percentComplete: task.percentComplete ?? 0,
      fixedCost: task.fixedCost != null ? Number(task.fixedCost) : null,
      actualCost: task.actualCost != null ? Number(task.actualCost) : null,
      overtimeWorkMinutes: task.overtimeWorkMinutes ?? null,
      isBudgetTask: task.isBudgetTask ?? false,
      scheduleSegments: this.scheduleSegmentsToDto(task.scheduleSegments),
      workContour: (task.workContour ?? TaskWorkContour.FLAT) as TaskWorkContour,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      assignees: task.assignees?.map((a: any) => ({
        id: a.id,
        taskId: a.taskId,
        userId: a.userId,
        unitsPercent: a.unitsPercent ?? 100,
        workMinutes: a.workMinutes ?? null,
        costPerUse: a.costPerUse != null ? Number(a.costPerUse) : null,
        user: a.user,
        assignedAt: a.assignedAt,
      })),
      genericResourceAssignments: task.genericResourceAssignments?.map(
        (a: any) => ({
          id: a.id,
          taskId: a.taskId,
          genericResourceId: a.genericResourceId,
          unitsPercent: a.unitsPercent ?? 100,
          costPerUse: a.costPerUse != null ? Number(a.costPerUse) : null,
          assignedAt: a.assignedAt,
          genericResource: {
            id: a.genericResource.id,
            name: a.genericResource.name,
            maxUnitsPercent: a.genericResource.maxUnitsPercent ?? 100,
            standardRatePerHour:
              a.genericResource.standardRatePerHour != null
                ? Number(a.genericResource.standardRatePerHour)
                : null,
          },
        }),
      ),
      subtasks: task.subtasks?.map((s: any) => this.taskToDto(s, wbsMap)),
      tags: task.tags?.map((t: any) => ({
        id: t.tag.id,
        workspaceId: t.tag.workspaceId,
        name: t.tag.name,
        color: t.tag.color,
        createdAt: t.tag.createdAt,
      })),
      waitingOn: task.dependencies?.map((d: any) => ({
        id: d.id,
        dependentId: d.dependentId,
        blockingId: d.blockingId,
        type: d.type,
        linkType: d.linkType ?? 'FS',
        lagDays: typeof d.lagDays === 'number' ? d.lagDays : 0,
        lagIsElapsed: d.lagIsElapsed === true,
        createdAt: d.createdAt,
        blockingTask: d.blockingTask ? this.taskSummaryToDto(d.blockingTask) : undefined,
      })),
      blockingTasks: task.blockedBy?.map((d: any) => ({
        id: d.id,
        dependentId: d.dependentId,
        blockingId: d.blockingId,
        type: d.type,
        linkType: d.linkType ?? 'FS',
        lagDays: typeof d.lagDays === 'number' ? d.lagDays : 0,
        lagIsElapsed: d.lagIsElapsed === true,
        createdAt: d.createdAt,
        dependentTask: d.dependentTask ? this.taskSummaryToDto(d.dependentTask) : undefined,
      })),
      attachments: task.attachments?.map((a: any) => ({
        id: a.id,
        taskId: a.taskId,
        uploadedById: a.uploadedById,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        url: a.url,
        createdAt: a.createdAt,
      })),
      customFields: task.customFieldValues?.map((v: any) => ({
        id: v.id,
        taskId: v.taskId,
        fieldId: v.fieldId,
        value: v.value as Record<string, any>,
        field: v.field ? this.customFieldDefToDto(v.field) : undefined,
      })),
      activityLogs: task.activityLogs?.map((log: any) => ({
        id: log.id,
        projectId: log.projectId,
        taskId: log.taskId,
        actorId: log.actorId,
        eventType: log.eventType,
        description: log.description,
        oldValue: log.oldValue as Record<string, any> | undefined,
        newValue: log.newValue as Record<string, any> | undefined,
        createdAt: log.createdAt,
        actor: log.actor
          ? {
              id: log.actor.id,
              email: log.actor.email,
              displayName: log.actor.displayName,
            }
          : undefined,
      })),
    };
  }

  private taskSummaryToDto(t: any) {
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      projectId: t.projectId,
      startDate: t.startDate,
      dueDate: t.dueDate,
    };
  }

  private customFieldDefToDto(field: any) {
    const computedKind =
      field.computedKind ?? CustomFieldComputedKind.NONE;
    return {
      id: field.id,
      workspaceId: field.workspaceId,
      name: field.name,
      type: field.type,
      options: field.options,
      isRequired: field.isRequired,
      description: field.description ?? undefined,
      defaultValue: field.defaultValue ?? undefined,
      computedKind,
      rollupSourceFieldId: field.rollupSourceFieldId ?? undefined,
      rollupAggregation: field.rollupAggregation ?? undefined,
      isComputed: computedKind !== CustomFieldComputedKind.NONE,
      createdAt: field.createdAt,
    };
  }

  private async assertRequiredProjectCustomFieldsForDone(
    taskId: string,
    projectId: string | null,
  ): Promise<void> {
    if (!projectId) return;

    const links = await this.prisma.projectCustomField.findMany({
      where: { projectId },
      include: { field: true },
    });
    const values = await this.prisma.customFieldValue.findMany({
      where: { taskId },
    });
    const byField = new Map(
      values.map((v) => [v.fieldId, v.value as Record<string, unknown>]),
    );

    for (const link of links) {
      if (link.field.computedKind !== CustomFieldComputedKind.NONE) continue;
      if (!link.field.isRequired) continue;
      const fType = link.field.type as CustomFieldType;
      const raw = byField.get(link.field.id);
      if (isCustomFieldValueEmpty(fType, raw)) {
        throw new BadRequestException(
          `Complete required field "${link.field.name}" before marking this task done`,
        );
      }
    }
  }
}
