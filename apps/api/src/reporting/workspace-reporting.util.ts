import { BadRequestException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import type { PrismaService } from '../common/prisma.service';
import type {
  ReportingFlowMetricsDto,
  ReportingThroughputWeekDto,
  WorkspaceReportingFilters,
  WorkspaceReportingSummaryDto,
} from '@vineroot/shared-types';

const TERMINAL: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];
const MS_PER_DAY = 86_400_000;

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekSunday(monday: Date): Date {
  const x = new Date(monday);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Weekly buckets (Mon–Sun) overlapping [fromDate, toDate], with completion counts. */
export function computeThroughputByWeek(
  tasks: Array<{ status: TaskStatus; completedAt: Date | null }>,
  fromDate: Date,
  toDate: Date,
): ReportingThroughputWeekDto[] {
  const out: ReportingThroughputWeekDto[] = [];
  let cursor = startOfWeekMonday(fromDate);
  const lastWeekStart = startOfWeekMonday(toDate);
  while (cursor.getTime() <= lastWeekStart.getTime()) {
    const weekEnd = endOfWeekSunday(cursor);
    const effectiveStart =
      cursor.getTime() < fromDate.getTime() ? new Date(fromDate) : new Date(cursor);
    const effectiveEnd =
      weekEnd.getTime() > toDate.getTime() ? new Date(toDate) : new Date(weekEnd);
    let completedCount = 0;
    if (effectiveStart.getTime() <= effectiveEnd.getTime()) {
      for (const t of tasks) {
        if (t.status !== TaskStatus.DONE || !t.completedAt) continue;
        const c = t.completedAt.getTime();
        if (c >= effectiveStart.getTime() && c <= effectiveEnd.getTime()) {
          completedCount += 1;
        }
      }
    }
    out.push({
      weekStart: toYmd(cursor),
      weekEnd: toYmd(startOfLocalDay(weekEnd)),
      completedCount,
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

/** Lead time (create→done) and cycle time (startDate→done when startDate set) for DONE in period. */
export function computeFlowMetrics(
  tasks: Array<{
    status: TaskStatus;
    createdAt: Date;
    startDate: Date | null;
    completedAt: Date | null;
  }>,
  fromDate: Date,
  toDate: Date,
): ReportingFlowMetricsDto {
  const leadDays: number[] = [];
  const cycleDays: number[] = [];
  for (const t of tasks) {
    if (t.status !== TaskStatus.DONE || !t.completedAt) continue;
    const c = t.completedAt.getTime();
    if (c < fromDate.getTime() || c > toDate.getTime()) continue;
    const lead = (c - t.createdAt.getTime()) / MS_PER_DAY;
    if (Number.isFinite(lead) && lead >= 0) {
      leadDays.push(lead);
    }
    if (t.startDate) {
      const s = t.startDate.getTime();
      if (s <= c) {
        const cycle = (c - s) / MS_PER_DAY;
        if (Number.isFinite(cycle) && cycle >= 0) {
          cycleDays.push(cycle);
        }
      }
    }
  }
  leadDays.sort((a, b) => a - b);
  cycleDays.sort((a, b) => a - b);
  const leadAvg = mean(leadDays);
  const leadMed = medianSorted(leadDays);
  const cycleAvg = mean(cycleDays);
  const cycleMed = medianSorted(cycleDays);
  return {
    leadTimeDays: {
      avg: leadAvg == null ? null : round1(leadAvg),
      median: leadMed == null ? null : round1(leadMed),
      sampleSize: leadDays.length,
    },
    cycleTimeDays: {
      avg: cycleAvg == null ? null : round1(cycleAvg),
      median: cycleMed == null ? null : round1(cycleMed),
      sampleSize: cycleDays.length,
    },
  };
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseYmdLocal(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new BadRequestException(`Invalid date (use YYYY-MM-DD): ${ymd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    throw new BadRequestException(`Invalid calendar date: ${ymd}`);
  }
  return dt;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultPeriod(): { from: Date; to: Date; fromStr: string; toStr: string } {
  const to = startOfLocalDay(new Date());
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return {
    from,
    to: endOfLocalDay(to),
    fromStr: toYmd(from),
    toStr: toYmd(to),
  };
}

export interface NormalizedReportingFilters {
  from: string;
  to: string;
  fromDate: Date;
  toDate: Date;
  projectIds?: string[];
  portfolioId?: string;
  assigneeIds?: string[];
  statuses?: string[];
  tagIds?: string[];
}

/** Parse query / JSON into filters with defaults. */
export function normalizeReportingFilters(
  raw: WorkspaceReportingFilters | Record<string, unknown> | undefined,
): NormalizedReportingFilters {
  const r = raw ?? {};
  const def = defaultPeriod();

  const fromInput =
    typeof r.from === 'string' && r.from.trim()
      ? r.from.trim()
      : def.fromStr;
  const toInput =
    typeof r.to === 'string' && r.to.trim() ? r.to.trim() : def.toStr;

  const fromD0 = parseYmdLocal(fromInput);
  const toD0 = parseYmdLocal(toInput);
  if (fromD0.getTime() > toD0.getTime()) {
    throw new BadRequestException('Reporting "from" date must be before or equal to "to"');
  }

  const fromDate = startOfLocalDay(fromD0);
  const toDate = endOfLocalDay(toD0);

  const projectIds = Array.isArray(r.projectIds)
    ? (r.projectIds as string[]).filter(Boolean)
    : typeof r.projectIds === 'string' && r.projectIds
      ? r.projectIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

  const assigneeIds = Array.isArray(r.assigneeIds)
    ? (r.assigneeIds as string[]).filter(Boolean)
    : typeof r.assigneeIds === 'string' && r.assigneeIds
      ? r.assigneeIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

  const statuses = Array.isArray(r.statuses)
    ? (r.statuses as string[]).filter(Boolean)
    : typeof r.statuses === 'string' && r.statuses
      ? r.statuses.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

  const tagIds = Array.isArray(r.tagIds)
    ? (r.tagIds as string[]).filter(Boolean)
    : typeof r.tagIds === 'string' && r.tagIds
      ? r.tagIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

  const portfolioId =
    typeof r.portfolioId === 'string' && r.portfolioId.trim()
      ? r.portfolioId.trim()
      : undefined;

  for (const s of statuses ?? []) {
    if (!Object.values(TaskStatus).includes(s as TaskStatus)) {
      throw new BadRequestException(`Invalid task status in filter: ${s}`);
    }
  }

  return {
    from: toYmd(fromDate),
    to: toYmd(startOfLocalDay(toD0)),
    projectIds,
    portfolioId,
    assigneeIds,
    statuses,
    tagIds,
    fromDate,
    toDate,
  };
}

async function assertProjectsInWorkspace(
  prisma: PrismaService,
  workspaceId: string,
  projectIds: string[],
): Promise<void> {
  if (projectIds.length === 0) return;
  const rows = await prisma.projectWorkspace.findMany({
    where: {
      workspaceId,
      projectId: { in: projectIds },
      project: { deletedAt: null },
    },
    select: { projectId: true },
  });
  const ok = new Set(rows.map((x) => x.projectId));
  for (const id of projectIds) {
    if (!ok.has(id)) {
      throw new BadRequestException(`Project ${id} is not in this workspace`);
    }
  }
}

async function portfolioProjectIds(
  prisma: PrismaService,
  workspaceId: string,
  portfolioId: string,
): Promise<string[]> {
  const pf = await prisma.portfolio.findFirst({
    where: { id: portfolioId, workspaceId },
    select: { id: true },
  });
  if (!pf) {
    throw new BadRequestException('Portfolio not found in this workspace');
  }
  const items = await prisma.portfolioItem.findMany({
    where: { portfolioId },
    select: { projectId: true },
  });
  return items.map((i) => i.projectId);
}

export async function buildTaskWhereForWorkspaceReporting(
  prisma: PrismaService,
  workspaceId: string,
  filters: NormalizedReportingFilters,
): Promise<Prisma.TaskWhereInput> {
  const base: Prisma.TaskWhereInput = {
    deletedAt: null,
    OR: [
      { workspaceId },
      {
        project: {
          deletedAt: null,
          workspaceLinks: { some: { workspaceId } },
        },
      },
    ],
  };

  const and: Prisma.TaskWhereInput[] = [base];

  if (filters.portfolioId) {
    const pids = await portfolioProjectIds(
      prisma,
      workspaceId,
      filters.portfolioId,
    );
    if (pids.length === 0) {
      and.push({ id: { in: [] } });
    } else {
      await assertProjectsInWorkspace(prisma, workspaceId, pids);
      and.push({ projectId: { in: pids } });
    }
  } else if (filters.projectIds?.length) {
    await assertProjectsInWorkspace(prisma, workspaceId, filters.projectIds);
    and.push({ projectId: { in: filters.projectIds } });
  }

  if (filters.assigneeIds?.length) {
    and.push({
      assignees: { some: { userId: { in: filters.assigneeIds } } },
    });
  }

  if (filters.statuses?.length) {
    and.push({ status: { in: filters.statuses as TaskStatus[] } });
  }

  if (filters.tagIds?.length) {
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: filters.tagIds },
        workspaceId,
      },
      select: { id: true },
    });
    if (tags.length !== filters.tagIds.length) {
      throw new BadRequestException('One or more tags are invalid for this workspace');
    }
    for (const tid of filters.tagIds) {
      and.push({ tags: { some: { tagId: tid } } });
    }
  }

  return { AND: and };
}

export async function computeWorkspaceReportingSummary(
  prisma: PrismaService,
  workspaceId: string,
  rawFilters: WorkspaceReportingFilters | undefined,
): Promise<WorkspaceReportingSummaryDto> {
  const filters = normalizeReportingFilters(rawFilters);
  const where = await buildTaskWhereForWorkspaceReporting(prisma, workspaceId, filters);

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignees: {
        include: {
          user: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  const tasksByStatus: Record<string, number> = {};
  let openTaskCount = 0;
  let completedLast30Days = 0;
  let createdLast30Days = 0;
  const workloadMap = new Map<string, { displayName: string; openTaskCount: number }>();

  for (const t of tasks) {
    tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
    if (!TERMINAL.includes(t.status)) {
      openTaskCount += 1;
      for (const a of t.assignees) {
        const uid = a.userId;
        const existing = workloadMap.get(uid);
        if (existing) {
          existing.openTaskCount += 1;
        } else {
          workloadMap.set(uid, {
            displayName: a.user.displayName,
            openTaskCount: 1,
          });
        }
      }
    }
    if (
      t.completedAt &&
      t.completedAt >= filters.fromDate &&
      t.completedAt <= filters.toDate
    ) {
      completedLast30Days += 1;
    }
    if (t.createdAt >= filters.fromDate && t.createdAt <= filters.toDate) {
      createdLast30Days += 1;
    }
  }

  const workload = [...workloadMap.entries()]
    .map(([userId, v]) => ({
      userId,
      displayName: v.displayName,
      openTaskCount: v.openTaskCount,
    }))
    .sort((a, b) => b.openTaskCount - a.openTaskCount);

  const throughputByWeek = computeThroughputByWeek(tasks, filters.fromDate, filters.toDate);
  const flowMetrics = computeFlowMetrics(tasks, filters.fromDate, filters.toDate);

  const appliedFilters: WorkspaceReportingFilters = {
    from: filters.from,
    to: filters.to,
    ...(filters.projectIds?.length ? { projectIds: filters.projectIds } : {}),
    ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
    ...(filters.assigneeIds?.length ? { assigneeIds: filters.assigneeIds } : {}),
    ...(filters.statuses?.length ? { statuses: filters.statuses } : {}),
    ...(filters.tagIds?.length ? { tagIds: filters.tagIds } : {}),
  };

  return {
    workspaceId,
    period: { from: filters.from, to: filters.to },
    appliedFilters,
    tasksByStatus,
    openTaskCount,
    completedLast30Days,
    createdLast30Days,
    throughputByWeek,
    flowMetrics,
    workload,
  };
}

export type ResolvedWorkspaceNumberMetric =
  | {
      value: number;
      label: string;
      period?: { from: string; to: string };
      /** Weekly completion counts when `chartMode: sparkline` is set in widget config. */
      sparkline?: Array<{ label: string; value: number }>;
    }
  | { error: string };

function statusCount(
  summary: WorkspaceReportingSummaryDto,
  status: string,
): number {
  return summary.tasksByStatus[status] ?? 0;
}

function totalTasksInFilter(summary: WorkspaceReportingSummaryDto): number {
  return Object.values(summary.tasksByStatus).reduce((a, b) => a + b, 0);
}

function completionSparklineMetrics(metric: string): boolean {
  return (
    metric === 'COMPLETED_IN_PERIOD' ||
    metric === 'COMPLETED' ||
    metric === 'AVG_WEEKLY_THROUGHPUT' ||
    metric === 'WEEKLY_COMPLETION_AVG'
  );
}

function withNumberMetricExtras(
  summary: WorkspaceReportingSummaryDto,
  config: Record<string, unknown>,
  metricKey: string,
  base: { value: number; label: string },
): ResolvedWorkspaceNumberMetric {
  const chartMode = String(config.chartMode ?? '').toLowerCase();
  const baseOut = {
    ...base,
    period: { from: summary.period.from, to: summary.period.to },
  };
  if (chartMode === 'sparkline' && completionSparklineMetrics(metricKey)) {
    return {
      ...baseOut,
      sparkline: summary.throughputByWeek.map((w) => ({
        label: w.weekStart,
        value: w.completedCount,
      })),
    };
  }
  return baseOut;
}

/** Dashboard NUMBER_METRIC when `metric` + optional `reportingFilters` are set. */
export async function resolveWorkspaceNumberMetric(
  prisma: PrismaService,
  workspaceId: string,
  config: Record<string, unknown>,
): Promise<ResolvedWorkspaceNumberMetric> {
  const metric = String(config.metric ?? 'OPEN_TASKS').toUpperCase();
  const rawFilters = (config.reportingFilters as WorkspaceReportingFilters | undefined) ?? {};
  const summary = await computeWorkspaceReportingSummary(
    prisma,
    workspaceId,
    rawFilters,
  );

  switch (metric) {
    case 'OPEN_TASKS':
    case 'OPEN':
      return withNumberMetricExtras(
        summary,
        config,
        metric,
        {
          value: summary.openTaskCount,
          label: String(config.label ?? 'Open tasks'),
        },
      );
    case 'COMPLETED_IN_PERIOD':
    case 'COMPLETED':
      return withNumberMetricExtras(
        summary,
        config,
        metric,
        {
          value: summary.completedLast30Days,
          label: String(config.label ?? 'Completed in period'),
        },
      );
    case 'CREATED_IN_PERIOD':
    case 'CREATED':
      return withNumberMetricExtras(
        summary,
        config,
        metric,
        {
          value: summary.createdLast30Days,
          label: String(config.label ?? 'Created in period'),
        },
      );
    case 'DONE_TASKS':
    case 'DONE':
      return withNumberMetricExtras(summary, config, metric, {
        value: statusCount(summary, 'DONE'),
        label: String(config.label ?? 'Done tasks'),
      });
    case 'IN_PROGRESS_TASKS':
    case 'IN_PROGRESS':
      return withNumberMetricExtras(summary, config, metric, {
        value: statusCount(summary, 'IN_PROGRESS'),
        label: String(config.label ?? 'In progress'),
      });
    case 'IN_REVIEW_TASKS':
    case 'IN_REVIEW':
      return withNumberMetricExtras(summary, config, metric, {
        value: statusCount(summary, 'IN_REVIEW'),
        label: String(config.label ?? 'In review'),
      });
    case 'BLOCKED_TASKS':
    case 'BLOCKED':
      return withNumberMetricExtras(summary, config, metric, {
        value: statusCount(summary, 'BLOCKED'),
        label: String(config.label ?? 'Blocked'),
      });
    case 'BACKLOG_TASKS':
    case 'BACKLOG':
      return withNumberMetricExtras(summary, config, metric, {
        value: statusCount(summary, 'BACKLOG'),
        label: String(config.label ?? 'Backlog'),
      });
    case 'READY_TASKS':
    case 'READY':
      return withNumberMetricExtras(summary, config, metric, {
        value: statusCount(summary, 'READY'),
        label: String(config.label ?? 'Ready'),
      });
    case 'TOTAL_TASKS':
    case 'TOTAL_MATCHING':
      return withNumberMetricExtras(summary, config, metric, {
        value: totalTasksInFilter(summary),
        label: String(config.label ?? 'Tasks (filtered)'),
      });
    case 'AVG_LEAD_TIME_DAYS': {
      const v = summary.flowMetrics.leadTimeDays.avg;
      if (v == null) return { error: 'No lead-time samples in period' };
      return withNumberMetricExtras(summary, config, metric, {
        value: v,
        label: String(config.label ?? 'Avg lead time (days)'),
      });
    }
    case 'MEDIAN_LEAD_TIME_DAYS': {
      const v = summary.flowMetrics.leadTimeDays.median;
      if (v == null) return { error: 'No lead-time samples in period' };
      return withNumberMetricExtras(summary, config, metric, {
        value: v,
        label: String(config.label ?? 'Median lead time (days)'),
      });
    }
    case 'AVG_CYCLE_TIME_DAYS': {
      const v = summary.flowMetrics.cycleTimeDays.avg;
      if (v == null) return { error: 'No cycle-time samples (need start date + done in period)' };
      return withNumberMetricExtras(summary, config, metric, {
        value: v,
        label: String(config.label ?? 'Avg cycle time (days)'),
      });
    }
    case 'MEDIAN_CYCLE_TIME_DAYS': {
      const v = summary.flowMetrics.cycleTimeDays.median;
      if (v == null) return { error: 'No cycle-time samples (need start date + done in period)' };
      return withNumberMetricExtras(summary, config, metric, {
        value: v,
        label: String(config.label ?? 'Median cycle time (days)'),
      });
    }
    case 'AVG_WEEKLY_THROUGHPUT':
    case 'WEEKLY_COMPLETION_AVG': {
      const w = summary.throughputByWeek.length;
      const value =
        w > 0 ? round1(summary.completedLast30Days / w) : 0;
      return withNumberMetricExtras(summary, config, metric, {
        value,
        label: String(config.label ?? 'Avg completions / week'),
      });
    }
    default:
      return { error: `Unknown metric: ${metric}` };
  }
}

export function summaryToCsv(summary: WorkspaceReportingSummaryDto): string {
  const lines: string[] = [];
  lines.push('section,key,value');
  lines.push(`meta,workspaceId,${escapeCsv(summary.workspaceId)}`);
  lines.push(`meta,periodFrom,${escapeCsv(summary.period.from)}`);
  lines.push(`meta,periodTo,${escapeCsv(summary.period.to)}`);
  lines.push(`kpi,openTaskCount,${summary.openTaskCount}`);
  lines.push(`kpi,completedInPeriod,${summary.completedLast30Days}`);
  lines.push(`kpi,createdInPeriod,${summary.createdLast30Days}`);
  const fm = summary.flowMetrics;
  lines.push(
    `flow,leadTimeAvgDays,${fm.leadTimeDays.avg ?? ''}`,
  );
  lines.push(
    `flow,leadTimeMedianDays,${fm.leadTimeDays.median ?? ''}`,
  );
  lines.push(`flow,leadTimeSampleSize,${fm.leadTimeDays.sampleSize}`);
  lines.push(
    `flow,cycleTimeAvgDays,${fm.cycleTimeDays.avg ?? ''}`,
  );
  lines.push(
    `flow,cycleTimeMedianDays,${fm.cycleTimeDays.median ?? ''}`,
  );
  lines.push(`flow,cycleTimeSampleSize,${fm.cycleTimeDays.sampleSize}`);
  for (const tw of summary.throughputByWeek) {
    lines.push(
      `throughput,${escapeCsv(`${tw.weekStart}..${tw.weekEnd}`)},${tw.completedCount}`,
    );
  }
  for (const [status, count] of Object.entries(summary.tasksByStatus)) {
    lines.push(`status,${escapeCsv(status)},${count}`);
  }
  for (const w of summary.workload) {
    lines.push(
      `workload,${escapeCsv(w.displayName)} (${w.userId}),${w.openTaskCount}`,
    );
  }
  return lines.join('\n') + '\n';
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
