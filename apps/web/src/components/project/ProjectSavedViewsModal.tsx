import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ProjectSavedViewConfigDto, ProjectSavedViewDto } from '@vineroot/shared-types';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import {
  useCreateProjectSavedView,
  useDeleteProjectSavedView,
  useProjectSavedViews,
  useReorderProjectSavedViews,
  useUpdateProjectSavedView,
} from '../../hooks/useProjects';
import {
  buildSavedViewConfigFromCapture,
  summarizeSavedViewConfig,
  type SavedViewCaptureInput,
} from '../../lib/savedViewCapture';
import { clsx } from 'clsx';
import { GripVertical, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';

function formatApiError(err: unknown): string | null {
  if (!err) return null;
  const ax = err as { response?: { data?: { message?: string | string[] } } };
  const m = ax.response?.data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  if (err instanceof Error) return err.message;
  return null;
}

function ConfigChips({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  return (
    <ul className={clsx('flex flex-wrap gap-1.5 mt-1.5', className)}>
      {lines.map((line, i) => (
        <li
          key={`${i}-${line}`}
          className="text-[11px] leading-tight px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200/80 max-w-full truncate"
          title={line}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function SortableSavedViewRow({
  v,
  summaryLines,
  isEditing,
  editingName,
  setEditingName,
  commitRename,
  cancelRename,
  updating,
  mut,
  deleting,
  reordering,
  sortableCount,
  onApply,
  onClose,
  startRename,
  replaceConfigFromCurrent,
  deleteView,
}: {
  v: ProjectSavedViewDto;
  summaryLines: string[];
  isEditing: boolean;
  editingName: string;
  setEditingName: (s: string) => void;
  commitRename: (id: string) => void;
  cancelRename: () => void;
  updating: boolean;
  mut: boolean;
  deleting: boolean;
  reordering: boolean;
  sortableCount: number;
  onApply: (config: ProjectSavedViewConfigDto) => void;
  onClose: () => void;
  startRename: (view: ProjectSavedViewDto) => void;
  replaceConfigFromCurrent: (id: string) => void;
  deleteView: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: v.id,
    disabled: reordering || sortableCount < 2 || isEditing,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        'rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm',
        isDragging && 'z-10 ring-2 ring-brand-200',
      )}
    >
      {isEditing ? (
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="flex-1 min-w-[140px]"
            maxLength={120}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            disabled={!editingName.trim() || updating}
            onClick={() => void commitRename(v.id)}
          >
            Save
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={cancelRename}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            {sortableCount >= 2 && (
              <button
                type="button"
                className={clsx(
                  'mt-0.5 p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 touch-none shrink-0',
                  reordering && 'opacity-40 pointer-events-none',
                )}
                aria-label={`Drag to reorder ${v.name}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0"
                  title={v.name}
                >
                  {v.name}
                </span>
                <div className="flex flex-wrap gap-1 justify-end shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onApply(v.config);
                      onClose();
                    }}
                  >
                    Apply
                  </Button>
                  {mut && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="px-2"
                        disabled={updating}
                        title="Replace saved filters and tab with current screen"
                        aria-label={`Update ${v.name} from current screen`}
                        onClick={() => void replaceConfigFromCurrent(v.id)}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="px-2"
                        onClick={() => startRename(v)}
                        aria-label={`Rename ${v.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="px-2"
                        disabled={deleting}
                        onClick={async () => {
                          try {
                            await deleteView(v.id);
                          } catch {
                            /* optional */
                          }
                        }}
                        aria-label={`Delete ${v.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <ConfigChips lines={summaryLines} className="mt-0" />
            </div>
          </div>
        </>
      )}
    </li>
  );
}

interface ProjectSavedViewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectCreatedById?: string;
  currentUserId?: string;
  capture: SavedViewCaptureInput;
  sprints: { id: string; name: string }[];
  epicTasks: { id: string; title: string }[];
  onApply: (config: ProjectSavedViewConfigDto) => void;
}

export function ProjectSavedViewsModal({
  isOpen,
  onClose,
  projectId,
  projectCreatedById,
  currentUserId,
  capture,
  sprints,
  epicTasks,
  onApply,
}: ProjectSavedViewsModalProps) {
  const summaryCtx = useMemo(() => ({ sprints, epicTasks }), [sprints, epicTasks]);
  const previewConfig = useMemo(
    () => buildSavedViewConfigFromCapture(capture),
    [capture],
  );
  const previewLines = useMemo(
    () => summarizeSavedViewConfig(previewConfig, summaryCtx),
    [previewConfig, summaryCtx],
  );

  const { data: views, isLoading } = useProjectSavedViews(
    isOpen ? projectId : undefined,
  );
  const { mutateAsync: createView, isPending: creating, reset: resetCreate } =
    useCreateProjectSavedView(projectId);
  const { mutateAsync: updateView, isPending: updating } =
    useUpdateProjectSavedView(projectId);
  const { mutateAsync: removeSavedView, isPending: deleting } =
    useDeleteProjectSavedView(projectId);
  const { mutate: reorderViews, isPending: reordering } =
    useReorderProjectSavedViews(projectId);

  const [orderedViews, setOrderedViews] = useState<ProjectSavedViewDto[]>([]);
  const [newName, setNewName] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (views) {
      setOrderedViews([...views]);
    }
  }, [views]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (isOpen) {
      setNewName('');
      setFormErr(null);
      setEditingId(null);
      setEditingName('');
      resetCreate();
    }
  }, [isOpen, resetCreate]);

  const canMutateView = (v: ProjectSavedViewDto) =>
    Boolean(
      currentUserId &&
        (v.createdById === currentUserId || projectCreatedById === currentUserId),
    );

  const handleSaveCurrent = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setFormErr(null);
    try {
      await createView({
        name,
        config: previewConfig,
      });
      setNewName('');
    } catch (err) {
      setFormErr(formatApiError(err));
    }
  };

  const startRename = (v: ProjectSavedViewDto) => {
    setEditingId(v.id);
    setEditingName(v.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const commitRename = async (viewId: string) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await updateView({ viewId, name });
      cancelRename();
    } catch {
      /* optional toast */
    }
  };

  const replaceConfigFromCurrent = async (viewId: string) => {
    try {
      await updateView({ viewId, config: previewConfig });
    } catch {
      /* optional toast */
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedViews.findIndex((x) => x.id === active.id);
    const newIndex = orderedViews.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedViews, oldIndex, newIndex);
    setOrderedViews(next);
    reorderViews(next.map((x) => x.id), {
      onError: () => {
        if (views) setOrderedViews([...views]);
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saved views" size="lg">
      <p className="text-sm text-gray-600 mb-4">
        Save filters, roots-only mode, and which tab you are on. Applying restores everything in one
        step. Use &quot;Update&quot; to overwrite a saved view with your current screen. Drag the
        grip to reorder views for everyone on this project.
      </p>

      <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 mb-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Will be saved
        </p>
        <ConfigChips lines={previewLines} />
      </div>

      <form onSubmit={handleSaveCurrent} className="flex flex-col gap-2 mb-6">
        <label className="text-sm font-medium text-gray-700">Save as new view</label>
        <div className="flex gap-2 flex-wrap items-stretch">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name this view"
            className="flex-1 min-w-[180px]"
            maxLength={120}
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Saving…' : 'Save new'}
          </Button>
        </div>
        {formErr && <p className="text-sm text-red-600">{formErr}</p>}
      </form>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Saved views</h3>
        {isLoading && (
          <div className="flex justify-center py-6 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {!isLoading && (!views || views.length === 0) && (
          <p className="text-sm text-gray-500 py-2">No saved views yet.</p>
        )}
        {orderedViews.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedViews.map((x) => x.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2 max-h-[min(50vh,360px)] overflow-y-auto pr-0.5">
                {orderedViews.map((v) => {
                  const lines = summarizeSavedViewConfig(v.config, summaryCtx);
                  const mut = canMutateView(v);
                  const isEditing = editingId === v.id;
                  return (
                    <SortableSavedViewRow
                      key={v.id}
                      v={v}
                      summaryLines={lines}
                      isEditing={isEditing}
                      editingName={editingName}
                      setEditingName={setEditingName}
                      commitRename={commitRename}
                      cancelRename={cancelRename}
                      updating={updating}
                      mut={mut}
                      deleting={deleting}
                      reordering={reordering}
                      sortableCount={orderedViews.length}
                      onApply={onApply}
                      onClose={onClose}
                      startRename={startRename}
                      replaceConfigFromCurrent={replaceConfigFromCurrent}
                      deleteView={removeSavedView}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </Modal>
  );
}
