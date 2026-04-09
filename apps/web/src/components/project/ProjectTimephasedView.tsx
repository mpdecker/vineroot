import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type {
  ProjectScheduleTimephasedCellDto,
  ProjectScheduleTimephasedDto,
  ProjectScheduleTimephasedResourceCellDto,
  ScheduleTimephasedBasis,
} from '@vineroot/shared-types';
import { api } from '../../lib/api';
import {
  parseTimephasedBasis,
  parseTimephasedGranularity,
  parseTimephasedGridMode,
} from '../../lib/timephasedSearchParams';
import { clsx } from 'clsx';

interface ProjectTimephasedViewProps {
  projectId: string;
  workspaceId: string;
}

type GridMode = 'list' | 'task_usage' | 'resource_usage';

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatWork(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function GridCellDiv({ cell }: { cell: PivotCell | undefined }) {
  const wm = cell?.work ?? 0;
  const cost = cell?.cost;
  if (wm <= 0 && (cost == null || Math.abs(cost) < 0.0005)) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-col items-end leading-tight">
      <span>{formatWork(wm)}</span>
      {cost != null && Math.abs(cost) >= 0.005 ? (
        <span className="text-[10px] text-gray-500 tabular-nums">{cost.toFixed(2)}</span>
      ) : null}
    </div>
  );
}

type PivotCell = { work: number; cost: number | null };

function mergePivotCell(a: PivotCell | undefined, work: number, cost: number | null): PivotCell {
  const w = (a?.work ?? 0) + work;
  const c1 = a?.cost ?? null;
  if (c1 == null && cost == null) return { work: w, cost: null };
  return { work: w, cost: (c1 ?? 0) + (cost ?? 0) };
}

function pivotTaskGrid(cells: ProjectScheduleTimephasedCellDto[]): {
  periods: string[];
  taskIds: string[];
  taskTitles: Map<string, string>;
  matrix: Map<string, Map<string, PivotCell>>;
  periodTotals: Map<string, PivotCell>;
} {
  const periodSet = new Set<string>();
  const taskMap = new Map<string, string>();
  const matrix = new Map<string, Map<string, PivotCell>>();
  for (const c of cells) {
    periodSet.add(c.periodStart);
    taskMap.set(c.taskId, c.taskTitle);
    if (!matrix.has(c.taskId)) matrix.set(c.taskId, new Map());
    const row = matrix.get(c.taskId)!;
    const prev = row.get(c.periodStart);
    row.set(c.periodStart, mergePivotCell(prev, c.workMinutes, c.cost));
  }
  const periods = [...periodSet].sort();
  const taskIds = [...taskMap.keys()].sort((a, b) =>
    (taskMap.get(a) ?? '').localeCompare(taskMap.get(b) ?? ''),
  );
  const periodTotals = new Map<string, PivotCell>();
  for (const p of periods) {
    let w = 0;
    let csum: number | null = null;
    for (const tid of taskIds) {
      const cell = matrix.get(tid)?.get(p);
      if (!cell) continue;
      w += cell.work;
      if (cell.cost != null) {
        csum = (csum ?? 0) + cell.cost;
      }
    }
    periodTotals.set(p, { work: w, cost: csum });
  }
  return { periods, taskIds, taskTitles: taskMap, matrix, periodTotals };
}

function pivotResourceGrid(cells: ProjectScheduleTimephasedResourceCellDto[]): {
  periods: string[];
  resourceKeys: string[];
  resourceLabels: Map<string, string>;
  matrix: Map<string, Map<string, PivotCell>>;
  periodTotals: Map<string, PivotCell>;
} {
  const periodSet = new Set<string>();
  const labelMap = new Map<string, string>();
  const matrix = new Map<string, Map<string, PivotCell>>();
  for (const c of cells) {
    periodSet.add(c.periodStart);
    labelMap.set(c.resourceKey, c.resourceLabel);
    if (!matrix.has(c.resourceKey)) matrix.set(c.resourceKey, new Map());
    const row = matrix.get(c.resourceKey)!;
    const prev = row.get(c.periodStart);
    row.set(c.periodStart, mergePivotCell(prev, c.workMinutes, c.cost));
  }
  const periods = [...periodSet].sort();
  const resourceKeys = [...labelMap.keys()].sort((a, b) =>
    (labelMap.get(a) ?? '').localeCompare(labelMap.get(b) ?? ''),
  );
  const periodTotals = new Map<string, PivotCell>();
  for (const p of periods) {
    let w = 0;
    let csum: number | null = null;
    for (const rk of resourceKeys) {
      const cell = matrix.get(rk)?.get(p);
      if (!cell) continue;
      w += cell.work;
      if (cell.cost != null) {
        csum = (csum ?? 0) + cell.cost;
      }
    }
    periodTotals.set(p, { work: w, cost: csum });
  }
  return { periods, resourceKeys, resourceLabels: labelMap, matrix, periodTotals };
}

