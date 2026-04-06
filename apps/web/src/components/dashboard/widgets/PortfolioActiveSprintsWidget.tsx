import { Link } from 'react-router-dom';
import type { DashboardWidget } from '../../../types';

type Row = {
  projectId: string;
  projectName: string;
  sprintId: string | null;
  sprintName: string | null;
  sprintState: string | null;
  startDate: string | null;
  endDate: string | null;
  totalTasks: number;
  doneTasks: number;
  totalStoryPoints: number;
  doneStoryPoints: number;
};

export function PortfolioActiveSprintsWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const err = r.error as string | undefined;
  const portfolioName = r.portfolioName as string | undefined;
  const rows = r.rows as Row[] | undefined;

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm flex flex-col min-h-[140px] overflow-auto">
      <h3 className="text-sm font-semibold text-gray-900 shrink-0">{widget.title}</h3>
      {portfolioName && (
        <p className="text-xs text-gray-500 mt-0.5 truncate" title={portfolioName}>
          {portfolioName}
        </p>
      )}
      {err ? (
        <p className="text-sm text-amber-700 mt-2">{err}</p>
      ) : rows && rows.length > 0 ? (
        <div className="mt-2 space-y-2 text-xs">
          {rows.map((row) => {
            const pctPts =
              row.totalStoryPoints > 0
                ? Math.round((row.doneStoryPoints / row.totalStoryPoints) * 100)
                : row.totalTasks > 0
                  ? Math.round((row.doneTasks / row.totalTasks) * 100)
                  : 0;
            return (
              <div
                key={`${row.projectId}-${row.sprintId ?? 'none'}`}
                className="rounded-md border border-gray-100 bg-gray-50/80 p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/projects/${row.projectId}/sprint-board`}
                    className="font-medium text-brand-700 hover:underline truncate min-w-0"
                  >
                    {row.projectName}
                  </Link>
                  <span className="text-gray-500 shrink-0">{pctPts}%</span>
                </div>
                {row.sprintName ? (
                  <div className="text-gray-600 mt-0.5">
                    {row.sprintName}
                    {row.sprintState ? (
                      <span className="text-gray-400"> · {row.sprintState}</span>
                    ) : null}
                    {row.startDate && row.endDate ? (
                      <span className="text-gray-400">
                        {' '}
                        ({row.startDate} → {row.endDate})
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-gray-500 mt-0.5">No sprint (add or activate a sprint)</div>
                )}
                <div className="mt-1 text-gray-600">
                  {row.doneTasks}/{row.totalTasks} tasks · {row.doneStoryPoints}/
                  {row.totalStoryPoints} pts
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{ width: `${pctPts}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-2">No projects in this portfolio.</p>
      )}
    </div>
  );
}
