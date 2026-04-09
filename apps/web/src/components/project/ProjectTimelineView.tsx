import { useEffect, useMemo, useRef, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  eachDayOfInterval,
  differenceInDays,
  format,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfQuarter,
  endOfQuarter,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  ProjectBaselineSummaryDto,
  ProjectCriticalPathDto,
  TaskBaselineCompareRowDto,
  TaskBaselineRowDto,
} from '@vineroot/shared-types';
import { SCHEDULE_BASELINE_INDEX_MAX } from '@vineroot/shared-types';
import { Task, Section } from '../../types';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';
import { computeCriticalPathTaskIds } from '../../lib/timelineCriticalPath';
import { api } from '../../lib/api';

type Zoom = 'week' | 'month' | 'quarter';

interface ProjectTimelineViewProps {
  sections: Section[];
  projectId: string;
  /** When set, Critical path uses server CPM (`GET …/schedule/critical-path`) when CP mode is on. */
  workspaceId?: string;
  /** Shown in print header and Excel About sheet. */
  projectName?: string;
}

type TimelineRow = { task: Task; depth: number };

function readTimelineWbs(projectId: string): boolean {
  try {
    return sessionStorage.getItem(`vineroot:project:${projectId}:timelineWbs`) === '1';
  } catch {
    return false;
  }
}

function readTimelineCp(projectId: string): boolean {
  try {
    return sessionStorage.getItem(`vineroot:project:${projectId}:timelineCp`) === '1';
  } catch {
    return false;
  }
}

function readTimelineBaseline(projectId: string): boolean {
  try {
    return sessionStorage.getItem(`vineroot:project:${projectId}:timelineBaseline`) === '1';
  } catch {
    return false;
  }
}

function readTimelineBaselineIndex(projectId: string): number {
  try {
    const v = sessionStorage.getItem(`vineroot:project:${projectId}:timelineBaselineIndex`);
    if (v == null) return 0;
    const n = Number(v);
    if (
      Number.isInteger(n) &&
      n >= 0 &&
      n <= SCHEDULE_BASELINE_INDEX_MAX
    ) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

type TimelineScheduleFilter = 'all' | 'with_dates' | 'on_critical_path';

function readTimelineScheduleFilter(projectId: string): TimelineScheduleFilter {
  try {
    const v = sessionStorage.getItem(
      `vineroot:project:${projectId}:timelineScheduleFilter`,
    );
    if (v === 'with_dates' || v === 'on_critical_path') return v;
  } catch {
    /* ignore */
  }
  return 'all';
}

export type TaskBaselineSpan = { start: string | null; finish: string | null };

/** Server compare row: ghost bars + variance columns (source of truth). */
type TaskBaselineLoaded = TaskBaselineCompareRowDto;

const VAR_COL_W = 128;

function formatSignedInt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '0';
  return `${n > 0 ? '+' : ''}${n}`;
}

function formatSignedCostShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 0.0005) return '0';
  return `${n > 0 ? '+' : ''}${Math.round(n)}`;
}

function varianceDayTone(d: number | null | undefined): string {
  if (d == null) return 'text-gray-600';
  if (d > 5) return 'text-red-700 font-semibold';
  if (d > 0) return 'text-amber-700';
  if (d < 0) return 'text-emerald-700';
  return 'text-gray-600';
}

function workVarianceTone(m: number | null | undefined): string {
  if (m == null) return 'text-gray-600';
  if (m > 0) return 'text-amber-700';
  if (m < 0) return 'text-emerald-700';
  return 'text-gray-600';
}

function costVarianceTone(c: number | null | undefined): string {
  if (c == null) return 'text-gray-600';
  if (c > 0) return 'text-amber-700';
  if (c < 0) return 'text-emerald-700';
  return 'text-gray-600';
}

function collectDescendantTaskIds(task: Task): string[] {
  const out: string[] = [];
  for (const st of task.subtasks ?? []) {
    out.push(st.id, ...collectDescendantTaskIds(st));
  }
  return out;
}

function maxOfDefined(xs: (number | null | undefined)[]): number | null {
  const nums = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return nums.length ? Math.max(...nums) : null;
}

/** Own compare row and/or rolled-up maxima for WBS parents without a baseline row. */
type BaselineVarianceDisplay = {
  startCal: number | null;
  finishCal: number | null;
  finishWork: number | null;
  workMin: number | null;
  cost: number | null;
  rollup: boolean;
  direct?: TaskBaselineLoaded;
};

function resolveBaselineVarianceDisplay(
  task: Task,
  byId: Map<string, TaskBaselineLoaded>,
  wbs: boolean,
): BaselineVarianceDisplay | null {
  const direct = byId.get(task.id);
  if (direct) {
    return {
      startCal: direct.startVarianceDays,
      finishCal: direct.finishVarianceDays,
      finishWork: direct.finishVarianceWorkingDays ?? null,
      workMin: direct.workVarianceMinutes,
      cost: direct.costVariance,
      rollup: false,
      direct,
    };
  }
  if (!wbs || !(task.subtasks?.length)) return null;
  const rows = collectDescendantTaskIds(task)
    .map((id) => byId.get(id))
    .filter((r): r is TaskBaselineLoaded => r != null);
  if (!rows.length) return null;
  return {
    startCal: maxOfDefined(rows.map((r) => r.startVarianceDays)),
    finishCal: maxOfDefined(rows.map((r) => r.finishVarianceDays)),
    finishWork: maxOfDefined(rows.map((r) => r.finishVarianceWorkingDays)),
    workMin: maxOfDefined(rows.map((r) => r.workVarianceMinutes)),
    cost: maxOfDefined(rows.map((r) => r.costVariance)),
    rollup: true,
  };
}

