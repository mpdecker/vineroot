import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEventType,
  KanbanWipEnforcement,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { TaskService } from '../task/task.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import {
  ProjectDto,
  CreateProjectRequest,
  UpdateProjectRequest,
  SectionDto,
  CustomFieldDefinitionDto,
  AddProjectCustomFieldRequest,
  DuplicateProjectRequest,
  TaskActivityLogDto,
  SprintDto,
  CreateSprintRequest,
  UpdateSprintRequest,
  SprintBurndownDto,
  SprintBurnupDto,
  SprintBurnupScopeChangeDto,
  ProjectSprintVelocityDto,
  SprintVelocityBarDto,
  ProjectCfdDto,
  ProjectEpicRollupsDto,
  EpicRollupDto,
  ProjectSavedViewConfigDto,
  ProjectSavedViewDto,
  CreateProjectSavedViewRequest,
  UpdateProjectSavedViewRequest,
  ProjectWorkloadDto,
} from '@vineroot/shared-types';
import { buildProjectCfdSeries } from './project-cfd.util';
import {
  buildProjectWorkloadDto,
  enumerateWeekStarts,
  startOfWeekMonday,
  WORKLOAD_TERMINAL,
} from './project-workload.util';
import {
  calendarDayToIsoKey,
  completedCumulativeThroughDayEnd,
  eachCalendarDayInclusive,
  endOfCalendarDay,
  prismaDateFromIsoKey,
  startOfCalendarDay,
  storyPointsRemainingAtDayEnd,
} from './project-sprint-metrics.util';

/** Root-level tasks only (matches list/board scope). */
const rootTaskCountBase = {
  deletedAt: null,
  parentTaskId: null,
  isTemplate: false,
} satisfies Prisma.TaskWhereInput;

/**
 * Nested subtasks for list/board (same max depth as task detail).
 * `depth` = remaining levels below this relation; at 1, leaf tasks load without further subtasks.
 */
function listBoardSubtaskInclude(depth: number): Record<string, unknown> | undefined {
  if (depth <= 0) return undefined;
  return {
    where: { deletedAt: null, isTemplate: false },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      assignees: { include: { user: true } },
      tags: { include: { tag: true } },
      createdBy: true,
      customFieldValues: { include: { field: true } },
      ...(depth > 1 ? { subtasks: listBoardSubtaskInclude(depth - 1) } : {}),
    },
  };
}

const projectInclude = {
  sections: true,
  members: { include: { user: true } },
  workspaceLinks: { select: { workspaceId: true } },
} as const;

const blockingTaskForTimeline = {
  select: {
    id: true,
    title: true,
    status: true,
    projectId: true,
    startDate: true,
    dueDate: true,
  },
} as const;

