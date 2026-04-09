import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import type { CreateDashboardFromTemplateRequest } from '@vineroot/shared-types';
import {
  useCreateDashboard,
  useCreateDashboardFromTemplate,
  useDashboardTemplates,
} from '../../hooks/useDashboards';

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
  const [templateId, setTemplateId] = useState('');
  const { data: templates, isLoading: templatesLoading } = useDashboardTemplates(
    isOpen ? workspaceId : undefined,
  );
  const { mutateAsync: createDash, isPending: creatingBlank, error, reset } = useCreateDashboard();
  const {
    mutateAsync: createFromTpl,
    isPending: creatingTpl,
    error: tplError,
    reset: resetTpl,
  } = useCreateDashboardFromTemplate();
  const isPending = creatingBlank || creatingTpl;
  const mergedError = error ?? tplError;

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setTemplateId('');
      reset();
      resetTpl();
    }
  }, [isOpen, reset, resetTpl]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    try {
      if (templateId) {
        const body: CreateDashboardFromTemplateRequest = {
          templateId,
          ...(name.trim() ? { name: name.trim() } : {}),
        };
        const d = await createFromTpl({
          workspaceId,
          ...body,
        });
        onClose();
        onCreated?.(d.id);
        return;
      }
      if (!name.trim()) return;
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
    mergedError instanceof Error
      ? mergedError.message
      : (mergedError as unknown as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;

  const selectClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New dashboard" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={selectClass}
            disabled={templatesLoading}
          >
            <option value="">Custom (empty dashboard)</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.description}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={templateId ? 'Name (optional)' : 'Name'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            templateId
              ? 'Leave blank to use the template default name'
              : 'e.g. Sprint health'
          }
          required={!templateId}
          autoFocus
        />
        {!templateId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
        {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isPending}
            disabled={!templateId && !name.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
