import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Modal, Button, Input } from '../ui';
import { useCreateTask } from '../../hooks/useTasks';
import { useMyProjects } from '../../hooks/useMyProjects';
import { useProjects } from '../../hooks/useProjects';
import { useProjectSections } from '../../hooks/useSections';
import { useAuthStore } from '../../stores/auth.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import type { TaskPriority } from '../../types';
import { clsx } from 'clsx';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'NONE', label: 'No priority' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 focus:border-transparent bg-white';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { data: mineProjects } = useMyProjects();
  const { data: workspaceProjects } = useProjects(currentWorkspace?.id ?? '');
  const { mutateAsync: createTask, isPending, error, reset } = useCreateTask();

  const projectChoices = useMemo(
    () => (currentWorkspace ? workspaceProjects ?? [] : mineProjects ?? []),
    [currentWorkspace, workspaceProjects, mineProjects],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NONE');
  const [projectId, setProjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [assignToMe, setAssignToMe] = useState(true);

  const { data: sections } = useProjectSections(projectId || undefined);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setDueDate('');
      setStartDate('');
      setPriority('NONE');
      setProjectId('');
      setSectionId('');
      setAssignToMe(true);
      reset();
    }
  }, [isOpen, reset]);

  useEffect(() => {
    setSectionId('');
  }, [projectId]);

  const toIsoDate = (d: string) =>
    d ? new Date(`${d}T12:00:00`).toISOString() : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const assigneePart: { assigneeIds?: string[] } = (() => {
      if (!projectId) {
        return assignToMe ? {} : { assigneeIds: [] };
      }
      if (assignToMe && user?.id) {
        return { assigneeIds: [user.id] };
      }
      return {};
    })();

    const payload = {
      title: trimmed,
      description: description.trim() || undefined,
      dueDate: toIsoDate(dueDate),
      startDate: toIsoDate(startDate),
      priority: priority === 'NONE' ? undefined : priority,
      ...assigneePart,
      ...(projectId
        ? {
            projectId,
            sectionId: sectionId || undefined,
          }
        : {}),
    };

    await createTask(payload);
    onClose();
  };

  const errMsg = (() => {
    if (!error) return null;
    const ax = error as { response?: { data?: { message?: string | string[] } } };
    const m = ax.response?.data?.message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(', ');
    if (error instanceof Error) return error.message;
    return null;
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add task" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Optional details…"
            className={clsx(selectClass, 'resize-y min-h-[96px]')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={selectClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={selectClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={selectClass}
          >
            <option value="">Personal (no project)</option>
            {(projectChoices || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-gray-500 text-xs mt-1">
            Personal tasks stay in your workspace and appear here when you’re assigned.
          </p>
        </div>

        {projectId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className={selectClass}
            >
              <option value="">No section</option>
              {(sections || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={assignToMe}
            onChange={(e) => setAssignToMe(e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Assign to me ({user?.displayName || 'you'})
          {!projectId && (
            <span className="text-gray-500 font-normal">
              — personal tasks need this (or another assignee) to appear here
            </span>
          )}
        </label>

        {errMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{errMsg}</p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={!title.trim()}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
