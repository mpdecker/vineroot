import { Link } from 'react-router-dom';
import { Layers, Settings, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useSchedulePrograms } from '../../hooks/useSchedulePrograms';

const linkPrimary =
  'inline-flex items-center justify-center font-medium rounded-lg text-sm px-4 py-2 bg-brand-500 text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 transition-all';
const linkSecondary =
  'inline-flex items-center justify-center font-medium rounded-lg text-sm px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 transition-all';

export default function ProgramsListPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const wid = currentWorkspace?.id;
  const { data: programs, isLoading, error } = useSchedulePrograms(wid);

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to view schedule programs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Master schedules for {currentWorkspace.name}: cross-project dependencies, merged critical
            path, and combined capacity. Programs are separate from{' '}
            <Link to="/portfolios" className="text-brand-600 hover:underline">
              portfolios
            </Link>{' '}
            (reporting groups).
          </p>
        </div>
        <Link
          to="/settings/workspace?tab=programs"
          className={clsx(linkSecondary, 'gap-2')}
        >
          <Settings className="w-4 h-4" />
          Manage in settings
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading programs…
        </div>
      )}

      {error && <p className="text-red-600 text-sm">Could not load programs.</p>}

      {!isLoading && (!programs || programs.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Layers className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="font-medium text-gray-800 mb-1">No schedule programs yet</p>
          <p className="text-sm mb-6 max-w-md mx-auto">
            Create a program in workspace settings, link projects, then open the command center for
            timeline, critical path, and workload roll-ups.
          </p>
          <Link to="/settings/workspace?tab=programs" className={linkPrimary}>
            Go to workspace settings
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {programs?.map((p) => {
          const n = p.projectIds?.length ?? 0;
          const qs = `?ws=${encodeURIComponent(currentWorkspace.id)}`;
          return (
            <div
              key={p.id}
              className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:border-brand-300 hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-inner">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{p.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {n} linked project{n === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                    Cross-project dependencies allowed only between projects in the same program.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                <Link to={`/programs/${p.id}${qs}`} className={linkPrimary}>
                  Open command center
                </Link>
                <Link to="/settings/workspace?tab=programs" className={linkSecondary}>
                  Edit membership
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
