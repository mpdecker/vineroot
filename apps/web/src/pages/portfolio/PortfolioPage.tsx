import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import {
  usePortfolio,
  useAddPortfolioProject,
  useRemovePortfolioProject,
  useDeletePortfolio,
} from '../../hooks/usePortfolios';
import { useProjects } from '../../hooks/useProjects';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { Button } from '../../components/ui';

const DOT: Record<string, string> = {
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

export default function PortfolioPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const workspaceIdForPortfolio =
    currentWorkspace?.id ?? searchParams.get('ws') ?? undefined;
  const { data: portfolio, isLoading, error } = usePortfolio(
    portfolioId,
    workspaceIdForPortfolio,
  );
  const { data: workspaceProjects } = useProjects(portfolio?.workspaceId ?? '');
  const { mutateAsync: addProject, isPending: adding } = useAddPortfolioProject();
  const { mutateAsync: removeProject, isPending: removing } = useRemovePortfolioProject();
  const { mutateAsync: deletePortfolio, isPending: deleting } = useDeletePortfolio();
  const [pickProjectId, setPickProjectId] = useState('');

  const memberIds = useMemo(
    () => new Set(portfolio?.items?.map((i) => i.projectId) ?? []),
    [portfolio?.items],
  );

  /** workspaceProjects is already GET /workspaces/:portfolioWorkspaceId/projects */
  const addableProjects = useMemo(
    () => (workspaceProjects ?? []).filter((p) => !memberIds.has(p.id)),
    [workspaceProjects, memberIds],
  );

  const handleAdd = async () => {
    if (!portfolio || !pickProjectId) return;
    await addProject({
      workspaceId: portfolio.workspaceId,
      portfolioId: portfolio.id,
      projectId: pickProjectId,
    });
    setPickProjectId('');
  };

  const handleRemove = async (projectId: string) => {
    if (!portfolio) return;
    await removeProject({
      workspaceId: portfolio.workspaceId,
      portfolioId: portfolio.id,
      projectId,
    });
  };

  const handleDeletePortfolio = async () => {
    if (!portfolio || !confirm('Delete this portfolio? Projects are not deleted.')) return;
    await deletePortfolio({
      workspaceId: portfolio.workspaceId,
      portfolioId: portfolio.id,
    });
    navigate('/portfolios');
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-500">Loading portfolio…</p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-red-600">Portfolio not found or you don&apos;t have access.</p>
        <Link to="/portfolios" className="text-brand-600 text-sm mt-2 inline-block">
          Back to portfolios
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/portfolios"
            className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Portfolios
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-gray-600 mt-2">{portfolio.description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => void handleDeletePortfolio()}
          loading={deleting}
        >
          Delete portfolio
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Add project (must be in this workspace)
          </label>
          <select
            value={pickProjectId}
            onChange={(e) => setPickProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Choose a project…</option>
            {addableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!pickProjectId}
          loading={adding}
        >
          <Plus className="w-4 h-4 mr-1 inline" />
          Add to portfolio
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Projects in this portfolio</h2>
        {!portfolio.items?.length && (
          <p className="text-gray-500 text-sm">No projects yet. Add one using the picker above.</p>
        )}
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
          {portfolio.items?.map((item) => (
            <li
              key={item.projectId}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <Link
                to={`/projects/${item.projectId}`}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      DOT[item.project?.color ?? 'BLUE'] ?? '#3b82f6',
                  }}
                />
                <span className="font-medium text-gray-900 truncate">
                  {item.project?.name ?? item.projectId}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void handleRemove(item.projectId)}
                disabled={removing}
                className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
                aria-label="Remove from portfolio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
