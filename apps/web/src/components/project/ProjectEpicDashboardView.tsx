import { Link, useNavigate } from 'react-router-dom';
import type { EpicRollupDto } from '@vineroot/shared-types';
import { useProjectEpicRollups } from '../../hooks/useProjects';
import { Loader2, LayoutList, Map } from 'lucide-react';
import { Button } from '../ui';

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function setEpicFilterSession(projectId: string, epicId: string) {
  try {
    sessionStorage.setItem(`vineroot:project:${projectId}:epicFilter`, epicId);
  } catch {
    /* ignore */
  }
}

export function ProjectEpicDashboardView({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useProjectEpicRollups(projectId);

  const goFiltered = (epicId: string, surface: 'list' | 'roadmap' | 'backlog') => {
    setEpicFilterSession(projectId, epicId);
    navigate(`/projects/${projectId}/${surface}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">
        {error instanceof Error ? error.message : 'Could not load epics'}
      </div>
    );
  }

  const epics = data?.epics ?? [];

  if (epics.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">No epics yet</h2>
        <p className="text-sm text-gray-600">
          Create tasks with work item type <strong>EPIC</strong> (or link work with{' '}
          <strong>Epic</strong> in task detail). Use the{' '}
          <Link to={`/projects/${projectId}/roadmap`} className="text-brand-600 hover:underline">
            Roadmap
          </Link>{' '}
          tab for a timeline of epic bars.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Epic dashboard</h2>
        <p className="text-sm text-gray-600 mt-1">
          Roll-ups include child tasks and anything linked via epic reference. Open a view with the
          epic filter pre-applied.
        </p>
      </div>

      <ul className="space-y-4">
        {epics.map((e: EpicRollupDto) => {
          const taskPct = pct(e.doneCount, e.taskCount);
          const ptsPct =
            e.storyPointsTotal > 0 ? pct(e.storyPointsDone, e.storyPointsTotal) : taskPct;
          return (
            <li
              key={e.epicId}
              className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate" title={e.title}>
                    {e.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{e.epicId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<LayoutList className="w-3.5 h-3.5" />}
                    onClick={() => goFiltered(e.epicId, 'list')}
                  >
                    List
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => goFiltered(e.epicId, 'backlog')}
                  >
                    Backlog
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Map className="w-3.5 h-3.5" />}
                    onClick={() => goFiltered(e.epicId, 'roadmap')}
                  >
                    Roadmap
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                  <div className="text-xs text-gray-500">Tasks in scope</div>
                  <div className="font-semibold text-gray-900">{e.taskCount}</div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                  <div className="text-xs text-gray-500">Done</div>
                  <div className="font-semibold text-gray-900">
                    {e.doneCount}{' '}
                    <span className="text-gray-500 font-normal">({taskPct}%)</span>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                  <div className="text-xs text-gray-500">Story points (total)</div>
                  <div className="font-semibold text-gray-900">{e.storyPointsTotal}</div>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                  <div className="text-xs text-gray-500">Points done</div>
                  <div className="font-semibold text-gray-900">
                    {e.storyPointsDone}
                    {e.storyPointsTotal > 0 ? (
                      <span className="text-gray-500 font-normal"> ({ptsPct}%)</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Progress by tasks</span>
                  <span>
                    {e.doneCount}/{e.taskCount}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-[width]"
                    style={{ width: `${taskPct}%` }}
                  />
                </div>
              </div>

              {e.storyPointsTotal > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Progress by points</span>
                    <span>
                      {e.storyPointsDone}/{e.storyPointsTotal}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-[width]"
                      style={{ width: `${ptsPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
