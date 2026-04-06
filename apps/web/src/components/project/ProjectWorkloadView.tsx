import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectWorkloadDto } from '@vineroot/shared-types';
import { useProjectWorkload } from '../../hooks/useProjects';
import type { EpicFilterValue } from '../../lib/filterSectionsByEpic';
import type { SprintFilterValue } from '../../lib/filterSectionsBySprint';
import { Loader2 } from 'lucide-react';

const WEEK_PRESETS = [8, 12, 16, 20, 26];

interface ProjectWorkloadViewProps {
  projectId: string;
  sprintFilter: SprintFilterValue;
  epicFilter: EpicFilterValue;
}

function shortWeekLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function maxTaskCount(data: ProjectWorkloadDto): number {
  let m = 1;
  for (const r of data.rows) {
    for (const c of r.weeks) {
      m = Math.max(m, c.taskCount);
    }
    m = Math.max(m, r.unscheduled.taskCount, r.outOfRange.taskCount);
  }
  return m;
}

function parseWeeksParam(raw: string | null): number {
  if (raw == null || raw === '') return 12;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 12;
  return Math.min(26, Math.max(4, n));
}

function Cell({
  taskCount,
  storyPoints,
  maxTasks,
}: {
  taskCount: number;
  storyPoints: number;
  maxTasks: number;
}) {
  const intensity = maxTasks > 0 ? taskCount / maxTasks : 0;
  return (
    <td
      className={`text-center text-xs px-1 py-2 border border-gray-100 min-w-[52px] ${
        taskCount === 0 ? 'bg-gray-50' : ''
      }`}
      style={
        taskCount > 0
          ? {
              backgroundColor: `rgba(14, 165, 233, ${0.12 + 0.55 * intensity})`,
            }
          : undefined
      }
      title={`${taskCount} tasks · ${storyPoints} pts`}
    >
      {taskCount > 0 ? (
        <span className="font-medium text-gray-900">
          {taskCount}
          {storyPoints > 0 && (
            <span className="text-gray-500 font-normal"> / {storyPoints}</span>
          )}
        </span>
      ) : (
        <span className="text-gray-300">—</span>
      )}
    </td>
  );
}

export function ProjectWorkloadView({
  projectId,
  sprintFilter,
  epicFilter,
}: ProjectWorkloadViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const weeks = useMemo(
    () => parseWeeksParam(searchParams.get('weeks')),
    [searchParams],
  );
  const from = searchParams.get('from') ?? '';

  const weekSelectOptions = useMemo(() => {
    if (WEEK_PRESETS.includes(weeks)) return WEEK_PRESETS;
    return [...WEEK_PRESETS, weeks].sort((a, b) => a - b);
  }, [weeks]);

  const setWeeks = (n: number) => {
    const clamped = Math.min(26, Math.max(4, n));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('weeks', String(clamped));
        return next;
      },
      { replace: true },
    );
  };

  const setFrom = (s: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const t = s.trim();
        if (t) next.set('from', t);
        else next.delete('from');
        return next;
      },
      { replace: true },
    );
  };

  const { data, isLoading, isError } = useProjectWorkload(
    projectId,
    weeks,
    from.trim() || undefined,
    sprintFilter,
    epicFilter,
  );

  const maxTasks = useMemo(() => (data ? maxTaskCount(data) : 1), [data]);

  return (
    <div className="p-6 max-w-[100vw]">
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Workload</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-xl">
            Open tasks by assignee and week. Uses the header Sprint and Epic filters. Each task is
            counted in the week of its due date, or start
            date if no due date. Tasks without dates appear under Unscheduled; dates outside the grid
            under Outside range.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          <span>Weeks</span>
          <select
            className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-900"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            {weekSelectOptions.map((n) => (
              <option key={n} value={n}>
                {n} weeks
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          <span>First week (optional)</span>
          <input
            type="date"
            className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-900"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      )}

      {isError && (
        <p className="text-red-600 text-sm">Could not load workload for this project.</p>
      )}

      {data && !isLoading && (
        <>
          <p className="text-xs text-gray-500 mb-2">
            Range {data.from} → {data.to}
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-max w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-medium text-gray-700 min-w-[140px]">
                    Assignee
                  </th>
                  {data.weekStarts.map((ws) => (
                    <th
                      key={ws}
                      className="border-b border-gray-200 px-1 py-2 text-center font-medium text-gray-600 whitespace-nowrap"
                      title={ws}
                    >
                      {shortWeekLabel(ws)}
                    </th>
                  ))}
                  <th className="border-b border-l border-gray-200 px-2 py-2 text-center font-medium text-amber-800 bg-amber-50/80">
                    Unsched.
                  </th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-600 bg-gray-100">
                    Outside
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.weekStarts.length + 3}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No open tasks in this project for the current filters.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.userId} className="hover:bg-gray-50/80">
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-100 px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        {row.displayName}
                      </td>
                      {row.weeks.map((c, i) => (
                        <Cell
                          key={`${row.userId}-${data.weekStarts[i]}`}
                          taskCount={c.taskCount}
                          storyPoints={c.storyPoints}
                          maxTasks={maxTasks}
                        />
                      ))}
                      <Cell
                        taskCount={row.unscheduled.taskCount}
                        storyPoints={row.unscheduled.storyPoints}
                        maxTasks={maxTasks}
                      />
                      <Cell
                        taskCount={row.outOfRange.taskCount}
                        storyPoints={row.outOfRange.storyPoints}
                        maxTasks={maxTasks}
                      />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