export function ProjectTimephasedView({ projectId, workspaceId }: ProjectTimephasedViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const granularity = parseTimephasedGranularity(searchParams);
  const basis: ScheduleTimephasedBasis = parseTimephasedBasis(searchParams);
  const gridMode: GridMode = parseTimephasedGridMode(searchParams);

  const setGranularity = (g: 'week' | 'day') => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('granularity', g);
        return n;
      },
      { replace: true },
    );
  };
  const setBasis = (b: ScheduleTimephasedBasis) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('basis', b);
        return n;
      },
      { replace: true },
    );
  };
  const setGridMode = (m: GridMode) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('grid', m);
        return n;
      },
      { replace: true },
    );
  };
  const [data, setData] = useState<ProjectScheduleTimephasedDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .get<ProjectScheduleTimephasedDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/timephased`,
        { params: { granularity, basis } },
      )
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setErr(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load timephased data.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceId, granularity, basis]);

  const rows = data?.cells ?? [];
  const resourceRows = data?.resourceCells ?? [];

  const taskPivot = useMemo(() => pivotTaskGrid(rows), [rows]);
  const resourcePivot = useMemo(() => pivotResourceGrid(resourceRows), [resourceRows]);

  const totalWork = useMemo(() => rows.reduce((s, r) => s + r.workMinutes, 0), [rows]);

  const periodLabel = (iso: string) => {
    try {
      return format(parseISO(iso), granularity === 'week' ? 'MMM d, yyyy' : 'MMM d');
    } catch {
      return iso;
    }
  };

  const exportCsv = () => {
    if (!data) return;
    if (gridMode === 'list') {
      const header = ['periodStart', 'periodEnd', 'taskId', 'taskTitle', 'workMinutes', 'cost'];
      const lines = [
        header.join(','),
        ...rows.map((r) =>
          [
            r.periodStart,
            r.periodEnd,
            r.taskId,
            `"${(r.taskTitle ?? '').replace(/"/g, '""')}"`,
            r.workMinutes,
            r.cost != null ? r.cost : '',
          ].join(','),
        ),
      ];
      downloadCsv(`timephased-tasks-${projectId}.csv`, lines.join('\n'));
      return;
    }
    if (gridMode === 'task_usage') {
      const { periods, taskIds, taskTitles, matrix, periodTotals } = taskPivot;
      const head = ['taskId', 'title', ...periods.flatMap((p) => [`${p}_work_min`, `${p}_cost`])].join(
        ',',
      );
      const body = taskIds.map((tid) => {
        const title = `"${(taskTitles.get(tid) ?? '').replace(/"/g, '""')}"`;
        const vals = periods.flatMap((p) => {
          const c = matrix.get(tid)?.get(p);
          return [c?.work ?? 0, c?.cost != null && c.cost !== 0 ? String(c.cost) : ''];
        });
        return [tid, title, ...vals].join(',');
      });
      const tot = periods.flatMap((p) => {
        const t = periodTotals.get(p);
        return [t?.work ?? 0, t?.cost != null && t.cost !== 0 ? String(t.cost) : ''];
      });
      const totalRow = ['_period_total', '', ...tot].join(',');
      downloadCsv(
        `timephased-task-usage-${projectId}.csv`,
        [head, ...body, totalRow].join('\n'),
      );
      return;
    }
    const { periods, resourceKeys, resourceLabels, matrix, periodTotals } = resourcePivot;
    const head = ['resourceKey', 'resource', ...periods.flatMap((p) => [`${p}_work_min`, `${p}_cost`])].join(
      ',',
    );
    const body = resourceKeys.map((rk) => {
      const lab = `"${(resourceLabels.get(rk) ?? '').replace(/"/g, '""')}"`;
      const vals = periods.flatMap((p) => {
        const c = matrix.get(rk)?.get(p);
        return [c?.work ?? 0, c?.cost != null && c.cost !== 0 ? String(c.cost) : ''];
      });
      return [rk, lab, ...vals].join(',');
    });
    const tot = periods.flatMap((p) => {
      const t = periodTotals.get(p);
      return [t?.work ?? 0, t?.cost != null && t.cost !== 0 ? String(t.cost) : ''];
    });
    const totalRow = ['_period_total', '', ...tot].join(',');
    downloadCsv(
      `timephased-resource-usage-${projectId}.csv`,
      [head, ...body, totalRow].join('\n'),
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Timephased work & cost</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.basis === 'working'
              ? 'Work spread using project working calendar × task contour (or segment overlap).'
              : 'Work spread by UTC calendar span × task contour; cost from task budget estimate when available.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(
              [
                { id: 'calendar' as const, label: 'Calendar' },
                { id: 'working' as const, label: 'Working' },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBasis(b.id)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded-md',
                  basis === b.id
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(['week', 'day'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={clsx(
                  'px-3 py-1 text-xs font-medium rounded-md capitalize',
                  granularity === g
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <select
            aria-label="Grid layout"
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 max-w-[11rem]"
            value={gridMode}
            onChange={(e) => setGridMode(e.target.value as GridMode)}
          >
            <option value="task_usage">Task Usage grid</option>
            <option value="resource_usage">Resource Usage grid</option>
            <option value="list">Flat list</option>
          </select>
          <button
            type="button"
            disabled={!data || loading || (gridMode !== 'list' && rows.length === 0)}
            onClick={exportCsv}
            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-16 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      ) : err ? (
        <div className="p-6 text-sm text-red-600">{err}</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">
          No dated tasks with work or cost to distribute. Add start/finish dates and work or cost on
          tasks.
        </div>
      ) : gridMode === 'list' ? (
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-2 text-xs text-gray-600 border-b border-gray-100">
            Σ work in view: {Math.round(totalWork / 60)}h {totalWork % 60}m
          </div>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-[1] border-b border-gray-200">
              <tr>
                <th className="text-left font-medium text-gray-600 px-4 py-2">Period start</th>
                <th className="text-left font-medium text-gray-600 px-4 py-2">Task</th>
                <th className="text-right font-medium text-gray-600 px-4 py-2">Work</th>
                <th className="text-right font-medium text-gray-600 px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.taskId}-${r.periodStart}-${i}`}
                  className="border-b border-gray-100 hover:bg-gray-50/80"
                >
                  <td className="px-4 py-2 text-gray-700 tabular-nums">{periodLabel(r.periodStart)}</td>
                  <td className="px-4 py-2 text-gray-900 truncate max-w-[240px]" title={r.taskTitle}>
                    {r.taskTitle}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 tabular-nums">
                    {formatWork(r.workMinutes)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 tabular-nums">
                    {r.cost != null ? r.cost.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : gridMode === 'task_usage' ? (
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-2 text-xs text-gray-600 border-b border-gray-100">
            Task Usage — primary value is work per period; smaller figure is cost when modeled. Footer
            row sums each period. Read-only; edit in task detail.
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse min-w-max">
              <thead className="sticky top-0 bg-gray-50 z-[1] border-b border-gray-200">
                <tr>
                  <th className="text-left font-medium text-gray-600 px-3 py-2 sticky left-0 bg-gray-50 z-[2] border-r border-gray-100 min-w-[12rem]">
                    Task
                  </th>
                  {taskPivot.periods.map((p) => (
                    <th
                      key={p}
                      className="text-right font-medium text-gray-600 px-2 py-2 whitespace-nowrap tabular-nums min-w-[5.5rem]"
                    >
                      {periodLabel(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taskPivot.taskIds.map((tid) => (
                  <tr key={tid} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="px-3 py-1.5 text-gray-900 sticky left-0 bg-white z-[1] border-r border-gray-100 max-w-[16rem] truncate text-xs">
                      {taskPivot.taskTitles.get(tid)}
                    </td>
                    {taskPivot.periods.map((p) => (
                      <td
                        key={p}
                        className="px-2 py-1.5 text-right text-gray-700 tabular-nums text-xs align-top"
                      >
                        <GridCellDiv cell={taskPivot.matrix.get(tid)?.get(p)} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t border-gray-200 font-medium text-gray-800">
                  <td className="px-3 py-2 sticky left-0 bg-gray-50 z-[1] border-r border-gray-100 text-xs">
                    Σ period
                  </td>
                  {taskPivot.periods.map((p) => (
                    <td
                      key={p}
                      className="px-2 py-2 text-right text-xs align-top border-t border-gray-200"
                    >
                      <GridCellDiv cell={taskPivot.periodTotals.get(p)} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-2 text-xs text-gray-600 border-b border-gray-100">
            Resource Usage — work (and cost when present) split by assignment units. Footer sums
            each period across resources.
          </div>
          {resourceRows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No resource buckets to show.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse min-w-max">
                <thead className="sticky top-0 bg-gray-50 z-[1] border-b border-gray-200">
                  <tr>
                    <th className="text-left font-medium text-gray-600 px-3 py-2 sticky left-0 bg-gray-50 z-[2] border-r border-gray-100 min-w-[12rem]">
                      Resource
                    </th>
                    {resourcePivot.periods.map((p) => (
                      <th
                        key={p}
                        className="text-right font-medium text-gray-600 px-2 py-2 whitespace-nowrap tabular-nums min-w-[5.5rem]"
                      >
                        {periodLabel(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resourcePivot.resourceKeys.map((rk) => (
                    <tr key={rk} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="px-3 py-1.5 text-gray-900 sticky left-0 bg-white z-[1] border-r border-gray-100 max-w-[16rem] truncate text-xs">
                        {resourcePivot.resourceLabels.get(rk)}
                      </td>
                      {resourcePivot.periods.map((p) => (
                        <td
                          key={p}
                          className="px-2 py-1.5 text-right text-gray-700 tabular-nums text-xs align-top"
                        >
                          <GridCellDiv cell={resourcePivot.matrix.get(rk)?.get(p)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t border-gray-200 font-medium text-gray-800">
                    <td className="px-3 py-2 sticky left-0 bg-gray-50 z-[1] border-r border-gray-100 text-xs">
                      Σ period
                    </td>
                    {resourcePivot.periods.map((p) => (
                      <td
                        key={p}
                        className="px-2 py-2 text-right text-xs align-top border-t border-gray-200"
                      >
                        <GridCellDiv cell={resourcePivot.periodTotals.get(p)} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
