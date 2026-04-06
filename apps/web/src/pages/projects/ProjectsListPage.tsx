import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderGit2 } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useProjects } from '../../hooks/useProjects';
import { ProjectCreateModal } from '../../components/project/ProjectCreateModal';
import { Button } from '../../components/ui';

const CARD_COLOR: Record<string, string> = {
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

export default function ProjectsListPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { data: projects, isLoading, isError, error } = useProjects(
    currentWorkspace?.id ?? '',
  );
  const [createOpen, setCreateOpen] = useState(false);

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to view and create projects.</p>
      </div>
    );
  }

  const errMsg =
    error instanceof Error
      ? error.message
      : (error as unknown as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">
            All projects linked to {currentWorkspace.name}. Create a project here or from the sidebar;
            add them to portfolios from the Portfolios page.
          </p>
        </div>
        <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          New project
        </Button>
      </div>

      {isLoading && <p className="text-gray-500">Loading projects…</p>}

      {isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {errMsg ?? 'Could not load projects. Check that the API is running.'}
        </p>
      )}

      {!isLoading && !isError && (!projects || projects.length === 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <FolderGit2 className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="mb-4">No projects in this workspace yet.</p>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create your first project
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((p) => {
          const activeTasks = p.taskCount ?? p._count?.tasks ?? 0;
          const doneTasks = p.completedTaskCount ?? 0;
          return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: CARD_COLOR[p.color] ?? '#6366f1' }}
                >
                  {(p.emoji || p.name).slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{p.name}</h2>
                  {p.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{p.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {activeTasks} active · {doneTasks} completed · {p.status}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <ProjectCreateModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
