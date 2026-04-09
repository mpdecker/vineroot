import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { TaskService } from '../task/task.service';
import type {
  EvmEarnedValueBasis,
  EvmPvModel,
  OverallocationBucketDto,
  ProjectBaselineSummaryDto,
  ProjectCriticalPathDto,
  ProjectEvmBudgetRollupDto,
  ProjectEvmSummaryDto,
  ProjectLevelRequest,
  ProjectLevelResultDto,
  ProjectScheduleNetworkDto,
  ProjectScheduleTimephasedCellDto,
  ProjectScheduleTimephasedDto,
  ProjectScheduleTimephasedResourceCellDto,
  ScheduleEvmQueryOptions,
  ScheduleTimephasedBasis,
  ScheduleOverallocationsQueryDto,
  TaskBaselineCompareRowDto,
  TaskBaselineRowDto,
  TaskEvmRowDto,
  TaskScheduleResultDto,
} from '@vineroot/shared-types';
import { SCHEDULE_BASELINE_INDEX_MAX } from '@vineroot/shared-types';
import {
  addCalendarDaysToDateKey,
  dateKeyInTimeZone,
  dateKeyUTC,
  defaultWeeklyPattern,
  durationWorkingDaysBetween,
  endDayInclusive,
  enumerateDateKeysInclusiveInTz,
  normalizeExceptions,
  normalizeScheduleTimeZone,
  normalizeWeeklyPattern,
  nextWorkingDayAfter,
  signedWorkingDayVarianceBetween,
  sumWorkingMinutesInclusiveRange,
  weekStartMondayDateKeyInTimeZone,
  workingMinutesOnDateKey,
  workingMinutesOnDay,
  zonedNoonFromDateKey,
  type CalendarException,
  type WeeklyPattern,
} from './schedule-calendar.util';
import {
  runScheduleEngine,
  type CalendarInput,
  type EngineDepInput,
  type EngineScheduleMode,
  type EngineTaskInput,
} from './schedule-engine.util';
import {
  addUtcDays,
  allocateIntegerByWeights,
  computeTaskTimephasedCells,
  type WorkingBasisPack,
} from './schedule-timephased.util';
import type { TaskWorkContour } from '@vineroot/shared-types';

const LEVEL_SHIFTS_INNER_CAP = 12;

type ProjectCalPack = {
  weekly: WeeklyPattern;
  exceptions: CalendarException[];
  tz: string;
};

type OverallocationAgg = {
  granularity: 'day' | 'week';
  periodStart: string;
  resourceKind: 'user' | 'generic_resource';
  userId?: string;
  genericResourceId?: string;
  genericResourceName?: string;
  capacityMinutes: number;
  allocatedMinutes: number;
  taskIds: Set<string>;
  projectIds: Set<string>;
};

