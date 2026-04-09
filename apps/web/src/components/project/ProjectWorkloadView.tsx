import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectWorkloadDto } from '@vineroot/shared-types';
import { useProjectWorkload } from '../../hooks/useProjects';
import { useLevelProject, useProjectOverallocations } from '../../hooks/useProjectSchedule';
import type { EpicFilterValue } from '../../lib/filterSectionsByEpic';
import type { SprintFilterValue } from '../../lib/filterSectionsBySprint';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui';

const WEEK_PRESETS = [8, 12, 16, 20, 26];

interface ProjectWorkloadViewProps {
  projectId: string;
  /** First linked workspace — required for schedule overallocations / leveling. */
  workspaceId: string;
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

function Cell({
  taskCount,
  storyPoints,
  maxTasks,
  allocationPercent,
}: {
  taskCount: number;
  storyPoints: number;
  maxTasks: number;
  allocationPercent: number;
}) {
  const intensity = maxTasks > 0 ? taskCount / maxTasks : 0;
  const overAlloc = allocationPercent > 100;
  return (
    <td
      className={`text-center text-xs px-1 py-2 border border-gray-100 min-w-[52px] ${
        taskCount === 0 && allocationPercent === 0 ? 'bg-gray-50' : ''
      }`}
      style={
        taskCount > 0
          ? {
              backgroundColor: `rgba(14, 165, 233, ${0.12 + 0.55 * intensity})`,
            }
          : undefined
      }
      title={`${taskCount} tasks · ${storyPoints} pts · ${allocationPercent}% assigned load (sum of units)`}
    >
      {taskCount > 0 ? (
        <div>
          <span className="font-medium text-gray-900">
            {taskCount}
            {storyPoints > 0 && (
              <span className="text-gray-500 font-normal"> / {storyPoints}</span>
            )}
          </span>
          {allocationPercent > 0 && (
            <span
              className={`block text-[10px] mt-0.5 ${overAlloc ? 'text-amber-800 font-semibold' : 'text-gray-600'}`}
            >
              {allocationPercent}%
            </span>
          )}
        </div>
      ) : allocationPercent > 0 ? (
        <span
          className={`text-[11px] font-medium ${overAlloc ? 'text-amber-800' : 'text-gray-600'}`}
        >
          {allocationPercent}%
        </span>
      ) : (
        <span className="text-gray-300">—</span>
      )}
    </td>
  );
}

function parseWeeksParam(raw: string | null): number {
  if (raw == null || raw === '') return 12;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 12;
  return Math.min(26, Math.max(4, n));
}

export function ProjectWorkloadView({
  projectId,
  workspaceId,
  sprintFilter,
  epicFilter,
}: ProjectWorkloadViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [levelMessage, setLevelMessage] = useState<string | null>(null);
  const [clearLevelingDelays, setClearLevelingDelays] = useState(false);
  const [deferSplitCapableTasksLast, setDeferSplitCapableTasksLast] = useState(false);

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

  const [overloadGranularity, setOverloadGranularity] = useState<'week' | 'day'>('week');

  const { data: overallocations, isLoading: overLoading } = useProjectOverallocations(
    workspaceId || undefined,
    projectId,
    { granularity: overloadGranularity },
  );

  const { mutate: levelProject, isPending: leveling } = useLevelProject(
    workspaceId || undefined,
    projectId,
  );

  const maxTasks = useMemo(() => (data ? maxTaskCount(data) : 1), [data]);

  return (
    <div className="p-6 max-w-[100vw]">
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-lg font-semibold text-gray-900">Workload</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-xl">
            Open tasks by assignee and week. Weeks use the project work calendar time zone (or
            workspace default calendar, else UTC). Each cell shows task count and the sum of
            assignment units (%) for that week. Uses Sprint and Epic filters from the header. Tasks
            are placed by due date, or start date if no due. Tasks without dates appear under
            Unscheduled; dates outside the grid under Outside range.
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
        {workspaceId ? (
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span>Overload detail</span>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-900 min-w-[140px]"
              value={overloadGranularity}
              onChange={(e) =>
                setOverloadGranularity(e.target.value === 'day' ? 'day' : 'week')
              }
            >
              <option value="week">Weekly buckets</option>
              <option value="day">Daily buckets</option>
            </select>
          </label>
        ) : null}
        {workspaceId ? (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={clearLevelingDelays}
                onChange={(e) => setClearLevelingDelays(e.target.checked)}
              />
              Clear leveling delays first
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={deferSplitCapableTasksLast}
                onChange={(e) => setDeferSplitCapableTasksLast(e.target.checked)}
              />
              Defer split-capable tasks last
            </label>
          </div>
        ) : null}
        {workspaceId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={leveling || overLoading}
            onClick={() => {
              setLevelMessage(null);
              levelProject(
                {
                  ...(clearLevelingDelays ? { clearLevelingDelays: true } : {}),
                  ...(deferSplitCapableTasksLast
                    ? { deferSplitCapableTasksLast: true }
                    : {}),
                },
                {
                onSuccess: (res) => {
                  const n = res?.shiftedTaskIds?.length ?? 0;
                  const reason = res?.stoppedReason;
                  const rem = res?.remainingOverallocations ?? 0;
                  const cleared = res?.clearedLevelingDelaysTaskCount;
                  const clearedMsg =
                    cleared != null && cleared > 0
                      ? ` Cleared delay counter on ${cleared} task(s).`
                      : '';
                  if (reason === 'no_slack') {
                    setLevelMessage(
                      `Could not clear overload: no tasks with slack to delay (${rem} overloaded bucket(s) left).${clearedMsg}`,
                    );
                  } else if (reason === 'max_passes' && rem > 0) {
                    setLevelMessage(
                      `Stopped after max passes. Shifted ${n} task(s); ${rem} overloaded bucket(s) may remain.${clearedMsg}`,
                    );
                  } else if (n === 0) {
                    setLevelMessage(
                      `Leveling made no changes (no overload or nothing to shift).${clearedMsg}`,
                    );
                  } else {
                    setLevelMessage(
                      `Shifted ${n} task(s) (working-day step when a project calendar exists).${rem > 0 ? ` ${rem} bucket(s) still over.` : ''}${clearedMsg}`,
                    );
                  }
                },
                onError: () => {
                  setLevelMessage('Leveling failed. Try again or check permissions.');
                },
              });
            }}
          >
            {leveling ? 'Leveling…' : 'Level project'}
          </Button>
        ) : null}
        {workspaceId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={leveling || overLoading}
            title="When this project is in a schedule program, delay tasks across all program projects that share overloaded resources."
            onClick={() => {
              setLevelMessage(null);
              levelProject(
                {
                  scope: 'program',
                  ...(clearLevelingDelays ? { clearLevelingDelays: true } : {}),
                  ...(deferSplitCapableTasksLast
                    ? { deferSplitCapableTasksLast: true }
                    : {}),
                },
                {
                onSuccess: (res) => {
                  const n = res?.shiftedTaskIds?.length ?? 0;
                  const reason = res?.stoppedReason;
                  const rem = res?.remainingOverallocations ?? 0;
                  const cleared = res?.clearedLevelingDelaysTaskCount;
                  const clearedMsg =
                    cleared != null && cleared > 0
                      ? ` Cleared delay counter on ${cleared} task(s).`
                      : '';
                  if (reason === 'no_slack') {
                    setLevelMessage(
                      `Program leveling: could not clear overload (${rem} bucket(s) left).${clearedMsg}`,
                    );
                  } else if (reason === 'max_passes' && rem > 0) {
                    setLevelMessage(
                      `Program leveling stopped after max passes. Shifted ${n} task(s); ${rem} bucket(s) may remain.${clearedMsg}`,
                    );
                  } else if (n === 0) {
                    setLevelMessage(`Program leveling made no changes.${clearedMsg}`);
                  } else {
                    setLevelMessage(
                      `Program leveling shifted ${n} task(s).${rem > 0 ? ` ${rem} bucket(s) still over.` : ''}${clearedMsg}`,
                    );
                  }
                },
                onError: () => {
                  setLevelMessage('Program leveling failed.');
                },
              });
            }}
          >
            {leveling ? 'Leveling…' : 'Level program'}
          </Button>
        ) : null}
      </div>

