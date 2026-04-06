import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import { useCreateWorkspace } from '../../hooks/useWorkspaces';
import type { Workspace } from '../../types';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful create (e.g. select new workspace in parent). */
  onCreated?: (workspace: Workspace) => void;
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreated,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { mutateAsync: createWs, isPending, error, reset } = useCreateWorkspace();

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      reset();
    }
  }, [isOpen, reset]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const ws = await createWs({
      name: trimmed,
      description: description.trim() || undefined,
    });
    onCreated?.(ws);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create workspace" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Inc"
          required
          autoFocus
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {errMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {errMsg}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={!name.trim()}>
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
