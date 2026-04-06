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
import { Task, Section } from '../../types';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';
import { computeCriticalPathTaskIds } from '../../lib/timelineCriticalPath';

type Zoom = 'week' | 'month' | 'quarter';

interface ProjectTimelineViewProps {
  sections: Section[];
  projectId: string;
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

/** Bar span or single-day milestone anchor (center x in px). */
function taskTimelineLayout(
  task: Task,
  rangeStart: Date,
  totalDays: number,
  DAY_PX: number,
): { kind: 'bar'; left: number; width: number } | { kind: 'milestone'; cx: number } | null {
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
      if (lay?.kind === 'bar') {
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

export function ProjectTimelineView({ sections, projectId }: ProjectTimelineViewProps) {
  const [zoom, setZoom] = useState<Zoom>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [wbsMode, setWbsMode] = useState(() => readTimelineWbs(projectId));
  const [cpMode, setCpMode] = useState(() => readTimelineCp(projectId));
  const openTask = useUIStore((s) => s.openTask);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWbsMode(readTimelineWbs(projectId));
    setCpMode(readTimelineCp(projectId));
  }, [projectId]);

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

  const { start, end } = useMemo(() => getRange(anchor, zoom), [anchor, zoom]);
  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);
  const totalDays = days.length;
  const DAY_PX = zoom === 'week' ? 60 : zoom === 'month' ? 32 : 16;
  const gridWidth = totalDays * DAY_PX;

  const { byTaskId, totalHeight } = useMemo(
    () => buildRowLayouts(sections, start, totalDays, DAY_PX, wbsMode),
    [sections, start, totalDays, DAY_PX, wbsMode],
  );

  const flatTasks = useMemo(
    () => allTimelineTasks(sections, wbsMode),
    [sections, wbsMode],
  );
  const cpSet = useMemo(
    () => (cpMode ? computeCriticalPathTaskIds(flatTasks) : new Set<string>()),
    [cpMode, flatTasks],
  );

  const dependencyPaths = useMemo(() => {
    const paths: { d: string; onCp: boolean }[] = [];
    for (const section of sections) {
      for (const { task } of flattenSectionTasks(section.tasks, 0, wbsMode)) {
        for (const dep of task.waitingOn ?? []) {
          const blockerId = dep.blockingTask?.id;
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
          const onCp = cpSet.has(blockerId) && cpSet.has(task.id);
          paths.push({
            d: `M ${fx} ${fy} C ${mid} ${fy}, ${mid} ${ty}, ${tx} ${ty}`,
            onCp,
          });
        }
      }
    }
    return paths;
  }, [sections, byTaskId, wbsMode, cpSet]);

  const todayOffset = differenceInDays(new Date(), start);
  const todayPx = Math.max(0, todayOffset * DAY_PX);

  function navigate(dir: 1 | -1) {
    if (zoom === 'week') setAnchor((a) => addWeeks(a, dir * 2));
    else if (zoom === 'month') setAnchor((a) => addMonths(a, dir));
    else setAnchor((a) => addMonths(a, dir * 3));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white">
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
          <button
            type="button"
            onClick={() => persistCp(!cpMode)}
            title="Highlight longest dependency chain (CPM) when the graph has no cycles"
            className={clsx(
              'ml-2 text-xs px-2 py-1 border rounded-md transition-colors',
              cpMode
                ? 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-gray-300 hover:bg-gray-50 text-gray-600',
            )}
          >
            Critical path
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r border-gray-200 overflow-y-auto scrollbar-thin">
          <div className="border-b border-gray-200 bg-gray-50 shrink-0" style={{ height: HEADER_H }} />
          {sections.map((section) => (
            <div key={section.id}>
              <div
                className="px-4 flex items-center bg-gray-50 border-b border-gray-100"
                style={{ minHeight: SECTION_H }}
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {section.name}
                </span>
              </div>
              {flattenSectionTasks(section.tasks, 0, wbsMode).map(({ task, depth }) => (
                <div
                  key={task.id}
                  style={{ height: TASK_H, paddingLeft: 16 + depth * 14 }}
                  onClick={() => openTask(task.id)}
                  className="pr-4 flex items-center text-sm text-gray-700 hover:bg-gray-50 cursor-pointer border-b border-gray-100 truncate"
                  title={task.title}
                >
                  {task.title}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin" ref={timelineRef}>
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
                  stroke={p.onCp ? 'rgb(217 119 6)' : 'rgb(148 163 184)'}
                  strokeWidth={p.onCp ? 2.25 : 1.5}
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {sections.map((section) => (
              <div key={section.id}>
                <div
                  className="border-b border-gray-100 bg-gray-50/50 shrink-0"
                  style={{ height: SECTION_H }}
                />
                {flattenSectionTasks(section.tasks, 0, wbsMode).map(({ task }) => {
                  const lay = taskTimelineLayout(task, start, totalDays, DAY_PX);
                  return (
                    <div
                      key={task.id}
                      className="relative border-b border-gray-100 hover:bg-gray-50/50 group shrink-0"
                      style={{ height: TASK_H }}
                    >
                      {lay?.kind === 'bar' ? (
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className={clsx(
                            'absolute top-1.5 h-7 rounded-md text-white text-xs flex items-center px-2 truncate shadow-sm transition-opacity hover:opacity-90',
                            COLORS[task.status] ?? 'bg-gray-400',
                            cpMode && cpSet.has(task.id) && 'ring-2 ring-amber-500 ring-offset-1',
                          )}
                          style={{ left: lay.left, width: lay.width }}
                          title={task.title}
                        >
                          {lay.width > 40 ? task.title : ''}
                        </button>
                      ) : lay?.kind === 'milestone' ? (
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className={clsx(
                            'absolute top-1/2 w-3.5 h-3.5 rounded-sm shadow-sm border border-white/40',
                            COLORS[task.status] ?? 'bg-gray-400',
                            cpMode && cpSet.has(task.id) && 'ring-2 ring-amber-500 ring-offset-1',
                          )}
                          style={{
                            left: lay.cx,
                            transform: 'translate(-50%, -50%) rotate(45deg)',
                          }}
                          title={`${task.title} (milestone)`}
                          aria-label={`Milestone: ${task.title}`}
                        />
                      ) : (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 italic">
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
    </div>
  );
}
