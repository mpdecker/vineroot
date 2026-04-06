import { useState, FormEvent, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import { useCreateProject } from '../../hooks/useProjects';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import type { ProjectColor, Workspace } from '../../types';
import { clsx } from 'clsx';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS: { value: ProjectColor; hex: string }[] = [
  { value: 'BLUE', hex: '#3b82f6' },
  { value: 'GREEN', hex: '#22c55e' },
  { value: 'RED', hex: '#ef4444' },
  { value: 'ORANGE', hex: '#f97316' },
  { value: 'YELLOW', hex: '#eab308' },
  { value: 'TEAL', hex: '#14b8a6' },
  { value: 'INDIGO', hex: '#6366f1' },
  { value: 'PURPLE', hex: '#a855f7' },
  { value: 'PINK', hex: '#ec4899' },
  { value: 'GRAY', hex: '#6b7280' },
];

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 bg-white';

function formatApiError(err: unknown): string | null {
  if (!err) return null;
  const ax = err as { response?: { data?: { message?: string | string[] } } };
  const m = ax.response?.data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  if (err instanceof Error) return err.message;
  return null;
}

export function ProjectCreateModal({ isOpen, onClose }: ProjectCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ProjectColor>('BLUE');
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(
    new Set(),
  );
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const { data: workspaces } = useWorkspaces();
  const { currentWorkspace } = useWorkspaceStore();
  const { mutateAsync: createProject, isPending, error, reset } = useCreateProject();
  const navigate = useNavigate();

  const workspaceList = useMemo(() => workspaces ?? [], [workspaces]);

  const defaultSelection = useMemo(() => {
    const s = new Set<string>();
    if (currentWorkspace && workspaceList.some((w) => w.id === currentWorkspace.id)) {
      s.add(currentWorkspace.id);
    } else if (workspaceList[0]) {
      s.add(workspaceList[0].id);
    }
    return s;
  }, [currentWorkspace, workspaceList]);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setColor('BLUE');
      setSelectedWorkspaceIds(new Set());
      setSubmitErr(null);
      reset();
    } else {
      setSelectedWorkspaceIds(new Set(defaultSelection));
    }
  }, [isOpen, reset, defaultSelection]);

  const handleClose = () => {
    onClose();
  };

  const onWorkspaceCreated = (ws: Workspace) => {
    setSelectedWorkspaceIds((prev) => new Set(prev).add(ws.id));
    setCreateWsOpen(false);
  };

  const toggleWorkspace = (id: string) => {
    setSelectedWorkspaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ids = [...selectedWorkspaceIds];
    if (ids.length === 0) {
      setSubmitErr('Select at least one workspace.');
      return;
    }
    setSubmitErr(null);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        workspaceIds: ids,
      });
      handleClose();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setSubmitErr(formatApiError(err) ?? 'Something went wrong');
    }
  };

  const errMsg = submitErr ?? formatApiError(error);

  return (
    <>
      <CreateWorkspaceModal
        isOpen={createWsOpen}
        onClose={() => setCreateWsOpen(false)}
        onCreated={onWorkspaceCreated}
      />
      <Modal isOpen={isOpen} onClose={handleClose} title="Create project" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 Launch"
            required
            autoFocus
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={3}
              className={clsx(selectClass, 'resize-y')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === opt.value ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: opt.hex }}
                  title={opt.value}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Workspaces</label>
              <button
                type="button"
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                onClick={() => setCreateWsOpen(true)}
              >
                + New workspace
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              A project must belong to at least one workspace. You can link it to several for
              cross-team collaboration. Portfolios (optional) group projects within a single
              workspace.
            </p>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
              {workspaceList.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">Create a workspace first.</p>
              ) : (
                workspaceList.map((w) => (
                  <label
                    key={w.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWorkspaceIds.has(w.id)}
                      onChange={() => toggleWorkspace(w.id)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-900">{w.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          {errMsg && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {errMsg}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isPending}
              disabled={!name.trim() || selectedWorkspaceIds.size === 0}
            >
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
