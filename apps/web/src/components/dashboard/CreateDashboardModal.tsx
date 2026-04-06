import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import { useCreateDashboard } from '../../hooks/useDashboards';

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated?: (id: string) => void;
}

export function CreateDashboardModal({
  isOpen,
  onClose,
  workspaceId,
  onCreated,
}: CreateDashboardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { mutateAsync: createDash, isPending, error, reset } = useCreateDashboard();

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      reset();
    }
  }, [isOpen, reset]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspaceId) return;
    try {
      const d = await createDash({
        workspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
      onCreated?.(d.id);
    } catch {
      /* mutation error surfaced via error state */
    }
  };

  const errMsg =
    error instanceof Error
      ? error.message
      : (error as unknown as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New dashboard" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sprint health"
          required
          autoFocus
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