function scheduleSnapshotToCsv(sections: Section[], wbs: boolean): string {
  const cols = [
    'taskId',
    'title',
    'status',
    'startDate',
    'dueDate',
    'isMilestone',
    'constraintType',
    'workMinutes',
    'percentComplete',
  ] as const;
  const esc = (v: unknown) => {
    if (v == null || v === '') return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines: string[] = [cols.join(',')];
  for (const s of sections) {
    for (const { task } of flattenSectionTasks(s.tasks, 0, wbs)) {
      lines.push(
        cols
          .map((c) => {
            if (c === 'workMinutes') return esc(task.workMinutes ?? '');
            return esc((task as unknown as Record<string, unknown>)[c]);
          })
          .join(','),
      );
    }
  }
  return lines.join('\r\n');
}

function scheduleFilterPredicate(
  task: Task,
  mode: TimelineScheduleFilter,
  cpSet: Set<string>,
): boolean {
  if (mode === 'all') return true;
  if (mode === 'with_dates') return !!(task.startDate && task.dueDate);
  if (mode === 'on_critical_path') return cpSet.has(task.id);
  return true;
}

function filterTasksForTimeline(
  tasks: Task[] | undefined,
  mode: TimelineScheduleFilter,
  cpSet: Set<string>,
  wbs: boolean,
): Task[] {
  if (mode === 'all') return tasks ?? [];
  const recur = (list: Task[] | undefined): Task[] => {
    const out: Task[] = [];
    for (const t of list ?? []) {
      const sub = wbs ? recur(t.subtasks) : [];
      const ok = scheduleFilterPredicate(t, mode, cpSet);
      if (ok || sub.length > 0) {
        out.push({
          ...t,
          subtasks: wbs ? sub : [],
        });
      }
    }
    return out;
  };
  return recur(tasks);
}

function filterSectionsForTimeline(
  sections: Section[],
  mode: TimelineScheduleFilter,
  cpSet: Set<string>,
  wbs: boolean,
): Section[] {
  if (mode === 'all') return sections;
  return sections.map((s) => ({
    ...s,
    tasks: filterTasksForTimeline(s.tasks, mode, cpSet, wbs),
  }));
}

function compareRowsToCsv(rows: TaskBaselineCompareRowDto[]): string {
  const cols = [
    'taskId',
    'baselineIndex',
    'baselineStart',
    'baselineFinish',
    'baselineWorkMinutes',
    'baselineCost',
    'currentStart',
    'currentFinish',
    'currentWorkMinutes',
    'currentCost',
    'startVarianceDays',
    'finishVarianceDays',
    'startVarianceWorkingDays',
    'finishVarianceWorkingDays',
    'workVarianceMinutes',
    'costVariance',
    'savedAt',
  ] as const;
  const esc = (v: unknown) => {
    if (v == null || v === '') return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(','));
  return [header, ...body].join('\r\n');
}

function downloadTextFile(content: string, filename: string, mime: string) {
  const bom = '\ufeff';
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function allTimelineTasks(sections: Section[], wbs: boolean): Task[] {
  const out: Task[] = [];
  for (const s of sections) {
    for (const { task } of flattenSectionTasks(s.tasks, 0, wbs)) {
      out.push(task);
    }
  }
  return out;
}

function flattenSectionTasks(
  tasks: Task[] | undefined,
  depth: number,
  wbs: boolean,
): TimelineRow[] {
  const out: TimelineRow[] = [];
  for (const t of tasks ?? []) {
    out.push({ task: t, depth: wbs ? depth : 0 });
    if (wbs && t.subtasks?.length) {
      out.push(...flattenSectionTasks(t.subtasks, depth + 1, true));
    }
  }
  return out;
}

function isRowMilestone(task: Task): boolean {
  if (task.isMilestone) return true;
  if (task.startDate && task.dueDate) {
    const a = task.startDate.slice(0, 10);
    const b = task.dueDate.slice(0, 10);
    if (a === b) return true;
  }
  return false;
}

function getParsedScheduleSegments(
  task: Task,
): { start: string; end: string }[] | null {
  const s = task.scheduleSegments;
  if (!Array.isArray(s) || s.length === 0) return null;
  const out: { start: string; end: string }[] = [];
  for (const x of s) {
    if (
      x &&
      typeof (x as { start?: unknown }).start === 'string' &&
      typeof (x as { end?: unknown }).end === 'string'
    ) {
      out.push({
        start: (x as { start: string }).start,
        end: (x as { end: string }).end,
      });
    }
  }
  return out.length ? out : null;
}

type TimelineBarLayout =
  | { kind: 'bar'; left: number; width: number }
  | { kind: 'bars'; segments: { left: number; width: number }[] }
  | { kind: 'milestone'; cx: number };

/** Bar span(s), split segments, or single-day milestone anchor (center x in px). */
function taskTimelineLayout(
  task: Task,
  rangeStart: Date,
  totalDays: number,
  DAY_PX: number,
): TimelineBarLayout | null {
  const segs = getParsedScheduleSegments(task);
  if (segs && segs.length > 0 && !isRowMilestone(task)) {
    const rects: { left: number; width: number }[] = [];
    for (const s of segs) {
      const b = barGeometry(
        {
          startDate: s.start,
          dueDate: s.end,
          isMilestone: false,
        } as Task,
        rangeStart,
        totalDays,
        DAY_PX,
      );
      if (b) rects.push(b);
    }
    if (rects.length) return { kind: 'bars', segments: rects };
  }
  if (isRowMilestone(task)) {
    if (!task.dueDate) return null;
    const end = parseISO(task.dueDate);
    const offsetDays = differenceInDays(end, rangeStart);
    const cx = offsetDays * DAY_PX + DAY_PX / 2;
    if (cx < 0 || cx > totalDays * DAY_PX) return null;
    return { kind: 'milestone', cx };
  }
  const bar = barGeometry(task, rangeStart, totalDays, DAY_PX);
  if (!bar) return null;
  return { kind: 'bar', left: bar.left, width: bar.width };
}

const COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  READY: 'bg-blue-400',
  IN_PROGRESS: 'bg-brand-500',
  BLOCKED: 'bg-red-400',
  IN_REVIEW: 'bg-yellow-400',
  DONE: 'bg-green-500',
  CANCELLED: 'bg-gray-300',
};

/** Match row heights between label column and grid (for dependency lines). */
const HEADER_H = 40;
const SECTION_H = 36;
const TASK_H = 40;

function getRange(anchor: Date, zoom: Zoom): { start: Date; end: Date } {
  if (zoom === 'week') return { start: startOfWeek(anchor), end: endOfWeek(addWeeks(anchor, 2)) };
  if (zoom === 'month') return { start: startOfMonth(anchor), end: endOfMonth(addMonths(anchor, 1)) };
  return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
}

function barGeometry(
  task: Task,
  rangeStart: Date,
  totalDays: number,
  DAY_PX: number,
): { left: number; width: number } | null {
  if (!task.dueDate) return null;
  const taskStart = task.startDate ? parseISO(task.startDate) : parseISO(task.dueDate);
  const taskEnd = parseISO(task.dueDate);
  const offsetDays = differenceInDays(taskStart, rangeStart);
  const durationDays = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
  const left = offsetDays * DAY_PX;
  const width = durationDays * DAY_PX;
  if (left + width < 0 || left > totalDays * DAY_PX) return null;
  return { left, width: Math.max(width, DAY_PX * 0.9) };
}

/** Layout for saved baseline dates (ghost bar / diamond), independent of current task dates. */
function baselineSpanLayout(
  span: TaskBaselineSpan,
  rangeStart: Date,
  totalDays: number,
  DAY_PX: number,
): { kind: 'bar'; left: number; width: number } | { kind: 'milestone'; cx: number } | null {
  if (!span.finish) return null;
  const taskEnd = parseISO(span.finish);
  const taskStart = span.start ? parseISO(span.start) : taskEnd;
  const a = format(taskStart, 'yyyy-MM-dd');
  const b = format(taskEnd, 'yyyy-MM-dd');
  if (a === b) {
    const offsetDays = differenceInDays(taskEnd, rangeStart);
    const cx = offsetDays * DAY_PX + DAY_PX / 2;
    if (cx < 0 || cx > totalDays * DAY_PX) return null;
    return { kind: 'milestone', cx };
  }
  const pseudo: Pick<Task, 'startDate' | 'dueDate'> = {
    startDate: span.start ?? span.finish,
    dueDate: span.finish,
  };
  const bar = barGeometry(pseudo as Task, rangeStart, totalDays, DAY_PX);
  if (!bar) return null;
  return { kind: 'bar', left: bar.left, width: bar.width };
}

function scheduleRowTooltip(
  task: Task,
  disp: BaselineVarianceDisplay | null,
  baselineIndex: number,
): string {
  const parts = [task.title];
  if (!disp) return parts.join('\n');
  if (disp.rollup) {
    parts.push(
      `WBS roll-up: max variance among descendants (task has no baseline row in BL${baselineIndex})`,
    );
    if (disp.startCal != null && disp.startCal !== 0) {
      parts.push(`ΔS cal: ${disp.startCal > 0 ? '+' : ''}${disp.startCal}d`);
    }
    if (disp.finishCal != null && disp.finishCal !== 0) {
      parts.push(`ΔF cal: ${disp.finishCal > 0 ? '+' : ''}${disp.finishCal}d`);
    }
    if (disp.finishWork != null && disp.finishWork !== 0) {
      parts.push(`ΔF work: ${disp.finishWork > 0 ? '+' : ''}${disp.finishWork}d`);
    }
    if (disp.workMin != null && disp.workMin !== 0) {
      parts.push(`Δ work: ${disp.workMin > 0 ? '+' : ''}${disp.workMin} min`);
    }
    if (disp.cost != null && Math.abs(disp.cost) >= 0.005) {
      parts.push(`Δ cost: ${disp.cost > 0 ? '+' : ''}${Math.round(disp.cost)}`);
    }
    return parts.join('\n');
  }
  const row = disp.direct;
  if (!row?.baselineFinish) return parts.join('\n');
  const bs = row.baselineStart
    ? format(parseISO(row.baselineStart), 'MMM d, yyyy')
    : '—';
  const bf = format(parseISO(row.baselineFinish), 'MMM d, yyyy');
  parts.push(`Baseline ${baselineIndex}: ${bs} → ${bf}`);
  if (row.startVarianceDays != null && row.startVarianceDays !== 0) {
    parts.push(
      `Start vs baseline: ${row.startVarianceDays > 0 ? '+' : ''}${row.startVarianceDays}d (calendar)`,
    );
  }
  if (
    row.startVarianceWorkingDays != null &&
    row.startVarianceWorkingDays !== 0
  ) {
    parts.push(
      `Start working Δ: ${row.startVarianceWorkingDays > 0 ? '+' : ''}${row.startVarianceWorkingDays}d`,
    );
  }
  if (row.finishVarianceDays != null && row.finishVarianceDays !== 0) {
    parts.push(
      `Finish vs baseline: ${row.finishVarianceDays > 0 ? '+' : ''}${row.finishVarianceDays}d (calendar)`,
    );
  }
  if (
    row.finishVarianceWorkingDays != null &&
    row.finishVarianceWorkingDays !== 0
  ) {
    parts.push(
      `Finish working Δ: ${row.finishVarianceWorkingDays > 0 ? '+' : ''}${row.finishVarianceWorkingDays}d`,
    );
  }
  if (row.workVarianceMinutes != null && row.workVarianceMinutes !== 0) {
    parts.push(
      `Work vs baseline: ${row.workVarianceMinutes > 0 ? '+' : ''}${row.workVarianceMinutes} min`,
    );
  }
  if (row.costVariance != null && Math.abs(row.costVariance) >= 0.005) {
    parts.push(
      `Cost vs baseline: ${row.costVariance > 0 ? '+' : ''}${Math.round(row.costVariance)}`,
    );
  }
  if (row.savedAt) {
    parts.push(`Saved: ${format(parseISO(row.savedAt), 'MMM d, yyyy HH:mm')}`);
  }
  return parts.join('\n');
}

type RowLayout = {
  left: number;
  width: number;
  rowCenterY: number;
  milestone?: boolean;
};

function buildRowLayouts(
  sections: Section[],
  rangeStart: Date,
  totalDays: number,
  DAY_PX: number,
  wbs: boolean,
): { byTaskId: Map<string, RowLayout>; totalHeight: number } {
  const byTaskId = new Map<string, RowLayout>();
  let y = HEADER_H;
  for (const section of sections) {
    y += SECTION_H;
    const rows = flattenSectionTasks(section.tasks, 0, wbs);
    for (const { task } of rows) {
      const lay = taskTimelineLayout(task, rangeStart, totalDays, DAY_PX);
      const rowCenterY = y + TASK_H / 2;
      if (lay?.kind === 'bars') {
        let minL = Infinity;
        let maxR = -Infinity;
        for (const s of lay.segments) {
          minL = Math.min(minL, s.left);
          maxR = Math.max(maxR, s.left + s.width);
        }
        if (minL !== Infinity) {
          byTaskId.set(task.id, {
            left: minL,
            width: Math.max(0, maxR - minL),
            rowCenterY,
          });
        } else {
          byTaskId.set(task.id, { left: 0, width: 0, rowCenterY });
        }
      } else if (lay?.kind === 'bar') {
        byTaskId.set(task.id, {
          left: lay.left,
          width: lay.width,
          rowCenterY,
        });
      } else if (lay?.kind === 'milestone') {
        byTaskId.set(task.id, {
          left: lay.cx,
          width: 0,
          rowCenterY,
          milestone: true,
        });
      } else {
        byTaskId.set(task.id, { left: 0, width: 0, rowCenterY });
      }
      y += TASK_H;
    }
  }
  return { byTaskId, totalHeight: y };
}

export function ProjectTimelineView({
  sections,
  projectId,
  workspaceId,
  projectName,
}: ProjectTimelineViewProps) {
  const [zoom, setZoom] = useState<Zoom>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [wbsMode, setWbsMode] = useState(() => readTimelineWbs(projectId));
  const [cpMode, setCpMode] = useState(() => readTimelineCp(projectId));
  const [baselineMode, setBaselineMode] = useState(() => readTimelineBaseline(projectId));
  const [baselineIndex, setBaselineIndex] = useState<number>(() =>
    readTimelineBaselineIndex(projectId),
  );
  const [scheduleFilter, setScheduleFilter] = useState<TimelineScheduleFilter>(() =>
    readTimelineScheduleFilter(projectId),
  );
  const [baselineByTaskId, setBaselineByTaskId] = useState<Map<string, TaskBaselineLoaded>>(
    () => new Map(),
  );
  const [baselineRefreshKey, setBaselineRefreshKey] = useState(0);
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [excelExporting, setExcelExporting] = useState(false);
  const [baselineSummary, setBaselineSummary] = useState<ProjectBaselineSummaryDto | null>(
    null,
  );
  const [serverCpData, setServerCpData] = useState<ProjectCriticalPathDto | null>(null);
  const [serverCpFailed, setServerCpFailed] = useState(false);
  const openTask = useUIStore((s) => s.openTask);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWbsMode(readTimelineWbs(projectId));
    setCpMode(readTimelineCp(projectId));
    setBaselineMode(readTimelineBaseline(projectId));
    setBaselineIndex(readTimelineBaselineIndex(projectId));
    setScheduleFilter(readTimelineScheduleFilter(projectId));
  }, [projectId]);

  useEffect(() => {
    setServerCpData(null);
    setServerCpFailed(false);
    if (!workspaceId) return;
    let cancelled = false;
    void api
      .get<ProjectCriticalPathDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/critical-path`,
      )
      .then((res) => {
        if (!cancelled) {
          setServerCpData(res.data);
          setServerCpFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerCpData(null);
          setServerCpFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  const drivingEdgeKeys = useMemo(() => {
    const s = new Set<string>();
    for (const e of serverCpData?.drivingEdges ?? []) {
      s.add(`${e.fromTaskId}\t${e.toTaskId}`);
    }
    return s;
  }, [serverCpData?.drivingEdges]);

  useEffect(() => {
    if (!baselineMode || !workspaceId) {
      setBaselineByTaskId(new Map());
      return;
    }
    let cancelled = false;
    void api
      .get<TaskBaselineCompareRowDto[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/baselines/compare`,
        { params: { index: baselineIndex } },
      )
      .then((res) => {
        const m = new Map<string, TaskBaselineLoaded>();
        for (const r of res.data ?? []) {
          m.set(r.taskId, r);
        }
        if (!cancelled) setBaselineByTaskId(m);
      })
      .catch(() => {
        if (!cancelled) setBaselineByTaskId(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [baselineMode, baselineIndex, workspaceId, projectId, baselineRefreshKey]);

  useEffect(() => {
    if (!baselineMode || !workspaceId) {
      setBaselineSummary(null);
      return;
    }
    let cancelled = false;
    void api
      .get<ProjectBaselineSummaryDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/baselines/summary`,
        { params: { index: baselineIndex } },
      )
      .then((res) => {
        if (!cancelled) setBaselineSummary(res.data);
      })
      .catch(() => {
        if (!cancelled) setBaselineSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [baselineMode, baselineIndex, workspaceId, projectId, baselineRefreshKey]);

  const saveBaselineSnapshot = () => {
    if (!workspaceId || baselineSaving) return;
    setBaselineSaving(true);
    void api
      .post(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/baselines`,
        {},
        { params: { index: baselineIndex } },
      )
      .then(() => setBaselineRefreshKey((k) => k + 1))
      .finally(() => setBaselineSaving(false));
  };

  const clearBaselineSnapshot = () => {
    if (!workspaceId || baselineSaving) return;
    if (
      !window.confirm(
        `Clear baseline ${baselineIndex} for every task in this project? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBaselineSaving(true);
    void api
      .delete(`/workspaces/${workspaceId}/projects/${projectId}/schedule/baselines`, {
        params: { index: baselineIndex },
      })
      .then(() => setBaselineRefreshKey((k) => k + 1))
      .finally(() => setBaselineSaving(false));
  };

  const exportBaselineCompareCsv = () => {
    const rows = [...baselineByTaskId.values()].sort((a, b) =>
      a.taskId.localeCompare(b.taskId),
    );
    if (!rows.length) return;
    const csv = compareRowsToCsv(rows);
    downloadTextFile(
      csv,
      `baseline-compare-${projectId}-BL${baselineIndex}.csv`,
      'text/csv;charset=utf-8',
    );
  };

  const persistWbs = (v: boolean) => {
    setWbsMode(v);
    try {
      sessionStorage.setItem(`vineroot:project:${projectId}:timelineWbs`, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const persistCp = (v: boolean) => {
    setCpMode(v);
    try {
      sessionStorage.setItem(`vineroot:project:${projectId}:timelineCp`, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const persistBaseline = (v: boolean) => {
    setBaselineMode(v);
    try {
      sessionStorage.setItem(`vineroot:project:${projectId}:timelineBaseline`, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const persistBaselineIndex = (idx: number) => {
    if (idx < 0 || idx > SCHEDULE_BASELINE_INDEX_MAX) return;
    setBaselineIndex(idx);
    try {
      sessionStorage.setItem(`vineroot:project:${projectId}:timelineBaselineIndex`, String(idx));
    } catch {
      /* ignore */
    }
  };

  const persistScheduleFilter = (mode: TimelineScheduleFilter) => {
    setScheduleFilter(mode);
    try {
      sessionStorage.setItem(
        `vineroot:project:${projectId}:timelineScheduleFilter`,
        mode,
      );
    } catch {
      /* ignore */
    }
  };

  const { start, end } = useMemo(() => getRange(anchor, zoom), [anchor, zoom]);
  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);
  const totalDays = days.length;
  const DAY_PX = zoom === 'week' ? 60 : zoom === 'month' ? 32 : 16;
  const gridWidth = totalDays * DAY_PX;

  const flatTasks = useMemo(
    () => allTimelineTasks(sections, wbsMode),
    [sections, wbsMode],
  );
  const clientCriticalIds = useMemo(
    () => computeCriticalPathTaskIds(flatTasks),
    [flatTasks],
  );
  /**
   * When workspace + CP filter/highlight needs server data, use GET critical-path (CPM).
   * Otherwise client longest-path is fine for non-schedule UI.
   */
  const criticalIdsResolved = useMemo(() => {
    if (!workspaceId) return clientCriticalIds;
    const needServerCp = cpMode || scheduleFilter === 'on_critical_path';
    if (!needServerCp) return clientCriticalIds;
    if (serverCpData) return new Set(serverCpData.criticalTaskIds ?? []);
    if (serverCpFailed) return clientCriticalIds;
    return new Set<string>();
  }, [
    workspaceId,
    cpMode,
    scheduleFilter,
    serverCpData,
    serverCpFailed,
    clientCriticalIds,
  ]);

  const cpSet = useMemo(() => {
    if (!cpMode) return new Set<string>();
    return criticalIdsResolved;
  }, [cpMode, criticalIdsResolved]);

  const displaySections = useMemo(
    () =>
      filterSectionsForTimeline(
        sections,
        scheduleFilter,
        criticalIdsResolved,
        wbsMode,
      ),
    [sections, scheduleFilter, criticalIdsResolved, wbsMode],
  );

  const { byTaskId, totalHeight } = useMemo(
    () => buildRowLayouts(displaySections, start, totalDays, DAY_PX, wbsMode),
    [displaySections, start, totalDays, DAY_PX, wbsMode],
  );

  const exportScheduleSnapshotCsv = () => {
    const csv = scheduleSnapshotToCsv(displaySections, wbsMode);
    downloadTextFile(
      csv,
      `schedule-snapshot-${projectId}.csv`,
      'text/csv;charset=utf-8',
    );
  };

  const printScheduleSnapshot = () => {
    window.print();
  };

  const exportScheduleExcelTemplate = async () => {
    setExcelExporting(true);
    try {
      const [{ buildScheduleExcelWorkbook, downloadScheduleExcelWorkbook }, baselineRows] =
        await Promise.all([
          import('../../lib/scheduleExcelExport'),
          workspaceId
            ? api
                .get<TaskBaselineRowDto[]>(
                  `/workspaces/${workspaceId}/projects/${projectId}/schedule/baselines`,
                )
                .then((res) => res.data ?? [])
            : Promise.resolve<TaskBaselineRowDto[]>([]),
        ]);
      const wb = buildScheduleExcelWorkbook({
        sections,
        projectId,
        projectName,
        baselineRows,
        wbs: true,
      });
      downloadScheduleExcelWorkbook(wb, `schedule-template-${projectId}.xlsx`);
    } finally {
      setExcelExporting(false);
    }
  };

  const dependencyPaths = useMemo(() => {
    const paths: { d: string; onCp: boolean; driving: boolean }[] = [];
    for (const section of displaySections) {
      for (const { task } of flattenSectionTasks(section.tasks, 0, wbsMode)) {
        for (const dep of task.waitingOn ?? []) {
          const blockerId = dep.blockingTask?.id ?? dep.blockingId;
          if (!blockerId) continue;
          const from = byTaskId.get(blockerId);
          const to = byTaskId.get(task.id);
          if (!from || !to) continue;
          if (!from.milestone && from.width <= 0) continue;
          if (!to.milestone && to.width <= 0) continue;
          const fx = from.milestone ? from.left : from.left + from.width;
          const fy = from.rowCenterY;
          const tx = to.milestone ? to.left : to.left;
          const ty = to.rowCenterY;
          const mid = (fx + tx) / 2;
          const onCp =
            criticalIdsResolved.has(blockerId) && criticalIdsResolved.has(task.id);
          const driving =
            workspaceId != null && drivingEdgeKeys.has(`${blockerId}\t${task.id}`);
          paths.push({
            d: `M ${fx} ${fy} C ${mid} ${fy}, ${mid} ${ty}, ${tx} ${ty}`,
            onCp,
            driving,
          });
        }
      }
    }
    return paths;
  }, [
    displaySections,
    byTaskId,
    wbsMode,
    criticalIdsResolved,
    workspaceId,
    drivingEdgeKeys,
  ]);

  const todayOffset = differenceInDays(new Date(), start);
  const todayPx = Math.max(0, todayOffset * DAY_PX);

  function navigate(dir: 1 | -1) {
    if (zoom === 'week') setAnchor((a) => addWeeks(a, dir * 2));
    else if (zoom === 'month') setAnchor((a) => addMonths(a, dir));
    else setAnchor((a) => addMonths(a, dir * 3));
  }

  return (
    <div
      id="vineroot-schedule-print-root"
      data-testid="schedule-print-root"
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="hidden print:block shrink-0 px-6 py-3 border-b border-gray-300 bg-white text-gray-900">
        <div className="text-base font-semibold">
          {projectName ?? `Project ${projectId}`}
        </div>
        <div className="text-sm text-gray-600 mt-0.5">
          {format(start, 'MMM d, yyyy')} – {format(end, 'MMM d, yyyy')}
        </div>
      </div>
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white print:hidden">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['week', 'month', 'quarter'] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={clsx(
                'px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize',
                zoom === z ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {z}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
            {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="ml-2 text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => persistWbs(!wbsMode)}
            title="Show nested subtasks as indented rows (work breakdown)"
            className={clsx(
              'ml-2 text-xs px-2 py-1 border rounded-md transition-colors',
              wbsMode
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-300 hover:bg-gray-50 text-gray-600',
            )}
          >
            WBS
          </button>
          <select
            className="ml-2 text-xs border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 max-w-[10rem]"
            value={scheduleFilter}
            aria-label="Schedule row filter"
            onChange={(e) =>
              persistScheduleFilter(e.target.value as TimelineScheduleFilter)
            }
            title="Filter which tasks appear on the timeline"
          >
            <option value="all">All tasks</option>
            <option value="with_dates">With dates</option>
            <option value="on_critical_path">Critical path</option>
          </select>
          <button
            type="button"
            onClick={exportScheduleSnapshotCsv}
            title="CSV snapshot of visible tasks (respects filter and WBS)"
            className="ml-2 text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
          >
            Export schedule CSV
          </button>
          <button
            type="button"
            onClick={printScheduleSnapshot}
            title="Open the browser print dialog — save as PDF for a snapshot"
            className="ml-2 text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
          >
            Print / PDF
          </button>
          <button
            type="button"
            onClick={() => void exportScheduleExcelTemplate()}
            disabled={excelExporting}
            title="Excel workbook: all tasks (WBS), dependency edges, and saved baseline rows (requires workspace for baselines)"
            className="ml-2 text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50"
          >
            {excelExporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            type="button"
            onClick={() => persistCp(!cpMode)}
            title={
              workspaceId
                ? 'Critical path from server CPM (authoritative). Amber links = driving predecessors from engine.'
                : 'Critical path uses client-side longest path (no workspace); open project from a workspace for server CPM.'
            }
            className={clsx(
              'ml-2 text-xs px-2 py-1 border rounded-md transition-colors',
              cpMode
                ? 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-gray-300 hover:bg-gray-50 text-gray-600',
            )}
          >
            Critical path
          </button>
          <button
            type="button"
            onClick={() => persistBaseline(!baselineMode)}
            title={
              workspaceId
                ? 'Baseline: ghost bars, Δ cal/work finish, roll-up on WBS parents, summary, Save/Clear/CSV'
                : 'Open this project from a workspace context to load baselines'
            }
            disabled={!workspaceId}
            className={clsx(
              'ml-2 text-xs px-2 py-1 border rounded-md transition-colors',
              !workspaceId && 'opacity-50 cursor-not-allowed',
              baselineMode
                ? 'border-slate-500 bg-slate-50 text-slate-800'
                : 'border-gray-300 hover:bg-gray-50 text-gray-600',
            )}
          >
            Baseline
          </button>
          {baselineMode && workspaceId ? (
            <>
              <select
                aria-label="Baseline set"
                className="ml-1 text-xs border border-gray-300 rounded-md px-1.5 py-1 bg-white text-gray-700 max-h-32"
                value={baselineIndex}
                onChange={(e) => persistBaselineIndex(Number(e.target.value))}
              >
                {Array.from({ length: SCHEDULE_BASELINE_INDEX_MAX + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    BL{i}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveBaselineSnapshot}
                disabled={baselineSaving}
                title="Snapshot current schedule into this baseline slot (all tasks)"
                className="ml-1 text-xs px-2 py-1 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={clearBaselineSnapshot}
                disabled={baselineSaving}
                title="Remove this baseline slot for all tasks in the project"
                className="ml-0.5 text-xs px-2 py-1 border border-red-200 rounded-md hover:bg-red-50 text-red-800 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={exportBaselineCompareCsv}
                disabled={baselineSaving || baselineByTaskId.size === 0}
                title="Download compare rows (incl. calendar & working-day variance) as CSV"
                className="ml-0.5 text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50"
              >
                Export CSV
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2 border-b border-gray-200 bg-white text-[11px] text-gray-600 print:hidden">
        {workspaceId ? (
          serverCpFailed ? (
            <span className="text-amber-800 font-medium">
              CPM: client longest-path (server unavailable)
            </span>
          ) : serverCpData ? (
            <span className="text-emerald-800">
              CPM: server engine — critical path & driving links
            </span>
          ) : (
            <span className="text-gray-500">CPM: loading…</span>
          )
        ) : (
          <span>CPM: client longest-path — open project from a workspace for server CPM</span>
        )}
        <span className="text-gray-300" aria-hidden>
          |
        </span>
        <span className="text-gray-500">Links:</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-6 h-0.5 rounded-full bg-amber-600"
            aria-hidden
          />
          Driving
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-6 h-0.5 rounded-full bg-amber-600/80"
            aria-hidden
          />
          Critical path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 rounded-full bg-slate-400" aria-hidden />
          Other
        </span>
      </div>

      {baselineMode && workspaceId && baselineSummary ? (
        <div className="px-6 py-2 border-b border-gray-100 bg-slate-50/90 text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1 print:hidden">
          <span>
            <span className="font-medium text-gray-800">
              {baselineSummary.tasksWithBaselineCount}
            </span>
            /{baselineSummary.projectTaskCount} tasks baselined
          </span>
          {baselineSummary.finishLateCount > 0 ? (
            <span className="text-amber-800 font-medium">
              {baselineSummary.finishLateCount} finish late
            </span>
          ) : null}
          {baselineSummary.finishEarlyCount > 0 ? (
            <span className="text-emerald-800">
              {baselineSummary.finishEarlyCount} finish early
            </span>
          ) : null}
          {baselineSummary.avgFinishVarianceDays != null ? (
            <span title="Mean finish variance (calendar days), tasks with both dates">
              Avg finish Δ:{' '}
              {baselineSummary.avgFinishVarianceDays > 0 ? '+' : ''}
              {baselineSummary.avgFinishVarianceDays.toFixed(1)}d
            </span>
          ) : null}
          {baselineSummary.maxFinishSlipDays != null && baselineSummary.maxFinishSlipDays > 0 ? (
            <span className="text-red-800/90">
              Max slip: +{baselineSummary.maxFinishSlipDays}d cal
            </span>
          ) : null}
          {baselineSummary.maxFinishSlipWorkingDays != null &&
          baselineSummary.maxFinishSlipWorkingDays > 0 ? (
            <span className="text-red-800/90" title="Project working calendar">
              Max slip: +{baselineSummary.maxFinishSlipWorkingDays}d work
            </span>
          ) : null}
          {baselineSummary.avgFinishVarianceWorkingDays != null ? (
            <span title="Mean finish variance in working days (where calendar applies)">
              Avg finish Δ work:{' '}
              {baselineSummary.avgFinishVarianceWorkingDays > 0 ? '+' : ''}
              {baselineSummary.avgFinishVarianceWorkingDays.toFixed(1)}d
            </span>
          ) : null}
          {baselineSummary.sumCostVariance != null &&
          Math.abs(baselineSummary.sumCostVariance) >= 0.01 ? (
            <span title="Sum of per-task cost variances where both sides exist">
              Σ cost Δ: {baselineSummary.sumCostVariance > 0 ? '+' : ''}
              {Math.round(baselineSummary.sumCostVariance)}
            </span>
          ) : null}
          {baselineSummary.latestBaselineSavedAt ? (
            <span className="text-gray-500 ml-auto">
              Last baseline save:{' '}
              {format(parseISO(baselineSummary.latestBaselineSavedAt), 'MMM d, yyyy HH:mm')}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:min-h-0">
        <div
          className={clsx(
            'flex-shrink-0 border-r border-gray-200 overflow-y-auto scrollbar-thin print:overflow-visible',
            baselineMode && workspaceId ? 'w-[26rem]' : 'w-64',
          )}
        >
          <div
            className="flex border-b border-gray-200 bg-gray-50 shrink-0 items-stretch"
            style={{ height: HEADER_H }}
          >
            <div className="flex-1 min-w-0" />
            {baselineMode && workspaceId ? (
              <div
                className="flex flex-none items-center justify-center gap-0.5 text-[9px] font-semibold text-gray-500 border-l border-gray-100 bg-gray-50 tabular-nums"
                style={{ width: VAR_COL_W, minWidth: VAR_COL_W }}
              >
                <span className="w-5 text-center" title="Start variance (calendar days)">
                  ΔS
                </span>
                <span className="w-5 text-center" title="Finish variance (calendar days)">
                  ΔF
                </span>
                <span className="w-5 text-center" title="Finish variance (working days, project calendar)">
                  ΔFw
                </span>
                <span className="w-5 text-center" title="Work variance (minutes)">
                  ΔW
                </span>
                <span className="w-5 text-center" title="Cost variance (rounded units)">
                  ΔC
                </span>
              </div>
            ) : null}
          </div>
          {displaySections.map((section) => (
            <div key={section.id}>
              <div
                className="flex items-stretch bg-gray-50 border-b border-gray-100"
                style={{ minHeight: SECTION_H }}
              >
                <div className="px-4 flex flex-1 min-w-0 items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
                    {section.name}
                  </span>
                </div>
                {baselineMode && workspaceId ? (
                  <div
                    className="flex-none border-l border-gray-100 bg-gray-50/80"
                    style={{ width: VAR_COL_W, minWidth: VAR_COL_W }}
                  />
                ) : null}
              </div>
              {flattenSectionTasks(section.tasks, 0, wbsMode).map(({ task, depth }) => {
                const disp = resolveBaselineVarianceDisplay(
                  task,
                  baselineByTaskId,
                  wbsMode,
                );
                return (
                  <div
                    key={task.id}
                    style={{ height: TASK_H }}
                    className="flex items-stretch border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => openTask(task.id)}
                  >
                    {baselineMode && workspaceId ? (
                      <div
                        className="flex flex-none items-center justify-center gap-0.5 tabular-nums text-[10px] border-r border-gray-100 px-0.5 font-medium bg-white/90"
                        style={{ width: VAR_COL_W, minWidth: VAR_COL_W }}
                      >
                        <span
                          className={clsx(
                            'w-5 text-center',
                            varianceDayTone(disp?.startCal),
                          )}
                          title={
                            disp?.rollup
                              ? 'WBS roll-up: max start Δ (calendar) among subtasks'
                              : 'Start variance (calendar days)'
                          }
                        >
                          {formatSignedInt(disp?.startCal)}
                        </span>
                        <span
                          className={clsx(
                            'w-5 text-center',
                            varianceDayTone(disp?.finishCal),
                          )}
                          title={
                            disp?.rollup
                              ? 'WBS roll-up: max finish Δ (calendar) among subtasks'
                              : 'Finish variance (calendar days)'
                          }
                        >
                          {formatSignedInt(disp?.finishCal)}
                        </span>
                        <span
                          className={clsx(
                            'w-5 text-center',
                            varianceDayTone(disp?.finishWork),
                          )}
                          title={
                            disp?.rollup
                              ? 'WBS roll-up: max finish Δ (working days) among subtasks'
                              : 'Finish variance (working days, project calendar)'
                          }
                        >
                          {formatSignedInt(disp?.finishWork)}
                        </span>
                        <span
                          className={clsx(
                            'w-5 text-center',
                            workVarianceTone(disp?.workMin),
                          )}
                          title={
                            disp?.rollup
                              ? 'WBS roll-up: max work variance among subtasks'
                              : 'Work variance (minutes)'
                          }
                        >
                          {formatSignedInt(disp?.workMin)}
                        </span>
                        <span
                          className={clsx(
                            'w-5 text-center',
                            costVarianceTone(disp?.cost),
                          )}
                          title={
                            disp?.rollup
                              ? 'WBS roll-up: max cost variance among subtasks'
                              : 'Cost variance (current − baseline)'
                          }
                        >
                          {formatSignedCostShort(disp?.cost)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      className="flex-1 min-w-0 flex items-center text-sm text-gray-700 truncate pr-4"
                      style={{ paddingLeft: 16 + depth * 14 }}
                      title={scheduleRowTooltip(task, disp, baselineIndex)}
                    >
                      {task.title}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          className="flex-1 overflow-auto scrollbar-thin print:overflow-visible"
          ref={timelineRef}
        >
          <div
            className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10"
            style={{ width: gridWidth, height: HEADER_H }}
          >
            {days.map((day) => (
              <div
                key={day.toISOString()}
                style={{ width: DAY_PX, minWidth: DAY_PX, height: HEADER_H }}
                className={clsx(
                  'text-center text-xs flex items-center justify-center border-r border-gray-100 flex-shrink-0',
                  isToday(day) ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-gray-500',
                )}
              >
                {zoom === 'week'
                  ? format(day, 'EEE d')
                  : zoom === 'month'
                    ? format(day, 'd')
                    : day.getDate() === 1
                      ? format(day, 'MMM')
                      : ''}
              </div>
            ))}
          </div>

          <div className="relative" style={{ width: gridWidth, minHeight: totalHeight }}>
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute top-0 w-px bg-red-400 z-10 pointer-events-none"
                style={{ left: todayPx, height: totalHeight }}
              />
            )}

            <svg
              width={gridWidth}
              height={totalHeight}
              className="absolute top-0 left-0 z-[5] pointer-events-none overflow-visible"
              aria-hidden
            >
              {dependencyPaths.map((p, i) => (
                <path
                  key={i}
                  d={p.d}
                  fill="none"
                  stroke={
                    p.driving
                      ? 'rgb(180 83 9)'
                      : p.onCp
                        ? 'rgb(217 119 6)'
                        : 'rgb(148 163 184)'
                  }
                  strokeWidth={p.driving ? 2.75 : p.onCp ? 2.25 : 1.5}
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {displaySections.map((section) => (
              <div key={section.id}>
                <div
                  className="border-b border-gray-100 bg-gray-50/50 shrink-0"
                  style={{ height: SECTION_H }}
                />
                {flattenSectionTasks(section.tasks, 0, wbsMode).map(({ task }) => {
                  const lay = taskTimelineLayout(task, start, totalDays, DAY_PX);
                  const directRow = baselineMode ? baselineByTaskId.get(task.id) : undefined;
                  const bSpanForLayout: TaskBaselineSpan | undefined = directRow
                    ? {
                        start: directRow.baselineStart,
                        finish: directRow.baselineFinish,
                      }
                    : undefined;
                  const bLay =
                    bSpanForLayout && baselineMode
                      ? baselineSpanLayout(bSpanForLayout, start, totalDays, DAY_PX)
                      : null;
                  const dispRow = resolveBaselineVarianceDisplay(
                    task,
                    baselineByTaskId,
                    wbsMode,
                  );
                  const tip = scheduleRowTooltip(task, dispRow, baselineIndex);
                  return (
                    <div
                      key={task.id}
                      className="relative border-b border-gray-100 hover:bg-gray-50/50 group shrink-0"
                      style={{ height: TASK_H }}
                    >
                      {bLay?.kind === 'bar' ? (
                        <div
                          className="absolute top-2 h-5 rounded-md border border-dashed border-slate-400/80 bg-slate-200/50 z-0 pointer-events-none"
                          style={{ left: bLay.left, width: bLay.width }}
                          title={tip}
                          aria-hidden
                        />
                      ) : bLay?.kind === 'milestone' ? (
                        <div
                          className="absolute top-1/2 w-3 h-3 rounded-sm border border-dashed border-slate-400/90 bg-slate-200/60 z-0 pointer-events-none"
                          style={{ left: bLay.cx, transform: 'translate(-50%, -50%) rotate(45deg)' }}
                          title={tip}
                          aria-hidden
                        />
                      ) : null}
                      {lay?.kind === 'bars' ? (
                        lay.segments.map((seg, si) => (
                          <button
                            key={si}
                            type="button"
                            onClick={() => openTask(task.id)}
                            className={clsx(
                              'absolute top-1.5 h-7 rounded-md text-white text-xs flex items-center px-1 truncate shadow-sm transition-opacity hover:opacity-90 z-[1]',
                              COLORS[task.status] ?? 'bg-gray-400',
                              cpMode &&
                                cpSet.has(task.id) &&
                                'ring-2 ring-amber-500 ring-offset-1',
                            )}
                            style={{ left: seg.left, width: seg.width }}
                            title={tip}
                          >
                            {si === 0 && seg.width > 48 ? task.title : ''}
                          </button>
                        ))
                      ) : lay?.kind === 'bar' ? (
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className={clsx(
                            'absolute top-1.5 h-7 rounded-md text-white text-xs flex items-center px-2 truncate shadow-sm transition-opacity hover:opacity-90 z-[1]',
                            COLORS[task.status] ?? 'bg-gray-400',
                            cpMode && cpSet.has(task.id) && 'ring-2 ring-amber-500 ring-offset-1',
                          )}
                          style={{ left: lay.left, width: lay.width }}
                          title={tip}
                        >
                          {lay.width > 40 ? task.title : ''}
                        </button>
                      ) : lay?.kind === 'milestone' ? (
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className={clsx(
                            'absolute top-1/2 w-3.5 h-3.5 rounded-sm shadow-sm border border-white/40 z-[1]',
                            COLORS[task.status] ?? 'bg-gray-400',
                            cpMode && cpSet.has(task.id) && 'ring-2 ring-amber-500 ring-offset-1',
                          )}
                          style={{
                            left: lay.cx,
                            transform: 'translate(-50%, -50%) rotate(45deg)',
                          }}
                          title={tip}
                          aria-label={`Milestone: ${task.title}`}
                        />
                      ) : (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 italic z-[1]">
                          no dates
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        className="hidden print:block shrink-0 px-6 py-2 text-[10px] text-gray-500 border-t border-gray-200"
        aria-hidden
      >
        Vineroot · timeline snapshot · use the print dialog to save as PDF
      </div>
    </div>
  );
}
