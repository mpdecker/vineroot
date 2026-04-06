import { useMemo, useState } from 'react';
import {
  addMonths,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isToday,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Section, Task } from '../../types';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';
import type { EpicFilterValue } from '../../lib/filterSectionsByEpic';

const HEADER_H = 40;
const ROW_H = 44;
const DAY_PX = 14;
const COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  READY: 'bg-blue-400',
  IN_PROGRESS: 'bg-brand-500',
  BLOCKED: 'bg-red-400',
  IN_REVIEW: 'bg-yellow-400',
  DONE: 'bg-green-500',
  CANCELLED: 'bg-gray-300',
};

function flattenTasks(tasks: Task[] | undefined, out: Task[]) {
  for (const t of tasks ?? []) {
    out.push(t);
    flattenTasks(t.subtasks, out);
  }
}

function collectEpics(sections: Section[], epicFilter: EpicFilterValue): Task[] {
  const all: Task[] = [];
  for (const s of sections) flattenTasks(s.tasks, all);
  const epics = all.filter((t) => t.workItemType === 'EPIC');
  if (epicFilter === 'all') {
    return [...epics].sort((a, b) => a.title.localeCompare(b.title));
  }
  return epics.filter((t) => t.id === epicFilter);
}

function barForTask(
  task: Task,
  rangeStart: Date,
  totalDays: number,
): { left: number; width: number } | null {
  if (!task.dueDate) return null;
  const taskStart = task.startDate ? parseISO(task.startDate) : parseISO(task.dueDate);
  const taskEnd = parseISO(task.dueDate);
  const offsetDays = differenceInDays(taskStart, rangeStart);
  const durationDays = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
  const left = offsetDays * DAY_PX;
  const width = durationDays * DAY_PX;
  if (left + width < 0 || left > totalDays * DAY_PX) return null;
  return { left, width: Math.max(width, DAY_PX * 0.85) };
}

interface ProjectEpicRoadmapViewProps {
  sections: Section[];
  epicFilter: EpicFilterValue;
}

export function ProjectEpicRoadmapView({ sections, epicFilter }: ProjectEpicRoadmapViewProps) {
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const openTask = useUIStore((s) => s.openTask);

  const { start, end, days, epics } = useMemo(() => {
    const startD = startOfMonth(anchor);
    const endD = endOfMonth(addMonths(anchor, 5));
    const dayList = eachDayOfInterval({ start: startD, end: endD });
    return {
      start: startD,
      end: endD,
      days: dayList,
      epics: collectEpics(sections, epicFilter),
    };
  }, [anchor, sections, epicFilter]);

  const totalDays = days.length;
  const gridWidth = totalDays * DAY_PX;
  const totalHeight = HEADER_H + epics.length * ROW_H;
  const todayOffset = differenceInDays(new Date(), start);
  const todayPx = Math.max(0, todayOffset * DAY_PX);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-800">Epic roadmap</h2>
        <p className="text-xs text-gray-500 hidden sm:block">
          Multi-month view of EPIC work items (start/due dates).
        </p>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, -3))}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
            {format(start, 'MMM yyyy')} – {format(end, 'MMM yyyy')}
          </span>
          <button
            type="button"
            onClick={() => setAnchor((a) => addMonths(a, 3))}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(startOfMonth(new Date()))}
            className="ml-2 text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto scrollbar-thin">
          <div
            className="border-b border-gray-200 bg-gray-50 px-4 flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-10"
            style={{ height: HEADER_H }}
          >
            Epic
          </div>
          {epics.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No epics in this project. Create a task with work item type EPIC, or clear the epic
              filter.
            </div>
          ) : (
            epics.map((e) => (
              <div
                key={e.id}
                style={{ height: ROW_H }}
                onClick={() => openTask(e.id)}
                className="px-4 flex items-center text-sm text-gray-800 hover:bg-gray-50 cursor-pointer border-b border-gray-100 truncate"
                title={e.title}
              >
                {e.title}
              </div>
            ))
          )}
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <div
            className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10"
            style={{ width: gridWidth, height: HEADER_H }}
          >
            {days.map((day) => {
              const isMonthStart = day.getDate() === 1;
              return (
                <div
                  key={day.toISOString()}
                  style={{ width: DAY_PX, minWidth: DAY_PX, height: HEADER_H }}
                  className={clsx(
                    'text-center text-[10px] flex flex-col items-center justify-center border-r border-gray-100 flex-shrink-0 leading-tight',
                    isToday(day) ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-gray-500',
                    isMonthStart && 'bg-gray-100/80',
                  )}
                >
                  {isMonthStart ? format(day, 'MMM') : ''}
                </div>
              );
            })}
          </div>

          <div className="relative" style={{ width: gridWidth, minHeight: totalHeight - HEADER_H }}>
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute top-0 w-px bg-red-400 z-10 pointer-events-none"
                style={{ left: todayPx, height: epics.length * ROW_H }}
              />
            )}
            {epics.map((e) => {
              const bar = barForTask(e, start, totalDays);
              return (
                <div
                  key={e.id}
                  className="relative border-b border-gray-100"
                  style={{ height: ROW_H }}
                >
                  {bar ? (
                    <button
                      type="button"
                      onClick={() => openTask(e.id)}
                      className={clsx(
                        'absolute top-2 h-8 rounded-md text-white text-xs flex items-center px-2 truncate shadow-sm hover:opacity-90',
                        COLORS[e.status] ?? 'bg-indigo-500',
                      )}
                      style={{ left: bar.left, width: bar.width, top: 0 }}
                      title={e.title}
                    >
                      {bar.width > 48 ? e.title.slice(0, 24) : ''}
                    </button>
                  ) : (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 italic">
                      Add dates
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
