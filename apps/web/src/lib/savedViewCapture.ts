import type { ProjectSavedViewConfigDto } from '@vineroot/shared-types';
import type { EpicFilterValue } from './filterSectionsByEpic';
import type { SprintFilterValue } from './filterSectionsBySprint';

export type SavedViewCaptureInput = {
  sprintFilter: SprintFilterValue;
  epicFilter: EpicFilterValue;
  rootsOnly: boolean;
  currentView: string;
  workloadWeeks?: number;
  workloadFrom: string;
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

  if ((TAB_SURFACES as readonly string[]).includes(capture.currentView)) {
    return {
      ...base,
      surface: capture.currentView as NonNullable<ProjectSavedViewConfigDto['surface']>,
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
  timeline: 'Timeline',
  calendar: 'Calendar',
  burndown: 'Burndown',
  flow: 'Flow',
  workload: 'Workload',
  activity: 'Activity',
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

  if (config.surface === 'workload') {
    const bits: string[] = [];
    if (config.workloadWeeks != null) bits.push(`${config.workloadWeeks} week columns`);
    if (config.workloadFrom) bits.push(`anchor ${config.workloadFrom}`);
    if (bits.length) lines.push(bits.join(' · '));
  }

  return lines;
}
