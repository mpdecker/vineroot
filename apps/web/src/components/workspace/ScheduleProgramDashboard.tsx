import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import type { ProjectWorkloadDto, ScheduleProgramRollupDto } from '@vineroot/shared-types';
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { mergeProgramWorkloads } from '../../lib/mergeProgramWorkloads';
import { useScheduleProgramRollup } from '../../hooks/useSchedulePrograms';
import type { ProjectColor } from '../../types';

const PROJECT_DOT: Record<ProjectColor, string> = {
  BLUE: '#3b82f6',
  GREEN: '#22c55e',
  RED: '#ef4444',
  ORANGE: '#f97316',
  YELLOW: '#eab308',
  TEAL: '#14b8a6',
  INDIGO: '#6366f1',
  PURPLE: '#a855f7',
  PINK: '#ec4899',
  GRAY: '#6b7280',
};

const WEEK_PRESETS = [8, 12, 16, 20, 26] as const;

function shortWeekLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function calendarDaysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA);
  const b = new Date(isoB);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.max(1, Math.round(ms / 86400000));
}

function maxTaskCount(data: {
  rows: {
    weeks: { taskCount: number }[];
    unscheduled: { taskCount: number };
    outOfRange: { taskCount: number };
  }[];
}): number {
  let m = 1;
  for (const r of data.rows) {
    for (const c of r.weeks) {
      m = Math.max(m, c.taskCount);
    }
    m = Math.max(m, r.unscheduled.taskCount, r.outOfRange.taskCount);
  }
  return m;
}

function rowHasOverallocation(row: {
  weeks: { allocationPercent: number }[];
  unscheduled: { allocationPercent: number };
  outOfRange: { allocationPercent: number };
}): boolean {
  if (row.unscheduled.allocationPercent > 100 || row.outOfRange.allocationPercent > 100) {
    return true;
  }
  return row.weeks.some((w) => w.allocationPercent > 100);
}

