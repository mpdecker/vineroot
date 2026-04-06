import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import { useUpdateProject } from '../../hooks/useProjects';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import type { KanbanWipEnforcement, Project, ProjectColor, Workspace } from '../../types';
import { clsx } from 'clsx';

interface ProjectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
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

export function ProjectEditModal({ isOpen, onClose, project }: ProjectEditModalProps) {
  const { data: workspaces } = useWorkspaces();
  const { mutateAsync: updateProject, isPending, error, reset } = useUpdateProject();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState<ProjectColor>(project.color);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(
    () => new Set(project.workspaceIds ?? []),
  );
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [kanbanWipPolicy, setKanbanWipPolicy] = useState<KanbanWipEnforcement>(
    () => project.kanbanWipEnforcement ?? 'OFF',
  );

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDescription(project.description || '');
      setColor(project.color);
      setSelectedWorkspaceIds(new Set(project.workspaceIds ?? []));
      setKanbanWipPolicy(project.kanbanWipEnforcement ?? 'OFF');
      setSubmitErr(null);
      reset();
    }
  }, [isOpen, project, reset]);

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
      setSubmitErr('Keep at least one workspace linked to this project.');
      return;
    }
    setSubmitErr(null);
    try {
      await updateProject({
        projectId: project.id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        workspaceIds: ids,
        kanbanWipEnforcement: kanbanWipPolicy,
      });
      onClose();
    } catch (err) {
      setSubmitErr(formatApiError(err) ?? 'Something went wrong');
    }
  };

  const errMsg = submitErr ?? formatApiError(error);

  const onWorkspaceCreated = (ws: Workspace) => {
    setSelectedWorkspaceIds((prev) => new Set(prev).add(ws.id));
    setCreateWsOpen(false);
  };

  return (
    <>
      <CreateWorkspaceModal
        isOpen={createWsOpen}
        onClose={() => setCreateWsOpen(false)}
        onCreated={onWorkspaceCreated}
      />
      <Modal isOpen={isOpen} onClose={onClose} title="Project settings" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Kanban WIP policy
            </label>
            <select
              className={selectClass}
              value={kanbanWipPolicy}
              onChange={(e) => setKanbanWipPolicy(e.target.value as KanbanWipEnforcement)}
            >
              <option value="OFF">Off — column caps are optional (display only)</option>
              <option value="WARN">Warn — confirm before exceeding a column cap</option>
              <option value="STRICT">Strict — block moves and new cards over a cap</option>
            </select>
            <p className="text-xs text-gray-500 mt-1.5">
              Set caps per column on the board. Only root-level tasks count toward WIP.
            </p>
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
              Link this project to any workspace you belong to. Removing a workspace also removes
              it from portfolios in that workspace.
            </p>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
              {(workspaces ?? []).map((w) => (
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
              ))}
            </div>
          </div>
          {errMsg && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {errMsg}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isPending}
              disabled={!name.trim() || selectedWorkspaceIds.size === 0}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
