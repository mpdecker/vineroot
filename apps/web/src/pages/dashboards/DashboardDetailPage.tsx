import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import {
  useDashboard,
  useDeleteDashboard,
  useDeleteDashboardWidget,
} from '../../hooks/useDashboards';
import { DashboardWidgetRenderer } from '../../components/dashboard/DashboardWidgetRenderer';
import { AddWidgetModal } from '../../components/dashboard/AddWidgetModal';
import { Button } from '../../components/ui';
import type { DashboardWidget } from '../../types';

export default function DashboardDetailPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const workspaceId = currentWorkspace?.id ?? searchParams.get('ws') ?? '';
  const { data: dashboard, isLoading, error } = useDashboard(workspaceId || undefined, dashboardId, {
    withResolved: true,
  });
  const { mutateAsync: deleteDashboard, isPending: deletingDash } = useDeleteDashboard();
  const { mutateAsync: deleteWidget, isPending: deletingWidget } = useDeleteDashboardWidget();
  const [addOpen, setAddOpen] = useState(false);

  const sortedWidgets = useMemo(() => {
    const w = dashboard?.widgets ?? [];
    return [...w].sort((a, b) => a.sortOrder - b.sortOrder || a.gridY - b.gridY);
  }, [dashboard?.widgets]);

  const errMsg =
    error instanceof Error
      ? error.message
      : (error as unknown as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;

  const handleDeleteDashboard = async () => {
    if (!dashboard || !workspaceId) return;
    if (!confirm('Delete this dashboard and all its widgets?')) return;
    await deleteDashboard({ workspaceId, dashboardId: dashboard.id });
    navigate('/dashboards');
  };

  const handleDeleteWidget = async (w: DashboardWidget) => {
    if (!workspaceId || !dashboard) return;
    if (!confirm(`Remove widget “${w.title}”?`)) return;
    await deleteWidget({
      workspaceId,
      dashboardId: dashboard.id,
      widgetId: w.id,
    });
  };

  if (!workspaceId) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace or open this dashboard from the list.</p>
        <Link to="/dashboards" className="text-brand-600 text-sm mt-2 inline-block">
          Back to dashboards
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-500">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-red-600">{errMsg ?? 'Dashboard not found.'}</p>
        <Link to="/dashboards" className="text-brand-600 text-sm mt-2 inline-block">
          Back to dashboards
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/dashboards"
            className="text-sm text-gray-600 hover:text-brand-600 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboards
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-gray-600 mt-1 max-w-2xl">{dashboard.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
            Add widget
          </Button>
          <Button
            type="button"
            variant="secondary"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDeleteDashboard}
            loading={deletingDash}
          >
            Delete dashboard
          </Button>
        </div>
      </div>

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gridAutoRows: 'minmax(140px, auto)',
        }}
      >
        {sortedWidgets.map((w) => (
          <div
            key={w.id}
            className="relative group min-h-[140px]"
            style={{
              gridColumn: `${w.gridX + 1} / span ${Math.min(w.gridW, 12)}`,
              gridRow: `${w.gridY + 1} / span ${w.gridH}`,
            }}
          >
            <button
              type="button"
              onClick={() => handleDeleteWidget(w)}
              disabled={deletingWidget}
              className="absolute -top-1 -right-1 z-10 p-1.5 rounded-md bg-white border border-gray-200 shadow-sm text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:border-red-200 transition-opacity"
              aria-label={`Remove ${w.title}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <DashboardWidgetRenderer widget={w} />
          </div>
        ))}
      </div>

      {sortedWidgets.length === 0 && (
        <div className="text-center py-16 text-gray-500 border border-dashed border-gray-200 rounded-xl">
          <p className="mb-4">No widgets yet.</p>
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add your first widget
          </Button>
        </div>
      )}

      <AddWidgetModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        workspaceId={workspaceId}
        dashboardId={dashboard.id}
      />
    </div>
  );
}