function WorkloadCell({
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
      title={`${taskCount} tasks · ${storyPoints} pts · ${allocationPercent}%`}
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

function ProgramSwimlane({
  rollup,
  colorByProjectId,
}: {
  rollup: ScheduleProgramRollupDto;
  colorByProjectId: Map<string, ProjectColor>;
}) {
  const start = rollup.programEarliestStart;
  const end = rollup.programLatestFinish;
  if (!start || !end) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
        Add dated tasks in linked projects to see a combined timeline strip.
      </p>
    );
  }
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  const span = Math.max(t1 - t0, 86400000);

  const rows = rollup.projects.filter((p) => p.earliestStart && p.latestFinish);
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
        No per-project date range yet.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Program horizon
        </span>
        <span className="text-sm text-gray-800">
          {formatIsoDate(start)} <span className="text-gray-400 mx-1">→</span>{' '}
          {formatIsoDate(end)}
          <span className="text-gray-500 text-xs ml-2">
            ({calendarDaysBetween(start, end)} days)
          </span>
        </span>
      </div>
      <div className="p-4 space-y-3">
        {rollup.projects.map((p) => {
          const ps = p.earliestStart ? new Date(p.earliestStart).getTime() : null;
          const pe = p.latestFinish ? new Date(p.latestFinish).getTime() : null;
          const colorKey = colorByProjectId.get(p.projectId) ?? 'INDIGO';
          const barColor = PROJECT_DOT[colorKey] ?? PROJECT_DOT.INDIGO;

          if (ps == null || pe == null || Number.isNaN(ps) || Number.isNaN(pe)) {
            return (
              <div key={p.projectId} className="flex items-center gap-3">
                <div className="w-40 sm:w-52 flex-shrink-0 text-sm font-medium text-gray-900 truncate">
                  {p.projectName}
                </div>
                <div className="flex-1 h-8 bg-gray-50 rounded-md flex items-center px-2 text-xs text-gray-400">
                  No schedule dates
                </div>
              </div>
            );
          }

          const left = Math.max(0, ((ps - t0) / span) * 100);
          const width = Math.max(3, ((pe - ps) / span) * 100);
          const cappedLeft = Math.min(left, 97);

          return (
            <div key={p.projectId} className="flex items-center gap-3">
              <div className="w-40 sm:w-52 flex-shrink-0 text-sm font-medium text-gray-900 truncate pr-2">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                  style={{ backgroundColor: barColor }}
                />
                {p.projectName}
              </div>
              <div className="flex-1 relative h-9 bg-gray-100/80 rounded-lg overflow-hidden">
                <div
                  className="absolute top-1 bottom-1 rounded-md shadow-sm transition-all"
                  style={{
                    left: `${cappedLeft}%`,
                    width: `${Math.min(width, 100 - cappedLeft)}%`,
                    backgroundColor: barColor,
                    opacity: 0.85,
                  }}
                  title={`${formatIsoDate(p.earliestStart)} → ${formatIsoDate(p.latestFinish)}`}
                />
              </div>
              <div className="w-16 flex-shrink-0 text-right">
                <span
                  className={`text-xs font-semibold ${p.criticalTaskCount > 0 ? 'text-amber-800' : 'text-gray-400'}`}
                >
                  {p.criticalTaskCount} cp
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'default' | 'amber' | 'brand';
}) {
  const border =
    accent === 'amber'
      ? 'border-amber-200 bg-amber-50/50'
      : accent === 'brand'
        ? 'border-brand-200 bg-brand-50/40'
        : 'border-gray-200 bg-white';
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${border}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export interface ScheduleProgramDashboardProps {
  workspaceId: string;
  programId: string;
  projectIds: string[];
  /** Smaller chrome when embedded in workspace settings. */
  dense?: boolean;
  /** projectId → color for swimlane dots/bars */
  projectColorById?: Map<string, ProjectColor>;
}

export function ScheduleProgramDashboard({
  workspaceId,
  programId,
  projectIds,
  dense = false,
  projectColorById,
}: ScheduleProgramDashboardProps) {
  const [workloadWeeks, setWorkloadWeeks] = useState<number>(12);
  const [showOverAllocOnly, setShowOverAllocOnly] = useState(false);

  const rollupQ = useScheduleProgramRollup(workspaceId, programId);

  const colorMap = useMemo(() => {
    const m = new Map<string, ProjectColor>();
    for (const pid of projectIds) {
      m.set(pid, projectColorById?.get(pid) ?? 'INDIGO');
    }
    return m;
  }, [projectIds, projectColorById]);

  const workloadQueries = useQueries({
    queries:
      projectIds.length > 0
        ? projectIds.map((pid) => {
            const qs = new URLSearchParams();
            qs.set('weeks', String(workloadWeeks));
            return {
              queryKey: [
                'projects',
                pid,
                'workload',
                workloadWeeks,
                '',
                'all',
                'all',
              ] as const,
              queryFn: async () => {
                const { data } = await api.get<ProjectWorkloadDto>(
                  `/projects/${pid}/workload?${qs}`,
                );
                return data;
              },
              staleTime: 30_000,
            };
          })
        : [],
  });

  const merged = useMemo(() => {
    const ok = workloadQueries.every((q) => !q.isError);
    const datas = workloadQueries
      .map((q) => q.data)
      .filter((d): d is ProjectWorkloadDto => Boolean(d));
    if (!ok || datas.length !== projectIds.length || datas.length === 0) {
      return null;
    }
    return mergeProgramWorkloads(datas);
  }, [workloadQueries, projectIds.length]);

  const filteredWorkloadRows = useMemo(() => {
    if (!merged) return [];
    if (!showOverAllocOnly) return merged.rows;
    return merged.rows.filter(rowHasOverallocation);
  }, [merged, showOverAllocOnly]);

  const workloadLoading =
    projectIds.length > 0 && workloadQueries.some((q) => q.isLoading || q.isFetching);

  const maxTasks = merged ? maxTaskCount({ rows: filteredWorkloadRows }) : 1;

  const kpis = useMemo(() => {
    const r = rollupQ.data;
    if (!r) return null;
    const n = r.projects.length;
    const totalCrit = r.projects.reduce((s, p) => s + p.criticalTaskCount, 0);
    const hot = r.projects.filter((p) => p.criticalTaskCount > 0).length;
    let spanDays: number | null = null;
    if (r.programEarliestStart && r.programLatestFinish) {
      spanDays = calendarDaysBetween(r.programEarliestStart, r.programLatestFinish);
    }
    return { n, totalCrit, hot, spanDays };
  }, [rollupQ.data]);

  const jumpClass = dense
    ? 'hidden'
    : 'sticky top-0 z-20 flex flex-wrap gap-2 py-3 mb-4 -mx-1 px-1 bg-gray-50/95 backdrop-blur border-b border-gray-200';

  return (
    <div className={dense ? 'space-y-6' : 'space-y-10'}>
      {!dense && (
        <nav className={jumpClass} aria-label="Section navigation">
          <a
            href="#program-kpis"
            className="text-xs font-medium text-brand-700 hover:underline px-2 py-1 rounded-md hover:bg-white/80"
          >
            KPIs
          </a>
          <ChevronRight className="w-3 h-3 text-gray-300 self-center hidden sm:block" />
          <a
            href="#program-timeline"
            className="text-xs font-medium text-brand-700 hover:underline px-2 py-1 rounded-md hover:bg-white/80"
          >
            Timeline
          </a>
          <ChevronRight className="w-3 h-3 text-gray-300 self-center hidden sm:block" />
          <a
            href="#program-critical"
            className="text-xs font-medium text-brand-700 hover:underline px-2 py-1 rounded-md hover:bg-white/80"
          >
            Critical path
          </a>
          <ChevronRight className="w-3 h-3 text-gray-300 self-center hidden sm:block" />
          <a
            href="#program-capacity"
            className="text-xs font-medium text-brand-700 hover:underline px-2 py-1 rounded-md hover:bg-white/80"
          >
            Capacity
          </a>
        </nav>
      )}

      <section id="program-kpis" className="scroll-mt-24">
        <h3
          className={`font-semibold text-gray-900 ${dense ? 'text-sm mb-2' : 'text-lg mb-4'}`}
        >
          Portfolio health
        </h3>
        {rollupQ.isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading metrics…
          </div>
        )}
        {rollupQ.error && (
          <p className="text-sm text-red-600">Could not load program roll-up.</p>
        )}
        {kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard label="Linked projects" value={kpis.n} hint="In this program" />
            <KpiCard
              label="Program span"
              value={kpis.spanDays != null ? `${kpis.spanDays} d` : '—'}
              hint="Earliest start → latest finish"
              accent="brand"
            />
            <KpiCard
              label="Critical tasks"
              value={kpis.totalCrit}
              hint="Across projects (CPM)"
              accent={kpis.totalCrit > 0 ? 'amber' : 'default'}
            />
            <KpiCard
              label="Projects on CP"
              value={kpis.hot}
              hint="With ≥1 critical task"
              accent={kpis.hot > 0 ? 'amber' : 'default'}
            />
          </div>
        )}
      </section>

      <section id="program-timeline" className="scroll-mt-24">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className={`font-semibold text-gray-900 ${dense ? 'text-sm' : 'text-lg'}`}>
            Timeline strip
          </h3>
          {!dense && rollupQ.data && (
            <p className="text-xs text-gray-500 max-w-md text-right">
              Each bar is that project’s dated task span; alignment shows overlap and gaps.
            </p>
          )}
        </div>
        {rollupQ.data && (
          <ProgramSwimlane rollup={rollupQ.data} colorByProjectId={colorMap} />
        )}
      </section>

      <section id="program-critical" className="scroll-mt-24">
        <h3 className={`font-semibold text-gray-900 ${dense ? 'text-sm mb-2' : 'text-lg mb-4'}`}>
          Schedule roll-up
        </h3>
        {rollupQ.data && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">Finish</th>
                  <th className="px-4 py-3 font-medium">Critical</th>
                  <th className="px-4 py-3 font-medium w-32">Load</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rollupQ.data.projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-gray-500 text-center">
                      No projects you can access, or none linked yet.
                    </td>
                  </tr>
                ) : (
                  rollupQ.data.projects.map((row) => {
                    const maxC = Math.max(
                      1,
                      ...rollupQ.data!.projects.map((x) => x.criticalTaskCount),
                    );
                    const pct = (row.criticalTaskCount / maxC) * 100;
                    return (
                      <tr
                        key={row.projectId}
                        className={
                          row.criticalTaskCount > 0 ? 'bg-amber-50/30' : 'hover:bg-gray-50/80'
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  PROJECT_DOT[
                                    (colorMap.get(row.projectId) as ProjectColor) ??
                                      'INDIGO'
                                  ] ?? PROJECT_DOT.INDIGO,
                              }}
                            />
                            <span className="font-medium text-gray-900">{row.projectName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 tabular-nums">
                          {formatIsoDate(row.earliestStart)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 tabular-nums">
                          {formatIsoDate(row.latestFinish)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold tabular-nums ${row.criticalTaskCount > 0 ? 'text-amber-900' : 'text-gray-500'}`}
                            >
                              {row.criticalTaskCount}
                            </span>
                            <div className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {row.earliestStart && row.latestFinish
                            ? `${calendarDaysBetween(row.earliestStart, row.latestFinish)}d window`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to={`/projects/${row.projectId}/timeline`}
                              className="text-brand-600 hover:underline text-xs font-medium"
                            >
                              Timeline
                            </Link>
                            <Link
                              to={`/projects/${row.projectId}/workload`}
                              className="text-brand-600 hover:underline text-xs font-medium"
                            >
                              Workload
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="program-capacity" className="scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div>
            <h3 className={`font-semibold text-gray-900 ${dense ? 'text-sm' : 'text-lg'}`}>
              Combined capacity
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              Summed assignment load (units %) per week across program projects. Values over 100%
              flag contention.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <span className="whitespace-nowrap">Weeks</span>
              <select
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
                value={workloadWeeks}
                onChange={(e) => setWorkloadWeeks(Number(e.target.value))}
              >
                {WEEK_PRESETS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOverAllocOnly}
                onChange={(e) => setShowOverAllocOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Overallocated only
              </span>
            </label>
          </div>
        </div>

        {projectIds.length === 0 ? (
          <p className="text-sm text-gray-500 py-6">Add projects to see capacity.</p>
        ) : workloadLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading workloads…
          </div>
        ) : workloadQueries.some((q) => q.isError) ? (
          <p className="text-sm text-red-600">
            Some project workloads could not be loaded (check project access).
          </p>
        ) : !merged ? (
          <p className="text-sm text-gray-500">No workload data yet.</p>
        ) : filteredWorkloadRows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No rows match “overallocated only”. Clear the filter to see everyone.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2.5 font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                    Person
                  </th>
                  {merged.weekStarts.map((k) => (
                    <th
                      key={k}
                      className="text-center px-1 py-2 text-xs font-medium text-gray-600 min-w-[52px]"
                    >
                      {shortWeekLabel(k)}
                    </th>
                  ))}
                  <th className="text-center px-2 py-2 text-xs font-medium text-gray-500">
                    Unsched.
                  </th>
                  <th className="text-center px-2 py-2 text-xs font-medium text-gray-500">
                    Outside
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkloadRows.map((row) => (
                  <tr key={row.userId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white z-10">
                      {row.displayName}
                    </td>
                    {row.weeks.map((c, i) => (
                      <WorkloadCell
                        key={i}
                        taskCount={c.taskCount}
                        storyPoints={c.storyPoints}
                        maxTasks={maxTasks}
                        allocationPercent={c.allocationPercent}
                      />
                    ))}
                    <WorkloadCell
                      taskCount={row.unscheduled.taskCount}
                      storyPoints={row.unscheduled.storyPoints}
                      maxTasks={maxTasks}
                      allocationPercent={row.unscheduled.allocationPercent}
                    />
                    <WorkloadCell
                      taskCount={row.outOfRange.taskCount}
                      storyPoints={row.outOfRange.storyPoints}
                      maxTasks={maxTasks}
                      allocationPercent={row.outOfRange.allocationPercent}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
