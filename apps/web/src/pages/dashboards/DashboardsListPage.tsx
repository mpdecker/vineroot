import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutDashboard } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useDashboards } from '../../hooks/useDashboards';
import { CreateDashboardModal } from '../../components/dashboard/CreateDashboardModal';
import { Button } from '../../components/ui';

export default function DashboardsListPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { data: dashboards, isLoading } = useDashboards(currentWorkspace?.id);
  const [createOpen, setCreateOpen] = useState(false);

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to view dashboards.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboards</h1>
          <p className="text-gray-600 mt-1">
            Workspace-level reporting similar to Asana—charts, KPIs, and reserved tiles for future
            agent-generated insights (<code className="text-xs bg-gray-100 px-1 rounded">layoutMeta</code>{' '}
            + widget <code className="text-xs bg-gray-100 px-1 rounded">config</code> are ready for
            automation).
          </p>
        </div>
        <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          New dashboard
        </Button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {!isLoading && (!dashboards || dashboards.length === 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <LayoutDashboard className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="mb-4">No dashboards yet. Create one to track work across projects.</p>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create dashboard
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards?.map((d) => (
          <Link
            key={d.id}
            to={`/dashboards/${d.id}?ws=${encodeURIComponent(currentWorkspace.id)}`}
            className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white"
                style={{ backgroundColor: d.color || '#6366f1' }}
              >
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">{d.name}</h2>
                {d.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">{d.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {d.widgetCount ?? d.widgets?.length ?? 0} widget
                  {(d.widgetCount ?? d.widgets?.length ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <CreateDashboardModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceId={currentWorkspace.id}
      />
    </div>
  );
}
