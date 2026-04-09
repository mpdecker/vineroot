import type { ProjectSavedViewConfigDto } from '@vineroot/shared-types';
import type { EpicFilterValue } from './filterSectionsByEpic';
import type { SprintFilterValue } from './filterSectionsBySprint';
import type { ListScheduleFilter, ListScheduleSort } from './filterSectionsBySchedule';
import type { TimephasedGridMode } from './timephasedSearchParams';

export type SavedViewCaptureInput = {
  sprintFilter: SprintFilterValue;
  epicFilter: EpicFilterValue;
  rootsOnly: boolean;
  currentView: string;
  workloadWeeks?: number;
  workloadFrom: string;
  listScheduleFilter?: ListScheduleFilter;
  listScheduleSort?: ListScheduleSort;
  timephasedGranularity?: 'week' | 'day';
  timephasedBasis?: 'calendar' | 'working';
  timephasedGridMode?: TimephasedGridMode;
};

const TAB_SURFACES = [
  'list',
  'board',
  'backlog',
  'sprint-board',
  'roadmap',
  'epics',
  'timeline',
  'calendar',
  'burndown',
  'flow',
  'activity',
] as const satisfies readonly NonNullable<ProjectSavedViewConfigDto['surface']>[];

export function buildSavedViewConfigFromCapture(
  capture: SavedViewCaptureInput,
): ProjectSavedViewConfigDto {
  const base: ProjectSavedViewConfigDto = {
    sprintFilter: capture.sprintFilter,
    epicFilter: capture.epicFilter,
    rootsOnly: capture.rootsOnly,
  };

  if (capture.currentView === 'workload') {
    return {
      ...base,
      surface: 'workload',
      ...(capture.workloadWeeks != null ? { workloadWeeks: capture.workloadWeeks } : {}),
      ...(capture.workloadFrom.trim()
        ? { workloadFrom: capture.workloadFrom.trim() }
        : {}),
    };
  }

  if (capture.currentView === 'timephased') {
    return {
      ...base,
      surface: 'timephased',
      ...(capture.timephasedGranularity != null
        ? { timephasedGranularity: capture.timephasedGranularity }
        : {}),
      ...(capture.timephasedBasis != null ? { timephasedBasis: capture.timephasedBasis } : {}),
      ...(capture.timephasedGridMode != null
        ? { timephasedGridMode: capture.timephasedGridMode }
        : {}),
    };
  }

  if (capture.currentView === 'network') {
    return { ...base, surface: 'network' };
  }

  if ((TAB_SURFACES as readonly string[]).includes(capture.currentView)) {
    const listViews = ['list', 'board', 'backlog', 'sprint-board'];
    const scheduleBits = listViews.includes(capture.currentView)
      ? {
          listScheduleFilter: capture.listScheduleFilter ?? 'all',
          listScheduleSort: capture.listScheduleSort ?? 'none',
        }
      : {};
    return {
      ...base,
      surface: capture.currentView as NonNullable<ProjectSavedViewConfigDto['surface']>,
      ...scheduleBits,
    };
  }

  return base;
}

export type SavedViewSummaryContext = {
  sprints: { id: string; name: string }[];
  epicTasks: { id: string; title: string }[];
};

const SURFACE_LABELS: Record<string, string> = {
  list: 'List',
  board: 'Board',
  backlog: 'Backlog',
  'sprint-board': 'Sprint board',
  roadmap: 'Roadmap',
  epics: 'Epics dashboard',
  timeline: 'Schedule',
  calendar: 'Calendar',
  burndown: 'Burndown',
  flow: 'Flow',
  workload: 'Workload',
  activity: 'Activity',
  timephased: 'Timephased data',
  network: 'Network diagram',
};

/** Short lines for modal summaries (full sentence per row). */
export function summarizeSavedViewConfig(
  config: ProjectSavedViewConfigDto,
  ctx: SavedViewSummaryContext,
): string[] {
  const lines: string[] = [];

  if (config.surface) {
    lines.push(SURFACE_LABELS[config.surface] ?? config.surface);
  } else {
    lines.push('Same tab (filters only)');
  }

  const sf = config.sprintFilter ?? 'all';
  if (sf === 'all') lines.push('All sprints');
  else if (sf === 'backlog') lines.push('Sprint: Backlog items');
  else {
    const sp = ctx.sprints.find((s) => s.id === sf);
    lines.push(sp ? `Sprint: ${sp.name}` : 'Custom sprint filter');
  }

  const ef = config.epicFilter ?? 'all';
  if (ef === 'all') lines.push('All epics');
  else {
    const ep = ctx.epicTasks.find((e) => e.id === ef);
    lines.push(ep ? `Epic: ${ep.title}` : 'Custom epic filter');
  }

  if (config.rootsOnly) {
    lines.push('Roots only (list, board, backlog, sprint board)');
  }

  const lsf = config.listScheduleFilter;
  if (lsf && lsf !== 'all') {
    const labels: Record<string, string> = {
      critical: 'Schedule: critical path only',
      slack: 'Schedule: tasks with slack',
      deadline: 'Schedule: deadline breach',
    };
    lines.push(labels[lsf] ?? `Schedule filter: ${lsf}`);
  }
  const lss = config.listScheduleSort;
  if (lss && lss !== 'none') {
    const sortLabels: Record<string, string> = {
      critical_first: 'Sort: critical first',
      slack_desc: 'Sort: most slack first',
      deadline_breach_first: 'Sort: deadline issues first',
      constraint_type: 'Sort: constraint type',
    };
    lines.push(sortLabels[lss] ?? `Sort: ${lss}`);
  }

  if (config.surface === 'workload') {
    const bits: string[] = [];
    if (config.workloadWeeks != null) bits.push(`${config.workloadWeeks} week columns`);
    if (config.workloadFrom) bits.push(`anchor ${config.workloadFrom}`);
    if (bits.length) lines.push(bits.join(' · '));
  }

  if (config.surface === 'timephased') {
    const bits: string[] = [];
    if (config.timephasedGranularity) bits.push(`${config.timephasedGranularity} buckets`);
    if (config.timephasedBasis === 'working') bits.push('working calendar');
    else if (config.timephasedBasis === 'calendar') bits.push('calendar basis');
    if (config.timephasedGridMode === 'task_usage') bits.push('Task Usage grid');
    else if (config.timephasedGridMode === 'resource_usage') bits.push('Resource Usage grid');
    else if (config.timephasedGridMode === 'list') bits.push('flat list');
    if (bits.length) lines.push(bits.join(' · '));
  }

  return lines;
}
