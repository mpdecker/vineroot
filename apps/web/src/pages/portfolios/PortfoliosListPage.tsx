import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { usePortfolios } from '../../hooks/usePortfolios';
import { CreatePortfolioModal } from '../../components/portfolio/CreatePortfolioModal';
import { Button } from '../../components/ui';

export default function PortfoliosListPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { data: portfolios, isLoading } = usePortfolios(currentWorkspace?.id);
  const [createOpen, setCreateOpen] = useState(false);

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to view portfolios.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolios</h1>
          <p className="text-gray-600 mt-1">
            Group related projects inside {currentWorkspace.name}. Projects stay in workspaces;
            portfolios are an extra layer of organization.
          </p>
        </div>
        <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          New portfolio
        </Button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {!isLoading && (!portfolios || portfolios.length === 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p>No portfolios yet. Create one to curate projects for planning or reporting.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {portfolios?.map((p) => (
          <Link
            key={p.id}
            to={`/portfolios/${p.id}?ws=${encodeURIComponent(currentWorkspace.id)}`}
            className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm"
                style={{ backgroundColor: p.color || '#6366f1' }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">{p.name}</h2>
                {p.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">{p.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {p.itemCount ?? p.items?.length ?? 0} project
                  {(p.itemCount ?? p.items?.length ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <CreatePortfolioModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceId={currentWorkspace.id}
      />
    </div>
  );
}