      {levelMessage && (
        <p className="text-sm text-gray-700 mb-4 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {levelMessage}
        </p>
      )}

      {workspaceId && !overLoading && overallocations && overallocations.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-950">
                Overallocation ({overloadGranularity === 'day' ? 'daily' : 'weekly'} buckets)
              </p>
              <p className="text-xs text-amber-900/90 mt-1">
                Load uses working minutes from the project calendar intersected with each
                user&apos;s work calendar (or project-only when the user has none). Generic resources
                use the same intersection when a resource calendar is set; otherwise project minutes
                apply. Capacity scales by generic max units. Overallocated when allocated minutes
                exceed capacity for the bucket (focal project time zone for week starts).
              </p>
              <ul className="mt-2 text-xs text-amber-950 space-y-1">
                {overallocations.map((b, i) => (
                  <li key={`${b.periodStart ?? b.weekStart}-${i}`}>
                    {b.resourceKind === 'user' ? (
                      <span>User {b.userId?.slice(0, 8)}…</span>
                    ) : (
                      <span>{b.genericResourceName ?? b.genericResourceId}</span>
                    )}
                    {' · '}
                    {overloadGranularity === 'day' ? 'day ' : 'week '}
                    {b.periodStart ?? b.weekStart}: {Math.round(b.allocatedMinutes)}m /{' '}
                    {Math.round(b.capacityMinutes)}m (
                    {Math.round(b.allocatedPercent)}% load)
                    {b.projectIds && b.projectIds.length > 1 ? (
                      <span className="text-amber-800"> · {b.projectIds.length} projects</span>
                    ) : null}
                    {b.taskIds.length > 0 && (
                      <span className="text-amber-800"> · {b.taskIds.length} task(s)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
                          allocationPercent={c.allocationPercent ?? 0}
                        />
                      ))}
                      <Cell
                        taskCount={row.unscheduled.taskCount}
                        storyPoints={row.unscheduled.storyPoints}
                        maxTasks={maxTasks}
                        allocationPercent={row.unscheduled.allocationPercent ?? 0}
                      />
                      <Cell
                        taskCount={row.outOfRange.taskCount}
                        storyPoints={row.outOfRange.storyPoints}
                        maxTasks={maxTasks}
                        allocationPercent={row.outOfRange.allocationPercent ?? 0}
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
