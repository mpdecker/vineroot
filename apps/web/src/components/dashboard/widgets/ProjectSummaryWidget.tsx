import type { DashboardWidget } from '../../../types';

export function ProjectSummaryWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const err = r.error as string | undefined;
  const name = r.projectName as string | undefined;
  const total = Number(r.totalTasks ?? 0);
  const done = Number(r.completedTasks ?? 0);
  const rate = Number(r.completionRate ?? 0);

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col">
      <h3 className="text-sm font-semibold text-gray-900">{widget.title}</h3>
      {err ? (
        <p className="text-sm text-amber-700 mt-2">{err}</p>
      ) : (
        <>
          <p className="text-lg font-medium text-gray-800 mt-2 truncate" title={name}>
            {name ?? 'Project'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {done} / {total} tasks complete
          </p>
          <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(100, rate)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{rate}% complete</p>
        </>
      )}
    </div>
  );
}
