import { Link } from 'react-router-dom';
import type { DashboardWidget } from '../../../types';

type Slice = {
  projectId: string;
  projectName: string;
  averageCompletedPoints: number;
  lastSprintName: string | null;
  lastSprintCompletedPoints: number;
};

export function PortfolioSprintVelocityWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const err = r.error as string | undefined;
  const portfolioName = r.portfolioName as string | undefined;
  const take = r.take as number | undefined;
  const projects = r.projects as Slice[] | undefined;

  const maxAvg =
    projects && projects.length > 0
      ? Math.max(1, ...projects.map((p) => p.averageCompletedPoints || 0))
      : 1;

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm flex flex-col min-h-[140px] overflow-auto">
      <h3 className="text-sm font-semibold text-gray-900 shrink-0">{widget.title}</h3>
      {portfolioName && (
        <p className="text-xs text-gray-500 mt-0.5 truncate" title={portfolioName}>
          {portfolioName}
          {take != null ? ` · last ${take} sprints avg` : ''}
        </p>
      )}
      {err ? (
        <p className="text-sm text-amber-700 mt-2">{err}</p>
      ) : projects && projects.length > 0 ? (
        <div className="mt-2 space-y-2 text-xs">
          {projects.map((p) => {
            const w = Math.round((p.averageCompletedPoints / maxAvg) * 100);
            return (
              <div key={p.projectId} className="rounded-md border border-gray-100 p-2">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/projects/${p.projectId}/burndown`}
                    className="font-medium text-brand-700 hover:underline truncate min-w-0"
                  >
                    {p.projectName}
                  </Link>
                  <span className="text-gray-700 shrink-0 font-mono">
                    avg {p.averageCompletedPoints} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${w}%` }}
                  />
                </div>
                {p.lastSprintName ? (
                  <p className="text-gray-500 mt-1">
                    Latest closed: {p.lastSprintName} · {p.lastSprintCompletedPoints} pts
                  </p>
                ) : (
                  <p className="text-gray-500 mt-1">No closed sprint data yet</p>
                )}
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
