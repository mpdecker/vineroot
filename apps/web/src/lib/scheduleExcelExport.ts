import * as XLSX from 'xlsx';
import type { TaskBaselineRowDto } from '@vineroot/shared-types';
import type { Section, Task, TaskDependency } from '../types';

export type FlatTaskRow = {
  task: Task;
  sectionId: string;
  sectionName: string;
  depth: number;
};

function assigneeSummary(task: Task): string {
  const parts =
    task.assignees?.map((a) => a.user?.displayName ?? a.userId).filter(Boolean) ?? [];
  return parts.join('; ');
}

function genericResourceSummary(task: Task): string {
  const parts =
    task.genericResourceAssignments?.map((g) => g.genericResource?.name ?? g.genericResourceId) ??
    [];
  return parts.join('; ');
}

function segmentsJson(task: Task): string {
  const segs = task.scheduleSegments;
  if (!Array.isArray(segs) || segs.length === 0) return '';
  try {
    return JSON.stringify(segs);
  } catch {
    return '';
  }
}

export function flattenTasksForExport(
  sections: Section[],
  wbs: boolean,
): FlatTaskRow[] {
  const out: FlatTaskRow[] = [];
  const walk = (
    tasks: Task[] | undefined,
    depth: number,
    sectionName: string,
    sectionId: string,
  ) => {
    for (const t of tasks ?? []) {
      out.push({
        task: t,
        sectionId,
        sectionName,
        depth: wbs ? depth : 0,
      });
      if (wbs && t.subtasks?.length) {
        walk(t.subtasks, depth + 1, sectionName, sectionId);
      }
    }
  };
  for (const s of sections) {
    walk(s.tasks, 0, s.name, s.id);
  }
  return out;
}