@Injectable()
export class ScheduleProjectService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    @Inject(forwardRef(() => TaskService))
    private taskService: TaskService,
  ) {}

  /** Project calendar, else first workspace-default calendar linked to the project (by name order). */
  private async resolveEffectiveCalendarInput(projectId: string): Promise<{
    weeklyPattern: unknown;
    exceptions: unknown;
    timeZone: string;
  } | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workCalendar: true,
        workspaceLinks: { select: { workspaceId: true } },
      },
    });
    if (!project) return null;
    if (project.workCalendar) {
      return {
        weeklyPattern: project.workCalendar.weeklyPattern,
        exceptions: project.workCalendar.exceptions,
        timeZone: project.workCalendar.timeZone ?? 'UTC',
      };
    }
    const wsIds = project.workspaceLinks.map((l) => l.workspaceId);
    if (wsIds.length === 0) return null;
    const fallback = await this.prisma.workCalendar.findFirst({
      where: { workspaceId: { in: wsIds }, isDefault: true },
      orderBy: { name: 'asc' },
    });
    if (!fallback) return null;
    return {
      weeklyPattern: fallback.weeklyPattern,
      exceptions: fallback.exceptions,
      timeZone: fallback.timeZone ?? 'UTC',
    };
  }

  private async assertProjectAccess(
    projectId: string,
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
  }

  private assertBaselineIndex(baselineIndex: number): void {
    if (baselineIndex < 0 || baselineIndex > SCHEDULE_BASELINE_INDEX_MAX) {
      throw new BadRequestException(
        `baselineIndex must be 0–${SCHEDULE_BASELINE_INDEX_MAX} inclusive`,
      );
    }
  }

  private calendarInputFromRow(row: {
    weeklyPattern: unknown;
    exceptions: unknown;
    timeZone: string | null;
  }): CalendarInput {
    return {
      weeklyPattern: row.weeklyPattern,
      exceptions: row.exceptions,
      timeZone: row.timeZone ?? 'UTC',
    };
  }

  /** Effective calendar inputs per task (task → assignee → project default). */
  private async buildTaskCalendarMap(
    workspaceIds: string[],
    defaultCal: CalendarInput | null,
    tasks: Array<{
      id: string;
      workCalendarId: string | null;
      workCalendar: {
        weeklyPattern: unknown;
        exceptions: unknown;
        timeZone: string | null;
      } | null;
      assignees: Array<{
        user: {
          workCalendarId: string | null;
          workCalendar: {
            weeklyPattern: unknown;
            exceptions: unknown;
            timeZone: string | null;
          } | null;
        };
      }>;
    }>,
  ): Promise<Map<string, CalendarInput>> {
    const map = new Map<string, CalendarInput>();
    const fallback: CalendarInput =
      defaultCal ??
      ({
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
      } as CalendarInput);

    const calIds = new Set<string>();
    for (const t of tasks) {
      if (t.workCalendarId) calIds.add(t.workCalendarId);
      for (const a of t.assignees ?? []) {
        if (a.user?.workCalendarId) calIds.add(a.user.workCalendarId);
      }
    }
    const rows =
      calIds.size > 0 && workspaceIds.length > 0
        ? await this.prisma.workCalendar.findMany({
            where: {
              id: { in: [...calIds] },
              workspaceId: { in: workspaceIds },
            },
          })
        : [];
    const calById = new Map(rows.map((c) => [c.id, c]));
    for (const t of tasks) {
      let row = t.workCalendar;
      if (!row && t.workCalendarId) {
        const hit = calById.get(t.workCalendarId);
        if (hit) row = hit;
      }
      if (!row) {
        for (const a of t.assignees ?? []) {
          if (a.user?.workCalendar) {
            row = a.user.workCalendar;
            break;
          }
          const uid = a.user?.workCalendarId;
          if (uid && calById.has(uid)) {
            row = calById.get(uid)!;
            break;
          }
        }
      }
      map.set(t.id, row ? this.calendarInputFromRow(row) : fallback);
    }
    return map;
  }

  /** Focal project plus every project in the same schedule program(s) — all must be accessible for merged CPM. */
  private async assertScheduleScopeAccess(
    focalProjectId: string,
    userId: string,
  ): Promise<void> {
    await this.assertProjectAccess(focalProjectId, userId);
    const scopeIds = await this.resolveScheduleProgramScopeProjectIds(focalProjectId);
    for (const pid of scopeIds) {
      if (pid === focalProjectId) continue;
      await this.assertProjectAccess(pid, userId);
    }
  }

  async recalculate(
    projectId: string,
    userId: string,
  ): Promise<ProjectCriticalPathDto> {
    await this.assertScheduleScopeAccess(projectId, userId);
    let cp: ProjectCriticalPathDto;
    let persistRows: TaskScheduleResultDto[];
    try {
      const run = await this.computeScheduleInternal(projectId);
      cp = run.response;
      persistRows = run.persistRows;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('Cyclic')) {
        throw new BadRequestException(
          'Cannot schedule project: cyclic task dependencies',
        );
      }
      throw e;
    }

    for (const row of persistRows) {
      const t = await this.prisma.task.findUnique({
        where: { id: row.taskId },
        select: { isManuallyScheduled: true },
      });
      if (!t || t.isManuallyScheduled) continue;
      if (!row.startDate || !row.dueDate) continue;
      await this.prisma.task.update({
        where: { id: row.taskId },
        data: {
          startDate: new Date(row.startDate),
          dueDate: new Date(row.dueDate),
        },
      });
      const dto = await this.taskService.findById(row.taskId);
      if (dto) await this.taskService.broadcastTaskUpdated(dto);
    }

    return cp;
  }

  async getCriticalPath(
    projectId: string,
    userId: string,
  ): Promise<ProjectCriticalPathDto> {
    await this.assertScheduleScopeAccess(projectId, userId);
    return (await this.computeScheduleInternal(projectId)).response;
  }

  /**
   * All projects that share a schedule program with `focalProjectId` (union if focal is in multiple programs).
   * Single-project when focal is not linked to any program.
   */
  private async resolveScheduleProgramScopeProjectIds(
    focalProjectId: string,
  ): Promise<string[]> {
    const links = await this.prisma.scheduleProgramProject.findMany({
      where: { projectId: focalProjectId },
      select: { programId: true },
    });
    if (links.length === 0) {
      return [focalProjectId];
    }
    const programIds = [...new Set(links.map((l) => l.programId))];
    const members = await this.prisma.scheduleProgramProject.findMany({
      where: { programId: { in: programIds } },
      select: { projectId: true },
    });
    return [...new Set(members.map((m) => m.projectId))];
  }

  /**
   * One CPM pass over focal project only, or over the merged program set when focal is in a schedule program.
   * Response lists only focal-project tasks; `persistRows` includes every task in the merged graph for recalculate.
   */
  private async computeScheduleInternal(projectId: string): Promise<{
    response: ProjectCriticalPathDto;
    persistRows: TaskScheduleResultDto[];
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspaceLinks: { select: { workspaceId: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');

    const workspaceIds = project.workspaceLinks.map((l) => l.workspaceId);

    const scopeProjectIds = await this.resolveScheduleProgramScopeProjectIds(projectId);

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: scopeProjectIds },
        deletedAt: null,
        isTemplate: false,
      },
      include: {
        dependencies: true,
        assignees: {
          include: {
            user: {
              include: {
                workCalendar: {
                  select: {
                    weeklyPattern: true,
                    exceptions: true,
                    timeZone: true,
                  },
                },
              },
            },
          },
        },
        workCalendar: {
          select: { weeklyPattern: true, exceptions: true, timeZone: true },
        },
      },
    });

    const depsRows = await this.prisma.taskDependency.findMany({
      where: {
        dependentTask: {
          projectId: { in: scopeProjectIds },
          deletedAt: null,
          isTemplate: false,
        },
        blockingTask: {
          projectId: { in: scopeProjectIds },
          deletedAt: null,
          isTemplate: false,
        },
      },
    });

    const focalTaskIds = new Set(
      tasks.filter((t) => t.projectId === projectId).map((t) => t.id),
    );

    const focalTasks = tasks.filter((t) => t.projectId === projectId);
    const projectStart =
      project.startDate ??
      focalTasks.map((t) => t.startDate).find(Boolean) ??
      new Date();

    const cal = await this.resolveEffectiveCalendarInput(projectId);
    const defaultCalInput: CalendarInput | null = cal
      ? {
          weeklyPattern: cal.weeklyPattern,
          exceptions: cal.exceptions,
          timeZone: cal.timeZone,
        }
      : null;

    const taskCalendarById = await this.buildTaskCalendarMap(
      workspaceIds,
      defaultCalInput,
      tasks,
    );

    const dayKeyForTask = (taskId: string, d: Date) => {
      const c = taskCalendarById.get(taskId);
      const tz = normalizeScheduleTimeZone(c?.timeZone);
      return tz === 'UTC' ? dateKeyUTC(d) : dateKeyInTimeZone(d, tz);
    };

    const engineTasks: EngineTaskInput[] = tasks.map((t) => {
      const sumU = (t.assignees ?? []).reduce(
        (s, a) =>
          s +
          (typeof a.unitsPercent === 'number' && Number.isFinite(a.unitsPercent)
            ? a.unitsPercent
            : 100),
        0,
      );
      return {
        id: t.id,
        parentTaskId: t.parentTaskId,
        startDate: t.startDate,
        dueDate: t.dueDate,
        isManuallyScheduled: t.isManuallyScheduled,
        isMilestone: t.isMilestone,
        isSummaryRollup: t.isSummaryRollup,
        constraintType: t.constraintType,
        constraintDate: t.constraintDate,
        deadlineDate: t.deadlineDate,
        durationWorkingMinutes: t.durationWorkingMinutes,
        workMinutes: t.workMinutes,
        scheduleMode: t.scheduleMode as EngineScheduleMode,
        assigneeUnitsSum: sumU > 0 ? sumU : 100,
        effortDriven: t.effortDriven,
        sortOrder: t.sortOrder,
      };
    });

    const engineDeps: EngineDepInput[] = depsRows.map((d) => ({
      dependentId: d.dependentId,
      blockingId: d.blockingId,
      linkType: d.linkType,
      lagDays: d.lagDays,
      lagIsElapsed: d.lagIsElapsed,
    }));

    const { tasks: out, criticalTaskIds, diagnostics, drivingEdges } =
      runScheduleEngine({
        tasks: engineTasks,
        deps: engineDeps,
        projectStart,
        projectFinishHint: project.dueDate,
        defaultCalendar: defaultCalInput ?? undefined,
        taskCalendarById,
      });

    const toRow = (r: (typeof out)[0]): TaskScheduleResultDto => ({
      taskId: r.taskId,
      startDate: dayKeyForTask(r.taskId, r.earlyStart),
      dueDate: dayKeyForTask(r.taskId, r.earlyFinish),
      earlyStartDay: dayKeyForTask(r.taskId, r.earlyStart),
      earlyFinishDay: dayKeyForTask(r.taskId, r.earlyFinish),
      totalSlackDays: r.totalSlackDays,
      totalSlackWorkingDays: r.totalSlackWorkingDays,
      deadlineViolated: r.deadlineViolated,
    });

    const persistRows = out.map(toRow);
    const focalRows = persistRows.filter((row) => focalTaskIds.has(row.taskId));
    const focalCritical = criticalTaskIds.filter((id) => focalTaskIds.has(id));

    const focalDriving = drivingEdges.filter((e) => focalTaskIds.has(e.toTaskId));

    return {
      response: {
        projectId,
        criticalTaskIds: focalCritical,
        tasks: focalRows,
        diagnostics: diagnostics.map((d) => ({
          taskId: d.taskId,
          code: d.code,
          message: d.message,
        })),
        drivingEdges: focalDriving,
      },
      persistRows,
    };
  }

  private async computeCriticalPathInternal(
    projectId: string,
  ): Promise<ProjectCriticalPathDto> {
    return (await this.computeScheduleInternal(projectId)).response;
  }

  /** Calendar-day delta: current minus baseline (positive = later). */
  private calendarDayVarianceUtc(
    baseline: Date | null,
    current: Date | null,
  ): number | null {
    if (!baseline || !current) return null;
    const b = Date.UTC(
      baseline.getUTCFullYear(),
      baseline.getUTCMonth(),
      baseline.getUTCDate(),
    );
    const c = Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    );
    return Math.round((c - b) / 86_400_000);
  }

  private computeUserLaborCostDollars(t: {
    workMinutes: number | null;
    estimatedMin: number | null;
    overtimeWorkMinutes?: number | null;
    assignees: Array<{
      unitsPercent: number;
      workMinutes: number | null;
      user: {
        resourceStandardRatePerHour: Prisma.Decimal | null;
        resourceOvertimeRatePerHour?: Prisma.Decimal | null;
      };
    }>;
  }): number {
    const assignees = t.assignees ?? [];
    const hasAssigneeWork = assignees.some(
      (a) => a.workMinutes != null && a.workMinutes > 0,
    );

    type Portion = { mi: number; std: number; ot: number };
    const portions: Portion[] = [];

    if (hasAssigneeWork) {
      for (const a of assignees) {
        const wm = a.workMinutes;
        if (wm == null || wm <= 0) continue;
        const std = a.user.resourceStandardRatePerHour
          ? Number(a.user.resourceStandardRatePerHour)
          : 0;
        if (std <= 0) continue;
        const otRaw = a.user.resourceOvertimeRatePerHour;
        const ot =
          otRaw != null && Number(otRaw) > 0
            ? Number(otRaw)
            : std;
        portions.push({ mi: wm, std, ot });
      }
    } else {
      const workMin = t.workMinutes ?? t.estimatedMin ?? null;
      if (workMin == null) return 0;
      for (const a of assignees) {
        const portion = (a.unitsPercent / 100) * workMin;
        if (portion <= 0) continue;
        const std = a.user.resourceStandardRatePerHour
          ? Number(a.user.resourceStandardRatePerHour)
          : 0;
        if (std <= 0) continue;
        const otRaw = a.user.resourceOvertimeRatePerHour;
        const ot =
          otRaw != null && Number(otRaw) > 0
            ? Number(otRaw)
            : std;
        portions.push({ mi: portion, std, ot });
      }
    }

    const totalM = portions.reduce((s, p) => s + p.mi, 0);
    if (totalM <= 0) return 0;

    const rawOt = Math.min(
      Math.max(0, t.overtimeWorkMinutes ?? 0),
      totalM,
    );

    let sumNum = 0;
    for (const p of portions) {
      const share = p.mi / totalM;
      const ot_i = rawOt * share;
      const reg_i = p.mi - ot_i;
      sumNum += (reg_i / 60) * p.std + (ot_i / 60) * p.ot;
    }
    return sumNum;
  }

  private computeGenericLaborCostDollars(t: {
    workMinutes: number | null;
    estimatedMin: number | null;
    genericResourceAssignments: Array<{
      unitsPercent: number;
      genericResource: { standardRatePerHour: Prisma.Decimal | null };
    }>;
  }): number {
    const workMin = t.workMinutes ?? t.estimatedMin ?? null;
    if (workMin == null) return 0;
    let sumNum = 0;
    for (const g of t.genericResourceAssignments ?? []) {
      const r = g.genericResource.standardRatePerHour;
      if (!r) continue;
      const portion = (g.unitsPercent / 100) * workMin;
      sumNum += Number(r) * (portion / 60);
    }
    return sumNum;
  }

  /** Fixed + per-use + user labor + generic labor (MSP-style composite BAC). */
  private computeTaskEstimatedCostFromLoadedTask(t: {
    fixedCost: Prisma.Decimal | null;
    workMinutes: number | null;
    estimatedMin: number | null;
    overtimeWorkMinutes?: number | null;
    assignees: Array<{
      unitsPercent: number;
      workMinutes: number | null;
      costPerUse: Prisma.Decimal | null;
      user: {
        resourceStandardRatePerHour: Prisma.Decimal | null;
        resourceOvertimeRatePerHour?: Prisma.Decimal | null;
      };
    }>;
    genericResourceAssignments: Array<{
      unitsPercent: number;
      costPerUse?: Prisma.Decimal | null;
      genericResource: { standardRatePerHour: Prisma.Decimal | null };
    }>;
  }): Prisma.Decimal | null {
    let sum = 0;
    let has = false;
    if (t.fixedCost != null) {
      sum += Number(t.fixedCost);
      has = true;
    }
    for (const a of t.assignees ?? []) {
      if (a.costPerUse != null && Number(a.costPerUse) > 0) {
        sum += Number(a.costPerUse);
        has = true;
      }
    }
    for (const g of t.genericResourceAssignments ?? []) {
      if (g.costPerUse != null && Number(g.costPerUse) > 0) {
        sum += Number(g.costPerUse);
        has = true;
      }
    }
    const uLab = this.computeUserLaborCostDollars(t);
    if (uLab > 0) {
      sum += uLab;
      has = true;
    }
    const gLab = this.computeGenericLaborCostDollars(t);
    if (gLab > 0) {
      sum += gLab;
      has = true;
    }
    const workMin = t.workMinutes ?? t.estimatedMin ?? null;
    if (!has && workMin != null) {
      return new Prisma.Decimal(0);
    }
    return has ? new Prisma.Decimal(sum) : null;
  }

  /** Labor ($) vs non-labor ($) for EVM PV split (fixed + per-use vs hourly labor). */
  private computeTaskLaborNonLaborDollars(t: {
    fixedCost: Prisma.Decimal | null;
    workMinutes: number | null;
    estimatedMin: number | null;
    overtimeWorkMinutes?: number | null;
    assignees: Array<{
      unitsPercent: number;
      workMinutes: number | null;
      costPerUse: Prisma.Decimal | null;
      user: {
        resourceStandardRatePerHour: Prisma.Decimal | null;
        resourceOvertimeRatePerHour?: Prisma.Decimal | null;
      };
    }>;
    genericResourceAssignments: Array<{
      unitsPercent: number;
      costPerUse?: Prisma.Decimal | null;
      genericResource: { standardRatePerHour: Prisma.Decimal | null };
    }>;
  }): { labor: number; nonLabor: number } {
    let nonLabor = 0;
    if (t.fixedCost != null) nonLabor += Number(t.fixedCost);
    for (const a of t.assignees ?? []) {
      if (a.costPerUse != null && Number(a.costPerUse) > 0) {
        nonLabor += Number(a.costPerUse);
      }
    }
    for (const g of t.genericResourceAssignments ?? []) {
      if (g.costPerUse != null && Number(g.costPerUse) > 0) {
        nonLabor += Number(g.costPerUse);
      }
    }
    const labor =
      this.computeUserLaborCostDollars(t) +
      this.computeGenericLaborCostDollars(t);
    return { labor, nonLabor };
  }

  async saveBaseline(
    projectId: string,
    userId: string,
    baselineIndex = 0,
  ): Promise<{ saved: number }> {
    await this.assertProjectAccess(projectId, userId);
    this.assertBaselineIndex(baselineIndex);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, isTemplate: false },
      include: {
        assignees: { include: { user: true } },
        genericResourceAssignments: { include: { genericResource: true } },
      },
    });

    let saved = 0;
    for (const t of tasks) {
      const workMin = t.workMinutes ?? t.estimatedMin ?? null;
      const cost = this.computeTaskEstimatedCostFromLoadedTask(t);
      await this.prisma.taskBaseline.upsert({
        where: {
          taskId_baselineIndex: { taskId: t.id, baselineIndex },
        },
        create: {
          taskId: t.id,
          baselineIndex,
          baselineStart: t.startDate,
          baselineFinish: t.dueDate,
          baselineWorkMinutes: workMin,
          baselineCost: cost,
        },
        update: {
          baselineStart: t.startDate,
          baselineFinish: t.dueDate,
          baselineWorkMinutes: workMin,
          baselineCost: cost,
        },
      });
      saved += 1;
    }
    return { saved };
  }

  async clearBaseline(
    projectId: string,
    userId: string,
    baselineIndex = 0,
  ): Promise<{ deleted: number }> {
    await this.assertProjectAccess(projectId, userId);
    this.assertBaselineIndex(baselineIndex);
    const result = await this.prisma.taskBaseline.deleteMany({
      where: {
        baselineIndex,
        task: { projectId, deletedAt: null },
      },
    });
    return { deleted: result.count };
  }

  private async fetchProjectBaselineCompareRows(
    projectId: string,
    baselineIndex: number,
    taskId?: string,
  ): Promise<TaskBaselineCompareRowDto[]> {
    const where: Prisma.TaskBaselineWhereInput = {
      baselineIndex,
      task: { projectId, deletedAt: null, isTemplate: false },
    };
    if (taskId) where.taskId = taskId;

    const calInput = await this.resolveEffectiveCalendarInput(projectId);
    const weekly = calInput ? normalizeWeeklyPattern(calInput.weeklyPattern) : null;
    const exceptions = calInput ? normalizeExceptions(calInput.exceptions) : [];
    const calTz = calInput?.timeZone ?? 'UTC';

    const rows = await this.prisma.taskBaseline.findMany({
      where,
      include: {
        task: {
          include: {
            assignees: { include: { user: true } },
            genericResourceAssignments: { include: { genericResource: true } },
          },
        },
      },
      orderBy: { taskId: 'asc' },
    });

    return rows.map((r) => {
      const t = r.task;
      const workMin = t.workMinutes ?? t.estimatedMin ?? null;
      const costDec = this.computeTaskEstimatedCostFromLoadedTask(t);
      const currentCost = costDec ? Number(costDec) : null;
      const baseCost = r.baselineCost ? Number(r.baselineCost) : null;

      const startVarianceWorkingDays =
        weekly && r.baselineStart && t.startDate
          ? signedWorkingDayVarianceBetween(
              r.baselineStart,
              t.startDate,
              weekly,
              exceptions,
              calTz,
            )
          : null;
      const finishVarianceWorkingDays =
        weekly && r.baselineFinish && t.dueDate
          ? signedWorkingDayVarianceBetween(
              r.baselineFinish,
              t.dueDate,
              weekly,
              exceptions,
              calTz,
            )
          : null;

      return {
        taskId: r.taskId,
        baselineIndex: r.baselineIndex,
        baselineStart: r.baselineStart ? r.baselineStart.toISOString() : null,
        baselineFinish: r.baselineFinish ? r.baselineFinish.toISOString() : null,
        baselineWorkMinutes: r.baselineWorkMinutes,
        baselineCost: baseCost,
        currentStart: t.startDate ? t.startDate.toISOString() : null,
        currentFinish: t.dueDate ? t.dueDate.toISOString() : null,
        currentWorkMinutes: workMin,
        currentCost,
        startVarianceDays: this.calendarDayVarianceUtc(
          r.baselineStart,
          t.startDate,
        ),
        finishVarianceDays: this.calendarDayVarianceUtc(
          r.baselineFinish,
          t.dueDate,
        ),
        startVarianceWorkingDays,
        finishVarianceWorkingDays,
        workVarianceMinutes:
          workMin != null && r.baselineWorkMinutes != null
            ? workMin - r.baselineWorkMinutes
            : null,
        costVariance:
          currentCost != null && baseCost != null
            ? currentCost - baseCost
            : null,
        savedAt: r.createdAt.toISOString(),
      };
    });
  }

  async compareBaselines(
    projectId: string,
    userId: string,
    baselineIndex = 0,
    taskId?: string,
  ): Promise<TaskBaselineCompareRowDto[]> {
    await this.assertProjectAccess(projectId, userId);
    this.assertBaselineIndex(baselineIndex);
    return this.fetchProjectBaselineCompareRows(
      projectId,
      baselineIndex,
      taskId,
    );
  }

  async getBaselineSummary(
    projectId: string,
    userId: string,
    baselineIndex = 0,
  ): Promise<ProjectBaselineSummaryDto> {
    await this.assertProjectAccess(projectId, userId);
    this.assertBaselineIndex(baselineIndex);

    const projectTaskCount = await this.prisma.task.count({
      where: { projectId, deletedAt: null, isTemplate: false },
    });

    const rows = await this.fetchProjectBaselineCompareRows(
      projectId,
      baselineIndex,
    );

    const latestAgg = await this.prisma.taskBaseline.aggregate({
      where: {
        baselineIndex,
        task: { projectId, deletedAt: null, isTemplate: false },
      },
      _max: { createdAt: true },
    });

    let finishLateCount = 0;
    let finishEarlyCount = 0;
    let finishOnTimeCount = 0;
    const finishVals: number[] = [];
    let sumFinish = 0;
    let sumWork = 0;
    let sumCost = 0;
    let workCount = 0;
    let costCount = 0;
    let maxSlip: number | null = null;
    const finishWorkVals: number[] = [];
    let sumFinishWork = 0;
    let maxSlipWork: number | null = null;

    for (const r of rows) {
      const fv = r.finishVarianceDays;
      if (fv !== null) {
        finishVals.push(fv);
        sumFinish += fv;
        if (fv > 0) {
          finishLateCount += 1;
          maxSlip = maxSlip == null ? fv : Math.max(maxSlip, fv);
        } else if (fv < 0) {
          finishEarlyCount += 1;
        } else {
          finishOnTimeCount += 1;
        }
      }
      const fw = r.finishVarianceWorkingDays;
      if (fw !== null) {
        finishWorkVals.push(fw);
        sumFinishWork += fw;
        if (fw > 0) {
          maxSlipWork = maxSlipWork == null ? fw : Math.max(maxSlipWork, fw);
        }
      }
      if (r.workVarianceMinutes != null) {
        sumWork += r.workVarianceMinutes;
        workCount += 1;
      }
      if (r.costVariance != null) {
        sumCost += r.costVariance;
        costCount += 1;
      }
    }

    const nFinish = finishVals.length;
    const avgFinish =
      nFinish > 0 ? sumFinish / nFinish : null;
    const nFinishWork = finishWorkVals.length;
    const avgFinishWork =
      nFinishWork > 0 ? sumFinishWork / nFinishWork : null;

    return {
      projectId,
      baselineIndex,
      projectTaskCount,
      tasksWithBaselineCount: rows.length,
      finishLateCount,
      finishEarlyCount,
      finishOnTimeCount,
      avgFinishVarianceDays: avgFinish,
      sumFinishVarianceDays: nFinish > 0 ? sumFinish : null,
      avgFinishVarianceWorkingDays: avgFinishWork,
      sumFinishVarianceWorkingDays: nFinishWork > 0 ? sumFinishWork : null,
      sumWorkVarianceMinutes: workCount > 0 ? sumWork : null,
      sumCostVariance: costCount > 0 ? sumCost : null,
      maxFinishSlipDays: maxSlip,
      maxFinishSlipWorkingDays: maxSlipWork,
      latestBaselineSavedAt: latestAgg._max.createdAt
        ? latestAgg._max.createdAt.toISOString()
        : null,
    };
  }

  async listBaselines(
    projectId: string,
    userId: string,
  ): Promise<TaskBaselineRowDto[]> {
    await this.assertProjectAccess(projectId, userId);
    const rows = await this.prisma.taskBaseline.findMany({
      where: { task: { projectId, deletedAt: null } },
      orderBy: [{ taskId: 'asc' }, { baselineIndex: 'asc' }],
    });
    return rows.map((r) => ({
      taskId: r.taskId,
      baselineIndex: r.baselineIndex,
      baselineStart: r.baselineStart ? r.baselineStart.toISOString() : null,
      baselineFinish: r.baselineFinish ? r.baselineFinish.toISOString() : null,
      baselineWorkMinutes: r.baselineWorkMinutes,
      baselineCost: r.baselineCost ? Number(r.baselineCost) : null,
      savedAt: r.createdAt.toISOString(),
    }));
  }

  private async resolveEffectiveCalendarPacksForProjects(
    projectIds: string[],
  ): Promise<Map<string, ProjectCalPack | null>> {
    const out = new Map<string, ProjectCalPack | null>();
    if (projectIds.length === 0) return out;
    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      include: {
        workCalendar: true,
        workspaceLinks: { select: { workspaceId: true } },
      },
    });
    const byId = new Map(projects.map((p) => [p.id, p]));
    const wsIds = [
      ...new Set(
        projects.flatMap((p) => p.workspaceLinks.map((l) => l.workspaceId)),
      ),
    ];
    const defaultCals =
      wsIds.length > 0
        ? await this.prisma.workCalendar.findMany({
            where: { workspaceId: { in: wsIds }, isDefault: true },
            orderBy: [{ workspaceId: 'asc' }, { name: 'asc' }],
          })
        : [];
    const defaultByWs = new Map<string, ProjectCalPack>();
    for (const c of defaultCals) {
      if (defaultByWs.has(c.workspaceId)) continue;
      defaultByWs.set(c.workspaceId, {
        weekly: normalizeWeeklyPattern(c.weeklyPattern),
        exceptions: normalizeExceptions(c.exceptions),
        tz: normalizeScheduleTimeZone(c.timeZone),
      });
    }
    for (const pid of projectIds) {
      const p = byId.get(pid);
      if (!p) {
        out.set(pid, null);
        continue;
      }
      if (p.workCalendar) {
        out.set(pid, {
          weekly: normalizeWeeklyPattern(p.workCalendar.weeklyPattern),
          exceptions: normalizeExceptions(p.workCalendar.exceptions),
          tz: normalizeScheduleTimeZone(p.workCalendar.timeZone),
        });
        continue;
      }
      let pack: ProjectCalPack | null = null;
      for (const l of p.workspaceLinks) {
        const d = defaultByWs.get(l.workspaceId);
        if (d) {
          pack = d;
          break;
        }
      }
      out.set(pid, pack);
    }
    return out;
  }

  private aggsToOverallocationDtos(
    aggs: Map<string, OverallocationAgg>,
    scope: 'project' | 'program',
  ): OverallocationBucketDto[] {
    const rows: OverallocationBucketDto[] = [];
    for (const a of aggs.values()) {
      if (a.allocatedMinutes <= a.capacityMinutes) continue;
      const capPct = 100;
      const allocPct =
        a.capacityMinutes > 0
          ? Math.min(
              9999,
              Math.round((100 * a.allocatedMinutes) / a.capacityMinutes),
            )
          : 0;
      const dto: OverallocationBucketDto = {
        granularity: a.granularity,
        periodStart: a.periodStart,
        weekStart: a.periodStart,
        capacityMinutes: a.capacityMinutes,
        allocatedMinutes: a.allocatedMinutes,
        capacityPercent: capPct,
        allocatedPercent: allocPct,
        resourceKind: a.resourceKind,
        taskIds: [...a.taskIds],
        userId: a.userId,
        genericResourceId: a.genericResourceId,
        genericResourceName: a.genericResourceName,
      };
      if (scope === 'program' && a.projectIds.size > 1) {
        dto.projectIds = [...a.projectIds].sort();
      }
      rows.push(dto);
    }
    return rows;
  }

  private async collectOverallocationAggs(
    focalProjectId: string,
    scopeIds: string[],
    query: ScheduleOverallocationsQueryDto | undefined,
  ): Promise<Map<string, OverallocationAgg>> {
    const outGranularity = query?.granularity === 'day' ? 'day' : 'week';
    const fromK = query?.from?.trim().slice(0, 10) || null;
    const toK = query?.to?.trim().slice(0, 10) || null;

    const calPacks = await this.resolveEffectiveCalendarPacksForProjects(
      scopeIds,
    );
    const focalPack = calPacks.get(focalProjectId);
    const focalTz = focalPack?.tz ?? 'UTC';

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: scopeIds },
        deletedAt: null,
        isTemplate: false,
        OR: [
          { assignees: { some: {} } },
          { genericResourceAssignments: { some: {} } },
        ],
      },
      include: {
        assignees: {
          include: {
            user: {
              include: {
                workCalendar: {
                  select: {
                    weeklyPattern: true,
                    exceptions: true,
                    timeZone: true,
                  },
                },
              },
            },
          },
        },
        genericResourceAssignments: {
          include: {
            genericResource: {
              include: {
                workCalendar: {
                  select: {
                    weeklyPattern: true,
                    exceptions: true,
                    timeZone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    /** Per calendar day: capacity = max (same user/day), allocated sums. */
    const dayAggs = new Map<string, OverallocationAgg>();

    const bumpUserDay = (
      userId: string,
      taskPid: string,
      dayKey: string,
      capDay: number,
      allocDay: number,
      taskId: string,
    ) => {
      if (capDay <= 0 || allocDay <= 0) return;
      const key = `u:${userId}|${dayKey}`;
      let row = dayAggs.get(key);
      if (!row) {
        row = {
          granularity: 'day',
          periodStart: dayKey,
          resourceKind: 'user',
          userId,
          capacityMinutes: 0,
          allocatedMinutes: 0,
          taskIds: new Set<string>(),
          projectIds: new Set<string>(),
        };
        dayAggs.set(key, row);
      }
      row.capacityMinutes = Math.max(row.capacityMinutes, capDay);
      row.allocatedMinutes += allocDay;
      row.taskIds.add(taskId);
      row.projectIds.add(taskPid);
    };

    const bumpGenericDay = (
      gid: string,
      gname: string,
      taskPid: string,
      dayKey: string,
      capDay: number,
      allocDay: number,
      taskId: string,
    ) => {
      if (capDay <= 0 || allocDay <= 0) return;
      const key = `g:${gid}|${dayKey}`;
      let row = dayAggs.get(key);
      if (!row) {
        row = {
          granularity: 'day',
          periodStart: dayKey,
          resourceKind: 'generic_resource',
          genericResourceId: gid,
          genericResourceName: gname,
          capacityMinutes: 0,
          allocatedMinutes: 0,
          taskIds: new Set<string>(),
          projectIds: new Set<string>(),
        };
        dayAggs.set(key, row);
      }
      row.capacityMinutes = Math.max(row.capacityMinutes, capDay);
      row.allocatedMinutes += allocDay;
      row.taskIds.add(taskId);
      row.projectIds.add(taskPid);
    };

    for (const t of tasks) {
      const taskPid = t.projectId;
      if (!taskPid || !t.startDate || !t.dueDate) continue;

      const pack = calPacks.get(taskPid);
      const taskTz = pack?.tz ?? 'UTC';
      const weekly = pack?.weekly ?? defaultWeeklyPattern();
      const ex = pack?.exceptions ?? [];

      const dayKeys = enumerateDateKeysInclusiveInTz(
        t.startDate,
        t.dueDate,
        taskTz,
      );
      for (const dayKey of dayKeys) {
        if (fromK && dayKey < fromK) continue;
        if (toK && dayKey > toK) continue;

        const projM = workingMinutesOnDateKey(dayKey, weekly, ex, taskTz);
        const noon = zonedNoonFromDateKey(dayKey, taskTz);

        for (const a of t.assignees ?? []) {
          const wc = a.user?.workCalendar;
          let userM = projM;
          if (wc) {
            userM = workingMinutesOnDay(
              noon,
              normalizeWeeklyPattern(wc.weeklyPattern),
              normalizeExceptions(wc.exceptions),
              normalizeScheduleTimeZone(wc.timeZone),
            );
          }
          const cap = Math.min(projM, userM);
          const alloc = (a.unitsPercent / 100) * cap;
          bumpUserDay(a.userId, taskPid, dayKey, cap, alloc, t.id);
        }

        for (const g of t.genericResourceAssignments ?? []) {
          const gr = g.genericResource;
          const gc = gr.workCalendar;
          let resM = projM;
          if (gc) {
            resM = workingMinutesOnDay(
              noon,
              normalizeWeeklyPattern(gc.weeklyPattern),
              normalizeExceptions(gc.exceptions),
              normalizeScheduleTimeZone(gc.timeZone),
            );
          }
          const baseCap = Math.min(projM, resM);
          const maxU = gr.maxUnitsPercent ?? 100;
          const cap = baseCap * (maxU / 100);
          const alloc = (g.unitsPercent / 100) * cap;
          bumpGenericDay(
            g.genericResourceId,
            gr.name,
            taskPid,
            dayKey,
            cap,
            alloc,
            t.id,
          );
        }
      }
    }

    if (outGranularity === 'day') {
      const filtered = new Map<string, OverallocationAgg>();
      for (const [k, v] of dayAggs) {
        v.granularity = 'day';
        filtered.set(k, v);
      }
      return filtered;
    }

    const weekAggs = new Map<string, OverallocationAgg>();
    for (const d of dayAggs.values()) {
      const noon = zonedNoonFromDateKey(d.periodStart, focalTz);
      const wk = weekStartMondayDateKeyInTimeZone(noon, focalTz);
      const prefix = d.resourceKind === 'user' ? `u:${d.userId}` : `g:${d.genericResourceId}`;
      const wkey = `${prefix}|${wk}`;
      let wrow = weekAggs.get(wkey);
      if (!wrow) {
        wrow = {
          granularity: 'week',
          periodStart: wk,
          resourceKind: d.resourceKind,
          userId: d.userId,
          genericResourceId: d.genericResourceId,
          genericResourceName: d.genericResourceName,
          capacityMinutes: 0,
          allocatedMinutes: 0,
          taskIds: new Set<string>(),
          projectIds: new Set<string>(),
        };
        weekAggs.set(wkey, wrow);
      }
      wrow.capacityMinutes += d.capacityMinutes;
      wrow.allocatedMinutes += d.allocatedMinutes;
      for (const tid of d.taskIds) wrow.taskIds.add(tid);
      for (const pid of d.projectIds) wrow.projectIds.add(pid);
    }
    return weekAggs;
  }

  async getOverallocations(
    projectId: string,
    userId: string,
    query?: ScheduleOverallocationsQueryDto,
  ): Promise<OverallocationBucketDto[]> {
    await this.assertProjectAccess(projectId, userId);
    const scopeIds =
      query?.scope === 'program'
        ? await this.resolveScheduleProgramScopeProjectIds(projectId)
        : [projectId];
    for (const pid of scopeIds) {
      if (pid !== projectId) await this.assertProjectAccess(pid, userId);
    }
    const qScope = query?.scope === 'program' ? 'program' : 'project';
    const aggs = await this.collectOverallocationAggs(projectId, scopeIds, query);
    let rows = this.aggsToOverallocationDtos(aggs, qScope);
    rows.sort((a, b) => {
      const c = a.periodStart.localeCompare(b.periodStart);
      if (c !== 0) return c;
      if (a.resourceKind !== b.resourceKind) {
        return a.resourceKind === 'user' ? -1 : 1;
      }
      const ia = a.userId ?? a.genericResourceId ?? '';
      const ib = b.userId ?? b.genericResourceId ?? '';
      return ia.localeCompare(ib);
    });
    const off = query?.offset;
    const lim = query?.limit;
    if (lim != null && Number.isFinite(lim) && lim >= 0) {
      const o = off != null && Number.isFinite(off) && off > 0 ? Math.floor(off) : 0;
      rows = rows.slice(o, o + Math.floor(lim));
    }
    return rows;
  }

  async level(
    projectId: string,
    userId: string,
    body?: ProjectLevelRequest,
  ): Promise<ProjectLevelResultDto> {
    await this.assertScheduleScopeAccess(projectId, userId);
    const levelScope = body?.scope === 'program' ? 'program' : 'project';
    const preserveManual = body?.preserveManuallyScheduled !== false;
    const overloadScopeIds =
      levelScope === 'program'
        ? await this.resolveScheduleProgramScopeProjectIds(projectId)
        : [projectId];

    let clearedLevelingDelaysTaskCount: number | undefined;
    if (body?.clearLevelingDelays) {
      const cleared = await this.prisma.task.updateMany({
        where: {
          projectId: { in: overloadScopeIds },
          deletedAt: null,
        },
        data: { levelingDelayWorkingDays: 0 },
      });
      clearedLevelingDelaysTaskCount = cleared.count;
    }

    const shifted: string[] = [];
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const deferSplitCapableLast = body?.deferSplitCapableTasksLast === true;

    let stoppedReason: ProjectLevelResultDto['stoppedReason'] = 'resolved';
    const MAX_PASSES = 40;

    const shiftOneTask = async (taskId: string): Promise<void> => {
      const row = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          projectId: true,
          startDate: true,
          dueDate: true,
        },
      });
      if (!row?.startDate || !row.dueDate || !row.projectId) return;
      const calInput = await this.resolveEffectiveCalendarInput(row.projectId);
      const weekly = calInput
        ? normalizeWeeklyPattern(calInput.weeklyPattern)
        : null;
      const exceptions = calInput ? normalizeExceptions(calInput.exceptions) : [];
      const calTz = calInput
        ? normalizeScheduleTimeZone(calInput.timeZone)
        : 'UTC';
      const shiftByWorkingDay = Boolean(calInput && weekly);

      let newStart: Date;
      let newDue: Date;
      if (shiftByWorkingDay && weekly) {
        const s = row.startDate;
        const e = row.dueDate;
        const sameDay = dateKeyUTC(s) === dateKeyUTC(e);
        if (sameDay) {
          newStart = nextWorkingDayAfter(s, weekly, exceptions, calTz);
          newDue = new Date(newStart.getTime());
        } else {
          const dur = Math.max(
            1,
            durationWorkingDaysBetween(s, e, weekly, exceptions, calTz),
          );
          newStart = nextWorkingDayAfter(s, weekly, exceptions, calTz);
          newDue = endDayInclusive(newStart, dur, weekly, exceptions, calTz);
        }
      } else {
        newStart = addUtcDays(row.startDate, 1);
        newDue = addUtcDays(row.dueDate, 1);
      }

      let delayDelta = 0;
      if (shiftByWorkingDay && weekly) {
        const v = signedWorkingDayVarianceBetween(
          row.startDate,
          newStart,
          weekly,
          exceptions,
          calTz,
        );
        delayDelta = v != null && v > 0 ? v : 0;
      } else {
        const calDays = Math.round(
          (newStart.getTime() - row.startDate.getTime()) / 86_400_000,
        );
        delayDelta = calDays > 0 ? calDays : 0;
      }

      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          startDate: newStart,
          dueDate: newDue,
          ...(delayDelta > 0
            ? { levelingDelayWorkingDays: { increment: delayDelta } }
            : {}),
        },
      });
      shifted.push(taskId);
      const dto = await this.taskService.findById(taskId);
      if (dto) await this.taskService.broadcastTaskUpdated(dto);
    };

    const overloadQuery: ScheduleOverallocationsQueryDto = {
      scope: levelScope === 'program' ? 'program' : 'project',
    };

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let over = await this.getOverallocations(projectId, userId, overloadQuery);
      if (over.length === 0) {
        stoppedReason = 'resolved';
        break;
      }

      let movedThisPass = 0;
      for (let s = 0; s < LEVEL_SHIFTS_INNER_CAP; s++) {
        over = await this.getOverallocations(projectId, userId, overloadQuery);
        if (over.length === 0) {
          stoppedReason = 'resolved';
          break;
        }

        const sched = await this.computeScheduleInternal(projectId);
        const slackById = new Map(
          sched.persistRows.map((r) => [r.taskId, r.totalSlackDays]),
        );

        const candidateIds = new Set<string>();
        for (const b of over) {
          for (const id of b.taskIds) candidateIds.add(id);
        }
        if (candidateIds.size === 0) break;

        const tasks = await this.prisma.task.findMany({
          where: {
            id: { in: [...candidateIds] },
            projectId:
              levelScope === 'program' ? { in: overloadScopeIds } : projectId,
            deletedAt: null,
          },
          select: {
            id: true,
            isManuallyScheduled: true,
            startDate: true,
            dueDate: true,
            sortOrder: true,
            levelingPriority: true,
            levelingCanSplit: true,
          },
        });
        const byId = new Map(tasks.map((t) => [t.id, t]));

        const candidates: {
          taskId: string;
          sortOrder: number;
          levelingPriority: number;
          levelingCanSplit: boolean;
        }[] = [];
        for (const id of candidateIds) {
          const t = byId.get(id);
          if (!t || !t.startDate || !t.dueDate) continue;
          if (preserveManual && t.isManuallyScheduled) continue;
          if ((slackById.get(id) ?? 0) <= 0) continue;
          candidates.push({
            taskId: id,
            sortOrder: t.sortOrder,
            levelingPriority: t.levelingPriority ?? 500,
            levelingCanSplit: t.levelingCanSplit === true,
          });
        }
        if (candidates.length === 0) {
          stoppedReason = 'no_slack';
          break;
        }

        candidates.sort((a, b) => {
          if (a.levelingPriority !== b.levelingPriority) {
            return a.levelingPriority - b.levelingPriority;
          }
          if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder;
          if (deferSplitCapableLast) {
            const sa = a.levelingCanSplit ? 1 : 0;
            const sb = b.levelingCanSplit ? 1 : 0;
            if (sa !== sb) return sa - sb;
          }
          return a.taskId.localeCompare(b.taskId);
        });

        await shiftOneTask(candidates[0].taskId);
        movedThisPass += 1;
      }

      if (stoppedReason === 'resolved') break;
      if (stoppedReason === 'no_slack') break;
      if (movedThisPass === 0) {
        stoppedReason = 'no_slack';
        break;
      }
    }

    const remaining = await this.getOverallocations(
      projectId,
      userId,
      overloadQuery,
    );
    const baseResult: ProjectLevelResultDto = {
      shiftedTaskIds: [...new Set(shifted)],
      stoppedReason: 'resolved',
      remainingOverallocations: remaining.length,
      scope: levelScope,
      ...(clearedLevelingDelaysTaskCount !== undefined
        ? { clearedLevelingDelaysTaskCount }
        : {}),
    };
    if (remaining.length === 0) {
      return {
        ...baseResult,
        stoppedReason: 'resolved',
        remainingOverallocations: 0,
      };
    }
    let reason: ProjectLevelResultDto['stoppedReason'] = stoppedReason;
    if (reason === 'resolved') {
      reason = 'max_passes';
    }
    return {
      ...baseResult,
      stoppedReason: reason,
    };
  }

  /** EV from % complete vs work performed vs baseline work (C-05). */
  private computeTaskEarnedValueDollars(
    budget: number,
    percentComplete: number,
    basis: EvmEarnedValueBasis,
    task: {
      actualMin: number | null;
      workMinutes: number | null;
      estimatedMin: number | null;
    },
    baselineWorkMinutes: number | null | undefined,
  ): number {
    const pct = Math.max(0, Math.min(100, percentComplete)) / 100;
    if (basis === 'WORK_VS_BASELINE') {
      const baseWork =
        baselineWorkMinutes != null && baselineWorkMinutes > 0
          ? baselineWorkMinutes
          : null;
      if (baseWork != null) {
        const performed =
          task.actualMin != null
            ? task.actualMin
            : pct *
              (task.workMinutes ?? task.estimatedMin ?? baseWork);
        const ratio = Math.min(1, Math.max(0, performed / baseWork));
        return budget * ratio;
      }
    }
    return budget * pct;
  }

  /**
   * BCWS-style PV. `BASELINE_DURATION_LINEAR`: uniform on calendar elapsed between baseline dates.
   * `WORK_SCHEDULE_LINEAR`: labor share tracks **working minutes** on the project calendar; non-labor share
   * tracks calendar elapsed. Without a resolvable calendar pack, behaves like baseline duration linear.
   */
  private computeTaskPlannedValueDollars(
    budget: number,
    laborShare: number,
    baselineStart: Date | null | undefined,
    baselineFinish: Date | null | undefined,
    nowMs: number,
    pvModel: EvmPvModel,
    calPack: ProjectCalPack | null,
  ): number {
    const bs = baselineStart;
    const bf = baselineFinish;
    if (!bs || !bf) return budget;
    const total = Math.max(1, bf.getTime() - bs.getTime());
    const elapsed = Math.min(total, Math.max(0, nowMs - bs.getTime()));
    const timeFrac = elapsed / total;

    if (pvModel !== 'WORK_SCHEDULE_LINEAR' || !calPack) {
      return budget * timeFrac;
    }

    const totalW = sumWorkingMinutesInclusiveRange(
      bs,
      bf,
      calPack.weekly,
      calPack.exceptions,
      calPack.tz,
    );
    const asOf = new Date(Math.min(nowMs, bf.getTime()));
    const elapsedW = sumWorkingMinutesInclusiveRange(
      bs,
      asOf,
      calPack.weekly,
      calPack.exceptions,
      calPack.tz,
    );
    const workFrac =
      totalW > 0 ? Math.min(1, Math.max(0, elapsedW / totalW)) : timeFrac;

    const w = Math.max(0, Math.min(1, laborShare));
    return budget * (w * workFrac + (1 - w) * timeFrac);
  }

  private resolveTaskEvmBudget(
    t: {
      baselines: Array<{
        baselineIndex: number;
        baselineCost: Prisma.Decimal | null;
      }>;
      fixedCost: Prisma.Decimal | null;
      workMinutes: number | null;
      estimatedMin: number | null;
      overtimeWorkMinutes?: number | null;
      assignees: Array<{
        unitsPercent: number;
        workMinutes: number | null;
        costPerUse: Prisma.Decimal | null;
        user: {
          resourceStandardRatePerHour: Prisma.Decimal | null;
          resourceOvertimeRatePerHour?: Prisma.Decimal | null;
        };
      }>;
      genericResourceAssignments: Array<{
        unitsPercent: number;
        costPerUse?: Prisma.Decimal | null;
        genericResource: { standardRatePerHour: Prisma.Decimal | null };
      }>;
    },
    baselineIndex = 0,
  ): number | null {
    const base = (t.baselines ?? []).find((b) => b.baselineIndex === baselineIndex);
    if (base?.baselineCost != null) {
      const n = Number(base.baselineCost);
      return n > 0 ? n : null;
    }
    const est = this.computeTaskEstimatedCostFromLoadedTask(t);
    if (est == null) return null;
    const n = Number(est);
    return n > 0 ? n : null;
  }

  async evm(
    projectId: string,
    userId: string,
    includeTasks = true,
    options?: ScheduleEvmQueryOptions,
  ): Promise<ProjectEvmSummaryDto> {
    await this.assertProjectAccess(projectId, userId);
    const baselineIndex = options?.baselineIndex ?? 0;
    this.assertBaselineIndex(baselineIndex);
    const earnedValueBasis: EvmEarnedValueBasis =
      options?.earnedValueBasis === 'WORK_VS_BASELINE'
        ? 'WORK_VS_BASELINE'
        : 'PERCENT_COMPLETE';
    const pvModel: EvmPvModel =
      options?.pvModel === 'WORK_SCHEDULE_LINEAR'
        ? 'WORK_SCHEDULE_LINEAR'
        : 'BASELINE_DURATION_LINEAR';

    const ledgerSums = await this.prisma.taskCostEntry.groupBy({
      by: ['taskId'],
      where: {
        task: {
          projectId,
          deletedAt: null,
          isTemplate: false,
        },
      },
      _sum: { amount: true },
    });
    const ledgerByTask = new Map(
      ledgerSums.map((r) => [r.taskId, Number(r._sum.amount ?? 0)]),
    );

    let evmCalPack: ProjectCalPack | null = null;
    if (pvModel === 'WORK_SCHEDULE_LINEAR') {
      const rawCal = await this.resolveEffectiveCalendarInput(projectId);
      if (rawCal) {
        evmCalPack = {
          weekly: normalizeWeeklyPattern(rawCal.weeklyPattern),
          exceptions: normalizeExceptions(rawCal.exceptions),
          tz: normalizeScheduleTimeZone(rawCal.timeZone),
        };
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, isTemplate: false },
      include: {
        baselines: { where: { baselineIndex } },
        assignees: { include: { user: true } },
        genericResourceAssignments: { include: { genericResource: true } },
      },
    });

    const nowMs = Date.now();
    const taskRows: TaskEvmRowDto[] = [];
    let bacOp = 0;
    let pvOp = 0;
    let evOp = 0;
    let acOp = 0;
    let bacBd = 0;
    let pvBd = 0;
    let evBd = 0;
    let acBd = 0;

    const rollupRow = (
      budget: number,
      evI: number,
      pvI: number,
      acI: number,
      isBudget: boolean,
    ): void => {
      if (isBudget) {
        bacBd += budget;
        pvBd += pvI;
        evBd += evI;
        acBd += acI;
      } else {
        bacOp += budget;
        pvOp += pvI;
        evOp += evI;
        acOp += acI;
      }
    };

    for (const t of tasks) {
      const budget = this.resolveTaskEvmBudget(t, baselineIndex);
      if (budget == null) continue;
      const base = t.baselines[0];
      const bs = base?.baselineStart ?? t.startDate;
      const bf = base?.baselineFinish ?? t.dueDate;
      const evI = this.computeTaskEarnedValueDollars(
        budget,
        t.percentComplete ?? 0,
        earnedValueBasis,
        {
          actualMin: t.actualMin,
          workMinutes: t.workMinutes,
          estimatedMin: t.estimatedMin,
        },
        base?.baselineWorkMinutes,
      );
      const { labor: laborD, nonLabor: nonLaborD } =
        this.computeTaskLaborNonLaborDollars(t);
      const shapeDenom = laborD + nonLaborD;
      const laborShare = shapeDenom > 0 ? laborD / shapeDenom : 0;
      const pvI = this.computeTaskPlannedValueDollars(
        budget,
        laborShare,
        bs,
        bf,
        nowMs,
        pvModel,
        evmCalPack,
      );

      const ledger = ledgerByTask.get(t.id) ?? 0;
      let acI: number;
      if (t.actualCost != null) {
        acI = Number(t.actualCost);
      } else if (ledger > 0) {
        acI = ledger;
      } else {
        acI = evI;
      }

      const isBudget = t.isBudgetTask === true;
      rollupRow(budget, evI, pvI, acI, isBudget);

      const spiI = pvI > 0 ? evI / pvI : null;
      const cpiI = acI > 0 ? evI / acI : null;
      const eacI = cpiI != null && cpiI > 0 ? budget / cpiI : null;
      if (includeTasks) {
        taskRows.push({
          taskId: t.id,
          title: t.title,
          bac: budget,
          pv: pvI,
          ev: evI,
          ac: acI,
          spi: spiI,
          cpi: cpiI,
          eac: eacI,
          isBudgetTask: isBudget || undefined,
        });
      }
    }

    const spiOp = pvOp > 0 ? evOp / pvOp : null;
    const cpiOp = acOp > 0 ? evOp / acOp : null;
    const eacOp = cpiOp != null && cpiOp > 0 ? bacOp / cpiOp : null;

    let budgetRollup: ProjectEvmBudgetRollupDto | undefined;
    if (bacBd > 0) {
      const spiBd = pvBd > 0 ? evBd / pvBd : null;
      const cpiBd = acBd > 0 ? evBd / acBd : null;
      const eacBd = cpiBd != null && cpiBd > 0 ? bacBd / cpiBd : null;
      budgetRollup = {
        bac: bacBd,
        pv: pvBd,
        ev: evBd,
        ac: acBd,
        spi: spiBd,
        cpi: cpiBd,
        eac: eacBd,
      };
    }

    const out: ProjectEvmSummaryDto = {
      projectId,
      baselineIndex,
      earnedValueBasis,
      pvModel,
      bac: bacOp,
      pv: pvOp,
      ev: evOp,
      ac: acOp,
      spi: spiOp,
      cpi: cpiOp,
      eac: eacOp,
      ...(budgetRollup ? { budget: budgetRollup } : {}),
    };
    if (includeTasks) out.tasks = taskRows;
    return out;
  }

  async getNetworkGraph(
    projectId: string,
    userId: string,
  ): Promise<ProjectScheduleNetworkDto> {
    await this.assertProjectAccess(projectId, userId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, isTemplate: false },
      select: {
        id: true,
        title: true,
        dependencies: {
          select: {
            blockingId: true,
            linkType: true,
            lagDays: true,
            lagIsElapsed: true,
          },
        },
      },
    });
    const nodes = tasks.map((t) => ({ id: t.id, title: t.title }));
    const edges = tasks.flatMap((t) =>
      t.dependencies.map((d) => ({
        fromTaskId: d.blockingId,
        toTaskId: t.id,
        linkType: d.linkType,
        lagDays: d.lagDays,
        lagIsElapsed: d.lagIsElapsed === true,
      })),
    );
    return { projectId, nodes, edges };
  }

  /** Split task-level timephased cells by assignment units (Resource Usage grid). */
  private buildResourceTimephasedCells(
    tasks: Array<{
      id: string;
      assignees: Array<{
        unitsPercent: number | null;
        user: { id: string; email: string; displayName: string | null };
      }>;
      genericResourceAssignments: Array<{
        unitsPercent: number;
        genericResource: { id: string; name: string };
      }>;
    }>,
    cells: ProjectScheduleTimephasedCellDto[],
  ): ProjectScheduleTimephasedResourceCellDto[] {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const merged = new Map<string, ProjectScheduleTimephasedResourceCellDto>();

    const bump = (
      key: string,
      label: string,
      periodStart: string,
      periodEnd: string,
      wm: number,
      cost: number | null,
    ) => {
      const mk = `${key}\0${periodStart}`;
      const prev = merged.get(mk);
      if (prev) {
        prev.workMinutes += wm;
        if (cost != null) {
          prev.cost = (prev.cost ?? 0) + cost;
        }
      } else {
        merged.set(mk, {
          resourceKey: key,
          resourceLabel: label,
          periodStart,
          periodEnd,
          workMinutes: wm,
          cost,
        });
      }
    };

    for (const c of cells) {
      const t = taskById.get(c.taskId);
      if (!t) continue;
      const assignees = t.assignees ?? [];
      const generics = t.genericResourceAssignments ?? [];
      let sumU = 0;
      for (const a of assignees) {
        sumU +=
          typeof a.unitsPercent === 'number' && Number.isFinite(a.unitsPercent)
            ? a.unitsPercent
            : 100;
      }
      for (const g of generics) {
        if (g.unitsPercent > 0) sumU += g.unitsPercent;
      }

      const resources: Array<{ key: string; label: string; weight: number }> = [];
      if (sumU <= 0) {
        resources.push({ key: 'unassigned', label: 'Unassigned', weight: 1 });
      } else {
        for (const a of assignees) {
          const u =
            typeof a.unitsPercent === 'number' && Number.isFinite(a.unitsPercent)
              ? a.unitsPercent
              : 100;
          resources.push({
            key: `user:${a.user.id}`,
            label: (a.user.displayName?.trim() || a.user.email || 'User').slice(
              0,
              200,
            ),
            weight: u / sumU,
          });
        }
        for (const g of generics) {
          if (g.unitsPercent <= 0) continue;
          resources.push({
            key: `generic:${g.genericResource.id}`,
            label: g.genericResource.name,
            weight: g.unitsPercent / sumU,
          });
        }
      }

      const weights = resources.map((r) => r.weight);
      const workSplits = allocateIntegerByWeights(c.workMinutes, weights);
      const costSplits =
        c.cost != null && c.cost > 0
          ? allocateIntegerByWeights(
              Math.round(c.cost * 10000),
              weights,
            ).map((x) => x / 10000)
          : resources.map(() => null as null);

      for (let i = 0; i < resources.length; i++) {
        const r = resources[i]!;
        const wm = workSplits[i] ?? 0;
        const cost = costSplits[i];
        const costRounded =
          cost != null ? Math.round(cost * 10000) / 10000 : null;
        if (wm <= 0 && (costRounded == null || costRounded === 0)) continue;
        bump(r.key, r.label, c.periodStart, c.periodEnd, wm, costRounded);
      }
    }

    const out = [...merged.values()];
    out.sort((a, b) => {
      const c = a.periodStart.localeCompare(b.periodStart);
      return c !== 0 ? c : a.resourceLabel.localeCompare(b.resourceLabel);
    });
    return out;
  }

  async getTimephased(
    projectId: string,
    userId: string,
    granularity: 'week' | 'day' = 'week',
    basisRequested: ScheduleTimephasedBasis = 'calendar',
  ): Promise<ProjectScheduleTimephasedDto> {
    await this.assertProjectAccess(projectId, userId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, isTemplate: false },
      include: {
        assignees: { include: { user: true } },
        genericResourceAssignments: { include: { genericResource: true } },
      },
    });

    let workingPack: WorkingBasisPack | null = null;
    let basis: ScheduleTimephasedBasis = 'calendar';
    if (basisRequested === 'working') {
      const calRow = await this.resolveEffectiveCalendarInput(projectId);
      if (calRow) {
        workingPack = {
          weekly: normalizeWeeklyPattern(calRow.weeklyPattern),
          exceptions: normalizeExceptions(calRow.exceptions),
          timeZone: normalizeScheduleTimeZone(calRow.timeZone),
        };
        basis = 'working';
      }
    }

    const cells: ProjectScheduleTimephasedCellDto[] = [];

    for (const t of tasks) {
      if (!t.startDate || !t.dueDate) continue;
      const workTotal =
        t.workMinutes ??
        t.durationWorkingMinutes ??
        t.estimatedMin ??
        null;
      const costDec = this.computeTaskEstimatedCostFromLoadedTask(t);
      const costTotal = costDec ? Number(costDec) : null;

      const contour = (t.workContour ?? 'FLAT') as TaskWorkContour;
      cells.push(
        ...computeTaskTimephasedCells({
          taskId: t.id,
          taskTitle: t.title,
          startDate: t.startDate,
          dueDate: t.dueDate,
          workTotal,
          costTotal,
          scheduleSegments: t.scheduleSegments,
          workContour: contour,
          granularity,
          basis,
          workingPack,
        }),
      );
    }

    cells.sort((a, b) => {
      const c = a.periodStart.localeCompare(b.periodStart);
      return c !== 0 ? c : a.taskTitle.localeCompare(b.taskTitle);
    });

    const resourceCells = this.buildResourceTimephasedCells(tasks, cells);

    return { projectId, granularity, basis, cells, resourceCells };
  }
}