const projectDetailInclude = {
  sections: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      tasks: {
        where: { deletedAt: null, parentTaskId: null, isTemplate: false },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          assignees: { include: { user: true } },
          tags: { include: { tag: true } },
          createdBy: true,
          customFieldValues: { include: { field: true } },
          sprint: { select: { id: true, name: true } },
          dependencies: { include: { blockingTask: blockingTaskForTimeline } },
          subtasks: listBoardSubtaskInclude(4),
        },
      },
    },
  },
  sprints: { orderBy: { startDate: 'desc' as const } },
  members: { include: { user: true } },
  workspaceLinks: { select: { workspaceId: true } },
} as const;

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private taskService: TaskService,
    private taskActivityLog: TaskActivityLogService,
  ) {}

  private async assertWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (!m) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  private async assertProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const p = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    if (!p) {
      throw new NotFoundException('Project not found');
    }
  }

  private normalizeWorkspaceIds(ids: string[]): string[] {
    const u = [...new Set(ids.filter(Boolean))];
    return u;
  }

  /**
   * Sets `taskCount` (active) and `completedTaskCount` on each project in place.
   * Prisma allows only one filtered `_count` per relation, so we batch `groupBy`.
   */
  private async hydrateRootTaskCounts<T extends { id: string }>(
    projects: T[],
  ): Promise<void> {
    if (projects.length === 0) return;
    const ids = projects.map((p) => p.id);
    const inProjects = { projectId: { in: ids } };
    const [activeAgg, completedAgg] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: {
          ...inProjects,
          ...rootTaskCountBase,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: {
          ...inProjects,
          ...rootTaskCountBase,
          status: { in: ['DONE', 'CANCELLED'] },
        },
        _count: { _all: true },
      }),
    ]);

    const activeByProject = new Map(
      activeAgg.map((r) => [r.projectId as string, r._count._all]),
    );
    const completedByProject = new Map(
      completedAgg.map((r) => [r.projectId as string, r._count._all]),
    );

    for (const p of projects) {
      const row = p as Record<string, unknown>;
      row.taskCount = activeByProject.get(p.id) ?? 0;
      row.completedTaskCount = completedByProject.get(p.id) ?? 0;
    }
  }

  /** POST /projects — body.workspaceIds must include ≥1 workspace. */
  async createFromRequest(
    userId: string,
    req: CreateProjectRequest,
  ): Promise<ProjectDto> {
    const ids = this.normalizeWorkspaceIds(req.workspaceIds ?? []);
    if (ids.length === 0) {
      throw new BadRequestException(
        'At least one workspace is required (workspaceIds)',
      );
    }
    return this.create(ids, userId, req);
  }

  /**
   * Create project linked to the given workspaces (≥1).
   * Used by nested POST .../workspaces/:workspaceId/projects with [workspaceId] (+ optional extras in body).
   */
  async create(
    workspaceIds: string[],
    userId: string,
    req: CreateProjectRequest,
  ): Promise<ProjectDto> {
    const unique = this.normalizeWorkspaceIds(workspaceIds);
    if (unique.length === 0) {
      throw new BadRequestException('At least one workspace is required');
    }

    for (const wid of unique) {
      await this.assertWorkspaceMember(userId, wid);
    }

    if (req.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: req.teamId, deletedAt: null },
      });
      if (!team) {
        throw new BadRequestException('Team not found');
      }
      if (!unique.includes(team.workspaceId)) {
        throw new BadRequestException(
          'Team must belong to one of the project workspaces',
        );
      }
    }

    const project = await this.prisma.project.create({
      data: {
        teamId: req.teamId ?? null,
        createdById: userId,
        name: req.name,
        description: req.description,
        color: req.color ?? 'BLUE',
        emoji: req.emoji,
        isTemplate: req.isTemplate ?? false,
        sections: {
          create: [
            { name: 'To do', isDefault: true, sortOrder: 0 },
            { name: 'In progress', isDefault: false, sortOrder: 1 },
            { name: 'In review', isDefault: false, sortOrder: 2 },
            { name: 'Done', isDefault: false, sortOrder: 3 },
          ],
        },
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
        workspaceLinks: {
          create: unique.map((workspaceId) => ({ workspaceId })),
        },
      },
      include: projectInclude,
    });
    await this.hydrateRootTaskCounts([project]);
    return this.toProjectDto(project);
  }

  async listForUser(userId: string): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        isTemplate: false,
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
    });
    await this.hydrateRootTaskCounts(projects);
    return projects.map((p) => this.toProjectDto(p));
  }

  async listByWorkspace(
    workspaceId: string,
    filters?: {
      teamId?: string;
      status?: string;
      archived?: boolean;
      includeTemplates?: boolean;
    },
  ): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceLinks: { some: { workspaceId } },
        ...(filters?.teamId && { teamId: filters.teamId }),
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.archived !== undefined && {
          isArchived: filters.archived,
        }),
        ...(filters?.includeTemplates ? {} : { isTemplate: false }),
        deletedAt: null,
      },
      include: projectInclude,
    });
    await this.hydrateRootTaskCounts(projects);
    return projects.map((p) => this.toProjectDto(p));
  }

  async findById(id: string, userId: string): Promise<ProjectDto | null> {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      include: projectDetailInclude,
    });
    if (!project) return null;
    await this.hydrateRootTaskCounts([project]);
    return this.toProjectDto(project);
  }

  async update(
    id: string,
    userId: string,
    req: UpdateProjectRequest,
  ): Promise<ProjectDto> {
    await this.assertProjectAccess(id, userId);

    const { workspaceIds: wsPatch, teamId: t, ...scalar } = req;
    const data: Record<string, unknown> = { ...scalar };

    const current = await this.prisma.project.findUnique({
      where: { id },
      select: {
        workspaceLinks: { select: { workspaceId: true } },
      },
    });
    let effectiveWorkspaceIds =
      current?.workspaceLinks.map((l) => l.workspaceId) ?? [];

    if (wsPatch !== undefined) {
      const next = this.normalizeWorkspaceIds(wsPatch);
      if (next.length === 0) {
        throw new BadRequestException(
          'A project must remain linked to at least one workspace',
        );
      }
      for (const wid of next) {
        await this.assertWorkspaceMember(userId, wid);
      }
      const prev = new Set(effectiveWorkspaceIds);
      const newSet = new Set(next);
      const removed = [...prev].filter((w) => !newSet.has(w));
      await this.prisma.$transaction(async (tx) => {
        for (const wid of removed) {
          await tx.portfolioItem.deleteMany({
            where: {
              projectId: id,
              portfolio: { workspaceId: wid },
            },
          });
        }
        await tx.projectWorkspace.deleteMany({ where: { projectId: id } });
        await tx.projectWorkspace.createMany({
          data: next.map((workspaceId) => ({ projectId: id, workspaceId })),
        });
      });
      effectiveWorkspaceIds = next;
    }

    if (t !== undefined) {
      if (t !== null) {
        const team = await this.prisma.team.findFirst({
          where: { id: t, deletedAt: null },
        });
        if (!team) {
          throw new BadRequestException('Team not found');
        }
        if (!effectiveWorkspaceIds.includes(team.workspaceId)) {
          throw new BadRequestException(
            'Team must belong to a workspace linked to this project',
          );
        }
      }
      data.teamId = t;
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: data as any,
      include: projectDetailInclude,
    });
    await this.hydrateRootTaskCounts([project]);
    return this.toProjectDto(project);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.assertProjectAccess(id, userId);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Copy project structure: sections, project custom-field links, tasks (tree), memberships.
   * New project is never a template (`isTemplate: false`).
   */
  async duplicate(
    sourceId: string,
    userId: string,
    workspaceId: string,
    req?: DuplicateProjectRequest,
  ): Promise<ProjectDto> {
    await this.assertProjectAccess(sourceId, userId);

    const source = await this.prisma.project.findFirst({
      where: {
        id: sourceId,
        deletedAt: null,
        OR: [{ createdById: userId }, { members: { some: { userId } } }],
      },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        workspaceLinks: { select: { workspaceId: true } },
        members: true,
      },
    });
    if (!source) {
      throw new NotFoundException('Project not found');
    }

    const defaultWsIds = source.workspaceLinks.map((l) => l.workspaceId);
    const requested = req?.workspaceIds?.length
      ? this.normalizeWorkspaceIds(req.workspaceIds)
      : defaultWsIds;
    const merged = this.normalizeWorkspaceIds([workspaceId, ...requested]);
    for (const wid of merged) {
      await this.assertWorkspaceMember(userId, wid);
    }

    const sourceSprints = await this.prisma.sprint.findMany({
      where: { projectId: sourceId },
      orderBy: { sortOrder: 'asc' },
    });

    const tasks = await this.prisma.task.findMany({
      where: { projectId: sourceId, deletedAt: null },
      include: {
        assignees: true,
        tags: true,
        customFieldValues: true,
      },
    });

    const pcfRows = await this.prisma.projectCustomField.findMany({
      where: { projectId: sourceId },
      orderBy: { sortOrder: 'asc' },
    });

    const newName = req?.name?.trim() || `${source.name} (copy)`;

    const sectionIdMap = new Map<string, string>();
    const sprintIdMap = new Map<string, string>();
    const taskIdMap = new Map<string, string>();

    const byId = new Map(tasks.map((t) => [t.id, t]));
    const depth = (tid: string): number => {
      let d = 0;
      let cur = byId.get(tid);
      while (cur?.parentTaskId) {
        d++;
        cur = byId.get(cur.parentTaskId);
        if (d > 64) break;
      }
      return d;
    };
    tasks.sort(
      (a, b) => depth(a.id) - depth(b.id) || a.sortOrder - b.sortOrder,
    );

    const newProjectId = await this.prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          teamId: source.teamId,
          createdById: userId,
          name: newName,
          description: source.description,
          color: source.color,
          emoji: source.emoji,
          status: 'ACTIVE',
          isPrivate: source.isPrivate,
          isArchived: false,
          isTemplate: false,
          kanbanWipEnforcement:
            source.kanbanWipEnforcement ?? KanbanWipEnforcement.OFF,
          startDate: source.startDate,
          dueDate: source.dueDate,
          defaultView: source.defaultView,
          members: {
            create: source.members.map((m) => ({
              userId: m.userId,
              role: m.role,
            })),
          },
          workspaceLinks: {
            create: merged.map((wid) => ({ workspaceId: wid })),
          },
        },
      });

      for (const s of source.sections) {
        const ns = await tx.section.create({
          data: {
            projectId: proj.id,
            name: s.name,
            color: s.color,
            sortOrder: s.sortOrder,
            isDefault: s.isDefault,
            wipLimit: s.wipLimit ?? undefined,
          },
        });
        sectionIdMap.set(s.id, ns.id);
      }

      for (const link of pcfRows) {
        await tx.projectCustomField.create({
          data: {
            projectId: proj.id,
            fieldId: link.fieldId,
            sortOrder: link.sortOrder,
          },
        });
      }

      for (const sp of sourceSprints) {
        const ns = await tx.sprint.create({
          data: {
            projectId: proj.id,
            name: sp.name,
            goal: sp.goal,
            startDate: sp.startDate,
            endDate: sp.endDate,
            state: sp.state,
            sortOrder: sp.sortOrder,
          },
        });
        sprintIdMap.set(sp.id, ns.id);
      }

      const primaryWs = merged[0];
      for (const t of tasks) {
        const newSectionId = t.sectionId
          ? sectionIdMap.get(t.sectionId)
          : null;
        const newParentId = t.parentTaskId
          ? taskIdMap.get(t.parentTaskId)
          : null;

        const nt = await tx.task.create({
          data: {
            projectId: proj.id,
            workspaceId: primaryWs,
            sectionId: newSectionId,
            parentTaskId: newParentId,
            createdById: userId,
            title: t.title,
            description: t.description,
            htmlContent: t.htmlContent,
            status:
              t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED
                ? TaskStatus.BACKLOG
                : t.status,
            priority: t.priority,
            startDate: t.startDate,
            dueDate: t.dueDate,
            sortOrder: t.sortOrder,
            actorTier: t.actorTier,
            domain: t.domain,
            complexity: t.complexity,
            reviewGate: t.reviewGate,
            phase: t.phase,
            parallelGroup: t.parallelGroup,
            agentContext:
              t.agentContext === null || t.agentContext === undefined
                ? undefined
                : (t.agentContext as object),
            isTemplate: false,
            recurrenceRule: t.recurrenceRule,
            recurrenceUntil: t.recurrenceUntil,
            workItemType: t.workItemType,
            storyPoints: t.storyPoints,
            sprintId: t.sprintId ? sprintIdMap.get(t.sprintId) ?? null : null,
            backlogRank: t.sprintId ? null : t.backlogRank,
            assignees:
              t.assignees.length > 0
                ? {
                    create: t.assignees.map((a) => ({ userId: a.userId })),
                  }
                : undefined,
            tags:
              t.tags.length > 0
                ? { create: t.tags.map((x) => ({ tagId: x.tagId })) }
                : undefined,
          },
        });
        taskIdMap.set(t.id, nt.id);
        for (const v of t.customFieldValues) {
          await tx.customFieldValue.create({
            data: {
              taskId: nt.id,
              fieldId: v.fieldId,
              value: v.value as Prisma.InputJsonValue,
            },
          });
        }
      }

      for (const t of tasks) {
        if (!t.epicTaskId) continue;
        const newTaskId = taskIdMap.get(t.id);
        const newEpicId = taskIdMap.get(t.epicTaskId);
        if (newTaskId && newEpicId) {
          await tx.task.update({
            where: { id: newTaskId },
            data: { epicTaskId: newEpicId },
          });
        }
      }

      return proj.id;
    });

    const full = await this.prisma.project.findFirst({
      where: { id: newProjectId, deletedAt: null },
      include: projectDetailInclude,
    });
    if (!full) {
      throw new NotFoundException('Duplicated project not found');
    }
    await this.hydrateRootTaskCounts([full]);
    await this.taskActivityLog.log({
      actorId: userId,
      taskId: null,
      projectId: newProjectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Project duplicated from "${source.name}"`,
      newValue: { sourceProjectId: sourceId },
    });
    return this.toProjectDto(full);
  }

  /** Human-visible activity across all tasks in the project (newest first). */
  async listProjectActivity(
    projectId: string,
    userId: string,
    take = 100,
  ): Promise<TaskActivityLogDto[]> {
    await this.assertProjectAccess(projectId, userId);
    const rows = await this.prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, email: true, displayName: true } },
        task: { select: { id: true, title: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId ?? undefined,
      taskId: r.taskId ?? undefined,
      actorId: r.actorId,
      eventType: r.eventType as TaskActivityLogDto['eventType'],
      description: r.description,
      oldValue: r.oldValue as Record<string, unknown> | undefined,
      newValue: r.newValue as Record<string, unknown> | undefined,
      createdAt: r.createdAt,
      actor: r.actor
        ? {
            id: r.actor.id,
            email: r.actor.email,
            displayName: r.actor.displayName,
          }
        : undefined,
      task: r.task
        ? { id: r.task.id, title: r.task.title }
        : undefined,
    }));
  }

  async listProjectCustomFields(
    projectId: string,
    userId: string,
  ): Promise<CustomFieldDefinitionDto[]> {
    await this.assertProjectAccess(projectId, userId);
    const rows = await this.prisma.projectCustomField.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: { field: true },
    });
    return rows.map((r) => this.customFieldDefToDto(r.field));
  }

  async addProjectCustomField(
    projectId: string,
    userId: string,
    body: AddProjectCustomFieldRequest,
  ): Promise<CustomFieldDefinitionDto> {
    await this.assertProjectAccess(projectId, userId);
    const fieldId = body.fieldId?.trim();
    if (!fieldId) {
      throw new BadRequestException('fieldId is required');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspaceLinks: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const wsIds = new Set(project.workspaceLinks.map((l) => l.workspaceId));

    const field = await this.prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }
    if (!wsIds.has(field.workspaceId)) {
      throw new BadRequestException(
        'That custom field belongs to a workspace not linked to this project',
      );
    }

    const existing = await this.prisma.projectCustomField.findUnique({
      where: { projectId_fieldId: { projectId, fieldId } },
    });
    if (existing) {
      throw new BadRequestException('This field is already on the project');
    }

    const agg = await this.prisma.projectCustomField.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const nextOrder = (agg._max.sortOrder ?? -1) + 1;

    await this.prisma.projectCustomField.create({
      data: { projectId, fieldId, sortOrder: nextOrder },
    });

    return this.customFieldDefToDto(field);
  }

  private customFieldDefToDto(field: {
    id: string;
    workspaceId: string;
    name: string;
    type: string;
    options: unknown;
    isRequired: boolean;
    createdAt: Date;
  }): CustomFieldDefinitionDto {
    return {
      id: field.id,
      workspaceId: field.workspaceId,
      name: field.name,
      type: field.type as CustomFieldDefinitionDto['type'],
      options: field.options as Record<string, any> | undefined,
      isRequired: field.isRequired,
      createdAt: field.createdAt,
    };
  }

  /** Map a Prisma project record (with usual includes) to API DTO. */
  toProjectDto(project: any): ProjectDto {
    const sections: SectionDto[] | undefined = project.sections?.map(
      (s: any) =>
        ({
          id: s.id,
          projectId: s.projectId,
          name: s.name,
          color: s.color,
          sortOrder: s.sortOrder,
          wipLimit: s.wipLimit ?? null,
          isDefault: s.isDefault,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          taskCount: s.tasks?.length,
          tasks: s.tasks?.map((t: any) => this.taskService.toTaskDto(t)),
        }) as SectionDto,
    );

    const workspaceIds: string[] = (project.workspaceLinks ?? []).map(
      (l: { workspaceId: string }) => l.workspaceId,
    );

    return {
      id: project.id,
      workspaceIds,
      teamId: project.teamId,
      createdById: project.createdById,
      name: project.name,
      description: project.description,
      color: project.color,
      emoji: project.emoji,
      status: project.status,
      isPrivate: project.isPrivate,
      isArchived: project.isArchived,
      isTemplate: project.isTemplate ?? false,
      startDate: project.startDate,
      dueDate: project.dueDate,
      defaultView: project.defaultView,
      kanbanWipEnforcement: project.kanbanWipEnforcement ?? 'OFF',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      sectionCount: project.sections?.length || 0,
      taskCount: Number(project.taskCount ?? project._count?.tasks ?? 0),
      completedTaskCount: Number(project.completedTaskCount ?? 0),
      memberCount: project.members?.length || 0,
      members: project.members,
      sections,
      sprints: project.sprints?.map((s: any) => this.toSprintDto(s)),
    };
  }

  private parseSprintDate(
    v: Date | string,
    field: string,
  ): Date {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return d;
  }

  private toSprintDto(s: {
    id: string;
    projectId: string;
    name: string;
    goal: string | null;
    startDate: Date;
    endDate: Date;
    state: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): SprintDto {
    return {
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      goal: s.goal,
      startDate: s.startDate,
      endDate: s.endDate,
      state: s.state as SprintDto['state'],
      sortOrder: s.sortOrder,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  async listSprints(projectId: string, userId: string): Promise<SprintDto[]> {
    await this.assertProjectAccess(projectId, userId);
    const rows = await this.prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((r) => this.toSprintDto(r));
  }

  async createSprint(
    projectId: string,
    userId: string,
    req: CreateSprintRequest,
  ): Promise<SprintDto> {
    await this.assertProjectAccess(projectId, userId);
    const name = req.name?.trim();
    if (!name) {
      throw new BadRequestException('Sprint name is required');
    }
    const startDate = this.parseSprintDate(req.startDate, 'startDate');
    const endDate = this.parseSprintDate(req.endDate, 'endDate');
    if (startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException('Sprint endDate must be after startDate');
    }
    const agg = await this.prisma.sprint.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    const created = await this.prisma.sprint.create({
      data: {
        projectId,
        name,
        goal: req.goal?.trim() || null,
        startDate,
        endDate,
        state: (req.state ?? 'PLANNED') as any,
        sortOrder,
      },
    });
    return this.toSprintDto(created);
  }

  async updateSprint(
    projectId: string,
    sprintId: string,
    userId: string,
    req: UpdateSprintRequest,
  ): Promise<SprintDto> {
    await this.assertProjectAccess(projectId, userId);
    const existing = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Sprint not found');
    }
    const startDate =
      req.startDate !== undefined
        ? this.parseSprintDate(req.startDate, 'startDate')
        : existing.startDate;
    const endDate =
      req.endDate !== undefined
        ? this.parseSprintDate(req.endDate, 'endDate')
        : existing.endDate;
    if (startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException('Sprint endDate must be after startDate');
    }
    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...(req.name !== undefined && { name: req.name.trim() }),
        ...(req.goal !== undefined && { goal: req.goal }),
        ...(req.startDate !== undefined && { startDate }),
        ...(req.endDate !== undefined && { endDate }),
        ...(req.state !== undefined && { state: req.state as any }),
        ...(req.sortOrder !== undefined && { sortOrder: req.sortOrder }),
      },
    });
    return this.toSprintDto(updated);
  }

  async deleteSprint(
    projectId: string,
    sprintId: string,
    userId: string,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, userId);
    const existing = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Sprint not found');
    }
    await this.prisma.sprint.delete({ where: { id: sprintId } });
  }

  /**
   * Burndown from tasks currently in the sprint + DONE completedAt (or updatedAt).
   * Does not use historical snapshots; scope changes if tasks move sprints.
   */
  async getSprintBurndown(
    projectId: string,
    sprintId: string,
    userId: string,
  ): Promise<SprintBurndownDto> {
    await this.assertProjectAccess(projectId, userId);
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        sprintId,
        projectId,
        deletedAt: null,
        isTemplate: false,
      },
      select: {
        status: true,
        storyPoints: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    const totalScope = tasks
      .filter((t) => t.status !== TaskStatus.CANCELLED)
      .reduce((s, t) => s + (t.storyPoints ?? 0), 0);

    const dayStarts = eachCalendarDayInclusive(sprint.startDate, sprint.endDate);
    const n = dayStarts.length;
    const firstKey = calendarDayToIsoKey(dayStarts[0]);
    const lastKey = calendarDayToIsoKey(dayStarts[dayStarts.length - 1]);
    const metricSnaps = await this.prisma.sprintMetricSnapshot.findMany({
      where: {
        sprintId,
        day: {
          gte: prismaDateFromIsoKey(firstKey),
          lte: prismaDateFromIsoKey(lastKey),
        },
      },
    });
    const snapByKey = new Map(
      metricSnaps.map((s) => [calendarDayToIsoKey(new Date(s.day)), s]),
    );

    const days = dayStarts.map((day, i) => {
      const key = calendarDayToIsoKey(day);
      const snap = snapByKey.get(key);
      const dayEnd = endOfCalendarDay(day);
      if (snap) {
        const ideal =
          n <= 1 ? 0 : snap.scopePoints * (1 - i / (n - 1));
        return {
          date: key,
          remaining: Math.round(snap.remainingPoints * 100) / 100,
          ideal: Math.round(ideal * 100) / 100,
        };
      }
      const remaining = tasks.reduce(
        (sum, t) => sum + storyPointsRemainingAtDayEnd(t, dayEnd),
        0,
      );
      const ideal = n <= 1 ? 0 : totalScope * (1 - i / (n - 1));
      return {
        date: key,
        remaining: Math.round(remaining * 100) / 100,
        ideal: Math.round(ideal * 100) / 100,
      };
    });

    return { sprintId, projectId, totalScope, days };
  }

  /**
   * Burnup: cumulative story points completed during the sprint through each day vs flat scope (current
   * non-cancelled points in sprint). Same snapshot caveats as burndown.
   */
  async getSprintBurnup(
    projectId: string,
    sprintId: string,
    userId: string,
  ): Promise<SprintBurnupDto> {
    await this.assertProjectAccess(projectId, userId);
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        sprintId,
        projectId,
        deletedAt: null,
        isTemplate: false,
      },
      select: {
        status: true,
        storyPoints: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    const totalScope = tasks
      .filter((t) => t.status !== TaskStatus.CANCELLED)
      .reduce((s, t) => s + (t.storyPoints ?? 0), 0);

    const sprintStartMs = startOfCalendarDay(sprint.startDate).getTime();
    const sprintEndMs = endOfCalendarDay(sprint.endDate).getTime();
    const dayStarts = eachCalendarDayInclusive(sprint.startDate, sprint.endDate);
    const firstKey = calendarDayToIsoKey(dayStarts[0]);
    const lastKey = calendarDayToIsoKey(dayStarts[dayStarts.length - 1]);
    const metricSnaps = await this.prisma.sprintMetricSnapshot.findMany({
      where: {
        sprintId,
        day: {
          gte: prismaDateFromIsoKey(firstKey),
          lte: prismaDateFromIsoKey(lastKey),
        },
      },
    });
    const snapByKey = new Map(
      metricSnaps.map((s) => [calendarDayToIsoKey(new Date(s.day)), s]),
    );

    const days = dayStarts.map((day) => {
      const key = calendarDayToIsoKey(day);
      const snap = snapByKey.get(key);
      const dayEnd = endOfCalendarDay(day);
      const upperMs = Math.min(dayEnd.getTime(), sprintEndMs);
      if (snap) {
        return {
          date: key,
          completedCumulative: Math.round(snap.completedCumulative * 100) / 100,
          scopeTotal: Math.round(snap.scopePoints * 100) / 100,
        };
      }
      const completedCumulative = completedCumulativeThroughDayEnd(
        tasks,
        sprintStartMs,
        upperMs,
      );
      return {
        date: key,
        completedCumulative,
        scopeTotal: Math.round(totalScope * 100) / 100,
      };
    });

    const initialScope = days.length > 0 ? days[0].scopeTotal : 0;
    const scopeChanges: SprintBurnupScopeChangeDto[] = [];
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1].scopeTotal;
      const cur = days[i].scopeTotal;
      if (Math.abs(cur - prev) > 1e-6) {
        scopeChanges.push({
          date: days[i].date,
          delta: Math.round((cur - prev) * 100) / 100,
          scopeAfter: Math.round(cur * 100) / 100,
        });
      }
    }

    return { sprintId, projectId, totalScope, initialScope, scopeChanges, days };
  }

  /**
   * Last N sprints by endDate (desc). Per sprint: DONE tasks completed within sprint calendar window,
   * still attributed to that sprint (sprintId match). Null storyPoints count as 0.
   */
  async getProjectSprintVelocity(
    projectId: string,
    userId: string,
    take: number,
  ): Promise<ProjectSprintVelocityDto> {
    await this.assertProjectAccess(projectId, userId);
    const n = Math.min(12, Math.max(1, take));
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId },
      orderBy: { endDate: 'desc' },
      take: n,
    });
    if (sprints.length === 0) {
      return { projectId, sprints: [], averageCompletedPoints: 0 };
    }
    const sprintIds = sprints.map((s) => s.id);
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        sprintId: { in: sprintIds },
        deletedAt: null,
        isTemplate: false,
        status: TaskStatus.DONE,
      },
      select: {
        sprintId: true,
        storyPoints: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    const bars: SprintVelocityBarDto[] = sprints.map((sp) => {
      const rangeStart = startOfCalendarDay(sp.startDate).getTime();
      const rangeEnd = endOfCalendarDay(sp.endDate).getTime();
      let completedPoints = 0;
      let completedTaskCount = 0;
      for (const t of tasks) {
        if (t.sprintId !== sp.id) continue;
        const at = (t.completedAt ?? t.updatedAt).getTime();
        if (at < rangeStart || at > rangeEnd) continue;
        completedPoints += t.storyPoints ?? 0;
        completedTaskCount += 1;
      }
      return {
        sprintId: sp.id,
        name: sp.name,
        startDate: sp.startDate.toISOString().slice(0, 10),
        endDate: sp.endDate.toISOString().slice(0, 10),
        state: sp.state as SprintVelocityBarDto['state'],
        completedPoints: Math.round(completedPoints * 100) / 100,
        completedTaskCount,
      };
    });

    const averageCompletedPoints =
      bars.length === 0
        ? 0
        : Math.round(
            (bars.reduce((s, b) => s + b.completedPoints, 0) / bars.length) *
              100,
          ) / 100;

    return { projectId, sprints: bars, averageCompletedPoints };
  }

  async getProjectCfd(
    projectId: string,
    userId: string,
    fromStr?: string,
    toStr?: string,
  ): Promise<ProjectCfdDto> {
    await this.assertProjectAccess(projectId, userId);
    const to = toStr ? startOfCalendarDay(new Date(toStr)) : startOfCalendarDay(new Date());
    let from = fromStr
      ? startOfCalendarDay(new Date(fromStr))
      : new Date(to);
    if (!fromStr) {
      from.setDate(from.getDate() - 89);
      from = startOfCalendarDay(from);
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be on or before to');
    }
    const { days, statusOrder } = await buildProjectCfdSeries(
      this.prisma,
      projectId,
      from,
      to,
    );
    return { projectId, days, statusOrder };
  }

  async getEpicRollups(
    projectId: string,
    userId: string,
  ): Promise<ProjectEpicRollupsDto> {
    await this.assertProjectAccess(projectId, userId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, isTemplate: false },
      select: {
        id: true,
        title: true,
        workItemType: true,
        parentTaskId: true,
        epicTaskId: true,
        storyPoints: true,
        status: true,
      },
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const children = new Map<string, string[]>();
    for (const t of tasks) {
      if (t.parentTaskId) {
        const c = children.get(t.parentTaskId) ?? [];
        c.push(t.id);
        children.set(t.parentTaskId, c);
      }
    }
    function collectDescendants(rootId: string): Set<string> {
      const out = new Set<string>();
      const stack = [...(children.get(rootId) ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        if (out.has(id)) continue;
        out.add(id);
        for (const c of children.get(id) ?? []) stack.push(c);
      }
      return out;
    }
    function collectEpicLinked(epicId: string, treeDesc: Set<string>): Set<string> {
      const all = new Set(treeDesc);
      for (const t of tasks) {
        if (t.epicTaskId === epicId) all.add(t.id);
      }
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of tasks) {
          if (all.has(t.id)) continue;
          if (t.epicTaskId && all.has(t.epicTaskId)) {
            all.add(t.id);
            grew = true;
          }
        }
      }
      return all;
    }
    const epics = tasks.filter((t) => t.workItemType === 'EPIC');
    const rows: EpicRollupDto[] = epics.map((epic) => {
      const desc = collectEpicLinked(epic.id, collectDescendants(epic.id));
      let storyPointsTotal = 0;
      let storyPointsDone = 0;
      let taskCount = 0;
      let doneCount = 0;
      for (const tid of desc) {
        const t = byId.get(tid);
        if (!t) continue;
        taskCount += 1;
        const pts = t.storyPoints ?? 0;
        storyPointsTotal += pts;
        if (t.status === TaskStatus.DONE) {
          doneCount += 1;
          storyPointsDone += pts;
        }
      }
      return {
        epicId: epic.id,
        title: epic.title,
        storyPointsTotal: Math.round(storyPointsTotal * 100) / 100,
        storyPointsDone: Math.round(storyPointsDone * 100) / 100,
        taskCount,
        doneCount,
      };
    });
    return { projectId, epics: rows };
  }

  private workloadSprintWhere(sprintFilter?: string): Prisma.TaskWhereInput {
    if (!sprintFilter || sprintFilter === 'all') {
      return {};
    }
    if (sprintFilter === 'backlog') {
      return { sprintId: null };
    }
    return { sprintId: sprintFilter };
  }

  private async epicSubtreeTaskIds(
    projectId: string,
    epicId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, parentTaskId: true, workItemType: true, epicTaskId: true },
    });
    const epic = rows.find((r) => r.id === epicId);
    if (!epic || epic.workItemType !== 'EPIC') {
      throw new BadRequestException('Invalid epic filter');
    }
    const byParent = new Map<string | null, string[]>();
    for (const t of rows) {
      const p = t.parentTaskId ?? null;
      const list = byParent.get(p) ?? [];
      list.push(t.id);
      byParent.set(p, list);
    }
    const out = new Set<string>();
    const stack = [epicId];
    while (stack.length) {
      const id = stack.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      for (const c of byParent.get(id) ?? []) {
        stack.push(c);
      }
    }
    for (const t of rows) {
      if (t.epicTaskId === epicId) out.add(t.id);
    }
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of rows) {
        if (out.has(t.id)) continue;
        if (t.epicTaskId && out.has(t.epicTaskId)) {
          out.add(t.id);
          grew = true;
        }
      }
    }
    return out;
  }

  async getProjectWorkload(
    projectId: string,
    userId: string,
    weeksRaw?: string,
    fromStr?: string,
    sprintFilterRaw?: string,
    epicFilterRaw?: string,
  ): Promise<ProjectWorkloadDto> {
    await this.assertProjectAccess(projectId, userId);
    const weekCountParsed = weeksRaw ? parseInt(weeksRaw, 10) : 12;
    const weekCount = Number.isFinite(weekCountParsed)
      ? Math.min(26, Math.max(4, weekCountParsed))
      : 12;

    let rangeStart: Date;
    if (fromStr) {
      const d = new Date(fromStr);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid from date');
      }
      rangeStart = startOfWeekMonday(startOfCalendarDay(d));
    } else {
      const t = startOfCalendarDay(new Date());
      rangeStart = startOfWeekMonday(t);
      rangeStart.setDate(rangeStart.getDate() - 28);
    }

    const weekStarts = enumerateWeekStarts(rangeStart, weekCount);

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      isTemplate: false,
      status: { notIn: WORKLOAD_TERMINAL },
      ...this.workloadSprintWhere(sprintFilterRaw),
    };

    if (epicFilterRaw && epicFilterRaw !== 'all') {
      if (epicFilterRaw.length < 8) {
        throw new BadRequestException('Invalid epic filter');
      }
      const allowed = await this.epicSubtreeTaskIds(projectId, epicFilterRaw);
      where.id = { in: [...allowed] };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        storyPoints: true,
        startDate: true,
        dueDate: true,
        assignees: {
          include: { user: { select: { displayName: true } } },
        },
      },
    });

    return buildProjectWorkloadDto(projectId, weekStarts, tasks);
  }

  private static readonly SAVED_VIEW_NAME_MAX = 120;
  private static readonly SAVED_VIEWS_PER_PROJECT_MAX = 100;

  private normalizeSavedViewConfig(raw: unknown): ProjectSavedViewConfigDto {
    if (raw == null || typeof raw !== 'object') return {};
    const o = raw as Record<string, unknown>;
    const out: ProjectSavedViewConfigDto = {};
    const sf = o.sprintFilter;
    if (typeof sf === 'string') {
      if (sf === 'all' || sf === 'backlog' || sf.length >= 8) {
        out.sprintFilter = sf;
      }
    }
    const ef = o.epicFilter;
    if (typeof ef === 'string') {
      if (ef === 'all' || ef.length >= 8) {
        out.epicFilter = ef;
      }
    }
    if (typeof o.rootsOnly === 'boolean') {
      out.rootsOnly = o.rootsOnly;
    }
    if (
      o.surface === 'list' ||
      o.surface === 'board' ||
      o.surface === 'backlog' ||
      o.surface === 'sprint-board' ||
      o.surface === 'roadmap' ||
      o.surface === 'epics' ||
      o.surface === 'timeline' ||
      o.surface === 'calendar' ||
      o.surface === 'burndown' ||
      o.surface === 'flow' ||
      o.surface === 'workload' ||
      o.surface === 'activity'
    ) {
      out.surface = o.surface;
    }
    const ww = o.workloadWeeks;
    if (typeof ww === 'number' && Number.isFinite(ww)) {
      const n = Math.round(ww);
      if (n >= 4 && n <= 26) {
        out.workloadWeeks = n;
      }
    } else if (typeof ww === 'string' && /^\d+$/.test(ww)) {
      const n = parseInt(ww, 10);
      if (n >= 4 && n <= 26) {
        out.workloadWeeks = n;
      }
    }
    const wf = o.workloadFrom;
    if (typeof wf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wf.trim())) {
      out.workloadFrom = wf.trim();
    }
    return out;
  }

  private toSavedViewDto(row: {
    id: string;
    projectId: string;
    createdById: string;
    name: string;
    config: Prisma.JsonValue;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectSavedViewDto {
    return {
      id: row.id,
      projectId: row.projectId,
      createdById: row.createdById,
      name: row.name,
      config: this.normalizeSavedViewConfig(row.config),
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async assertSavedViewMutate(
    projectId: string,
    viewCreatedById: string,
    userId: string,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, userId);
    const proj = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { createdById: true },
    });
    if (!proj) {
      throw new NotFoundException('Project not found');
    }
    if (viewCreatedById === userId || proj.createdById === userId) {
      return;
    }
    throw new ForbiddenException('You cannot change this saved view');
  }

  async listProjectSavedViews(
    projectId: string,
    userId: string,
  ): Promise<ProjectSavedViewDto[]> {
    await this.assertProjectAccess(projectId, userId);
    const rows = await this.prisma.projectSavedView.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toSavedViewDto(r));
  }

  async createProjectSavedView(
    projectId: string,
    userId: string,
    body: CreateProjectSavedViewRequest,
  ): Promise<ProjectSavedViewDto> {
    await this.assertProjectAccess(projectId, userId);
    const name = (body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    if (name.length > ProjectService.SAVED_VIEW_NAME_MAX) {
      throw new BadRequestException(
        `name must be at most ${ProjectService.SAVED_VIEW_NAME_MAX} characters`,
      );
    }
    const count = await this.prisma.projectSavedView.count({
      where: { projectId },
    });
    if (count >= ProjectService.SAVED_VIEWS_PER_PROJECT_MAX) {
      throw new BadRequestException(
        `At most ${ProjectService.SAVED_VIEWS_PER_PROJECT_MAX} saved views per project`,
      );
    }
    const config = this.normalizeSavedViewConfig(body.config);
    const row = await this.prisma.projectSavedView.create({
      data: {
        projectId,
        createdById: userId,
        name,
        config: config as Prisma.InputJsonValue,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return this.toSavedViewDto(row);
  }

  async updateProjectSavedView(
    projectId: string,
    viewId: string,
    userId: string,
    body: UpdateProjectSavedViewRequest,
  ): Promise<ProjectSavedViewDto> {
    const existing = await this.prisma.projectSavedView.findFirst({
      where: { id: viewId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Saved view not found');
    }
    await this.assertSavedViewMutate(
      projectId,
      existing.createdById,
      userId,
    );
    const patch: Prisma.ProjectSavedViewUpdateInput = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      if (name.length > ProjectService.SAVED_VIEW_NAME_MAX) {
        throw new BadRequestException(
          `name must be at most ${ProjectService.SAVED_VIEW_NAME_MAX} characters`,
        );
      }
      patch.name = name;
    }
    if (body.config !== undefined) {
      patch.config = this.normalizeSavedViewConfig(
        body.config,
      ) as Prisma.InputJsonValue;
    }
    if (body.sortOrder !== undefined) {
      patch.sortOrder = body.sortOrder;
    }
    if (Object.keys(patch).length === 0) {
      return this.toSavedViewDto(existing);
    }
    const row = await this.prisma.projectSavedView.update({
      where: { id: viewId },
      data: patch,
    });
    return this.toSavedViewDto(row);
  }

  async deleteProjectSavedView(
    projectId: string,
    viewId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.projectSavedView.findFirst({
      where: { id: viewId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('Saved view not found');
    }
    await this.assertSavedViewMutate(
      projectId,
      existing.createdById,
      userId,
    );
    await this.prisma.projectSavedView.delete({ where: { id: viewId } });
  }

  /**
   * Reorder saved views for everyone on the project (any member with project access).
   * `orderedIds` must be a permutation of all saved view ids for this project.
   */
  async reorderProjectSavedViews(
    projectId: string,
    userId: string,
    orderedIds: string[],
  ): Promise<ProjectSavedViewDto[]> {
    await this.assertProjectAccess(projectId, userId);
    if (!orderedIds?.length) {
      throw new BadRequestException('orderedIds must not be empty');
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new BadRequestException('orderedIds must be unique');
    }
    const rows = await this.prisma.projectSavedView.findMany({
      where: { projectId },
      select: { id: true },
    });
    if (rows.length !== orderedIds.length) {
      throw new BadRequestException(
        'orderedIds must include every saved view for this project',
      );
    }
    const idSet = new Set(rows.map((r) => r.id));
    for (const id of orderedIds) {
      if (!idSet.has(id)) {
        throw new BadRequestException('Invalid saved view id in orderedIds');
      }
    }
    await this.prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        this.prisma.projectSavedView.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    return this.listProjectSavedViews(projectId, userId);
  }
}
