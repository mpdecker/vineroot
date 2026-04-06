import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, Section } from '../../types';
import { useUIStore } from '../../stores/ui.store';
import { clsx } from 'clsx';

interface ProjectCalendarViewProps {
  sections: Section[];
}

function calendarAnchorDate(task: Task): string | null {
  const raw = task.dueDate || task.startDate;
  if (!raw) return null;
  try {
    const d = typeof raw === 'string' ? parseISO(raw) : parseISO(String(raw));
    if (Number.isNaN(d.getTime())) return null;
    return format(d, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ProjectCalendarView({ sections }: ProjectCalendarViewProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const openTask = useUIStore((s) => s.openTask);

  const allTasks = useMemo(
    () => sections.flatMap((s) => s.tasks ?? []),
    [sections],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of allTasks) {
      const key = calendarAnchorDate(t);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [allTasks]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="flex flex-col h-full min-h-[480px] p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{format(cursor, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((d) => subMonths(d, 1))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor((d) => addMonths(d, 1))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200 flex-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-gray-50 text-xs font-medium text-gray-500 text-center py-2"
          >
            {w}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(key) ?? [];
          const muted = !isSameMonth(day, cursor);
          return (
            <div
              key={key}
              className={clsx(
                'min-h-[88px] bg-white p-1 flex flex-col gap-0.5',
                muted && 'bg-gray-50/80',
              )}
            >
              <span
                className={clsx(
                  'text-xs font-medium px-1',
                  isToday(day) && 'text-brand-600',
                  muted && 'text-gray-400',
                  !muted && !isToday(day) && 'text-gray-700',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                {dayTasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="text-left text-[11px] leading-tight px-1 py-0.5 rounded truncate bg-brand-50 text-brand-800 hover:bg-brand-100 border border-brand-100"
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 4 && (
                  <span className="text-[10px] text-gray-500 px-1">
                    +{dayTasks.length - 4} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
