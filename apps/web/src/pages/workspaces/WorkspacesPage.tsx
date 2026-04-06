import { useState } from 'react';
import { Building2, Plus, Check } from 'lucide-react';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { CreateWorkspaceModal } from '../../components/workspace/CreateWorkspaceModal';
import { Button } from '../../components/ui';
import type { Workspace } from '../../types';
import { clsx } from 'clsx';

export default function WorkspacesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: workspaces, isLoading } = useWorkspaces();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();

  const selectWorkspace = (ws: Workspace) => {
    setCurrentWorkspace(ws);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-brand-600" />
            Workspaces
          </h1>
          <p className="text-gray-600 mt-1">
            Switch the active workspace for the sidebar and home, or create a new one.
          </p>
        </div>
        <Button
          type="button"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateOpen(true)}
        >
          New workspace
        </Button>
      </div>

      <CreateWorkspaceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(ws) => setCurrentWorkspace(ws)}
      />

      {isLoading && (
        <p className="text-sm text-gray-500">Loading workspaces…</p>
      )}

      {!isLoading && (!workspaces || workspaces.length === 0) && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <p className="text-gray-600 mb-4">You don’t have any workspaces yet.</p>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create your first workspace
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {workspaces?.map((ws) => {
          const active = currentWorkspace?.id === ws.id;
          return (
            <div
              key={ws.id}
              className={clsx(
                'flex items-center justify-between rounded-xl border p-4 transition-colors',
                active ? 'border-brand-400 bg-brand-50/50' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">{ws.name}</h2>
                {ws.description && (
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{ws.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {ws.memberCount ?? ws.members?.length ?? 0} members
                </p>
              </div>
              <Button
                type="button"
                variant={active ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => selectWorkspace(ws)}
                icon={active ? <Check className="w-4 h-4" /> : undefined}
              >
                {active ? 'Active' : 'Set active'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