/** Unique dependency edges (project-local predecessors from `waitingOn`). */
export function collectDependencyRows(flat: FlatTaskRow[]): {
  dep: TaskDependency;
  successor: Task;
}[] {
  const seen = new Set<string>();
  const rows: { dep: TaskDependency; successor: Task }[] = [];
  const taskById = new Map(flat.map(({ task }) => [task.id, task]));
  for (const { task } of flat) {
    for (const dep of task.waitingOn ?? []) {
      const predId = dep.blockingTask?.id ?? dep.blockingId;
      if (!predId) continue;
      const key = `${dep.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!taskById.has(predId)) continue;
      rows.push({ dep, successor: task });
    }
  }
  return rows;
}

const TASK_HEADERS = [
  'sectionId',
  'section',
  'wbsDepth',
  'wbsOutlineNumber',
  'taskId',
  'title',
  'status',
  'priority',
  'startDate',
  'finishDate',
  'durationWorkingMinutes',
  'workMinutes',
  'percentComplete',
  'isMilestone',
  'constraintType',
  'constraintDate',
  'deadlineDate',
  'scheduleMode',
  'workCalendarId',
  'effortDriven',
  'isSummaryRollup',
  'workContour',
  'levelingPriority',
  'levelingDelayWorkingDays',
  'overtimeWorkMinutes',
  'isBudgetTask',
  'fixedCost',
  'actualCost',
  'isManuallyScheduled',
  'assignees',
  'genericResources',
  'scheduleSegmentsJson',
] as const;

const DEP_HEADERS = [
  'dependencyId',
  'predecessorTaskId',
  'predecessorTitle',
  'successorTaskId',
  'successorTitle',
  'linkType',
  'lagDays',
  'lagIsElapsed',
] as const;

const BASE_HEADERS = [
  'taskId',
  'baselineIndex',
  'baselineStart',
  'baselineFinish',
  'baselineWorkMinutes',
  'baselineCost',
  'savedAt',
] as const;

export interface ScheduleExcelExportInput {
  sections: Section[];
  projectId: string;
  projectName?: string;
  /** All baseline rows for the project (e.g. from GET …/schedule/baselines). */
  baselineRows: TaskBaselineRowDto[];
  /** Include nested subtasks as separate rows. */
  wbs: boolean;
}

function escCell(v: unknown): string | number | boolean | null {
  if (v == null) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  return String(v);
}

export function buildScheduleExcelWorkbook(input: ScheduleExcelExportInput): XLSX.WorkBook {
  const { sections, projectId, projectName, baselineRows, wbs } = input;
  const flat = flattenTasksForExport(sections, wbs);

  const taskRows: (string | number | boolean | null)[][] = flat.map(
    ({ task, sectionId, sectionName, depth }) => [
      sectionId,
      sectionName,
      depth,
      task.wbsOutlineNumber ?? '',
      task.id,
      task.title,
      task.status,
      task.priority ?? '',
      task.startDate ?? '',
      task.dueDate ?? '',
      task.durationWorkingMinutes ?? '',
      task.workMinutes ?? '',
      task.percentComplete ?? '',
      task.isMilestone ? 'Y' : 'N',
      task.constraintType ?? '',
      task.constraintDate ?? '',
      task.deadlineDate ?? '',
      task.scheduleMode ?? '',
      task.workCalendarId ?? '',
      task.effortDriven === true ? 'Y' : task.effortDriven === false ? 'N' : '',
      task.isSummaryRollup === true ? 'Y' : task.isSummaryRollup === false ? 'N' : '',
      task.workContour ?? '',
      task.levelingPriority ?? '',
      task.levelingDelayWorkingDays ?? '',
      task.overtimeWorkMinutes ?? '',
      task.isBudgetTask === true ? 'Y' : task.isBudgetTask === false ? 'N' : '',
      task.fixedCost ?? '',
      task.actualCost ?? '',
      task.isManuallyScheduled ? 'Y' : 'N',
      assigneeSummary(task),
      genericResourceSummary(task),
      segmentsJson(task),
    ],
  );

  const wb = XLSX.utils.book_new();
  const aboutSheet = XLSX.utils.aoa_to_sheet([
    ['Vineroot schedule export (tasks + dependencies + baselines)'],
    ['projectId', projectId],
    ['projectName', projectName ?? ''],
    ['exportedAt', new Date().toISOString()],
    [
      'Tasks and Dependencies use all tasks in the project (WBS rows when enabled). Baselines lists saved snapshots from the server (all indices 0–10).',
    ],
  ]);
  aboutSheet['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, aboutSheet, 'About');

  const tasksSheet = XLSX.utils.aoa_to_sheet([[...TASK_HEADERS], ...taskRows]);
  tasksSheet['!cols'] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 4 },
    { wch: 10 },
    { wch: 36 },
    { wch: 40 },
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 4 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 6 },
    { wch: 6 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 6 },
    { wch: 6 },
    { wch: 10 },
    { wch: 10 },
    { wch: 6 },
    { wch: 28 },
    { wch: 24 },
    { wch: 48 },
  ];
  XLSX.utils.book_append_sheet(wb, tasksSheet, 'Tasks');

  const depEdges = collectDependencyRows(flat);
  const depBody: (string | number | boolean | null)[][] = depEdges.map(({ dep, successor }) => {
    const predId = dep.blockingTask?.id ?? dep.blockingId;
    const predTitle = dep.blockingTask?.title ?? '';
    return [
      dep.id,
      predId ?? '',
      predTitle,
      successor.id,
      successor.title,
      dep.linkType ?? dep.type ?? '',
      dep.lagDays ?? '',
      dep.lagIsElapsed === true ? 'Y' : dep.lagIsElapsed === false ? 'N' : '',
    ];
  });
  const depsSheet = XLSX.utils.aoa_to_sheet([[...DEP_HEADERS], ...depBody]);
  depsSheet['!cols'] = [{ wch: 36 }, { wch: 36 }, { wch: 32 }, { wch: 36 }, { wch: 32 }, { wch: 10 }, { wch: 8 }, { wch: 6 }];
  XLSX.utils.book_append_sheet(wb, depsSheet, 'Dependencies');

  const baseSorted = [...baselineRows].sort((a, b) =>
    a.taskId === b.taskId ? a.baselineIndex - b.baselineIndex : a.taskId.localeCompare(b.taskId),
  );
  const baseBody = baseSorted.map((r) =>
    BASE_HEADERS.map((h) => escCell(r[h as keyof TaskBaselineRowDto])),
  );
  const baselinesSheet = XLSX.utils.aoa_to_sheet([[...BASE_HEADERS], ...baseBody]);
  baselinesSheet['!cols'] = [{ wch: 36 }, { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, baselinesSheet, 'Baselines');

  return wb;
}

export function downloadScheduleExcelWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}
