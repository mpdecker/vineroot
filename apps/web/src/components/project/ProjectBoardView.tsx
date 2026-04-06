import { useMemo, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { clsx } from 'clsx';
import type { KanbanWipEnforcement, Section, Task } from '../../types';
import { TaskCard } from '../task/TaskCard';
import { TaskCreate } from '../task/TaskCreate';
import { useCreateSection, useUpdateSection } from '../../hooks/useSections';
import { useProjectTaskDragHandlers } from '../../hooks/useProjectTaskDragHandlers';
import { preferTaskHitOverColumnCollision } from '../../lib/boardListDnDCollision';
import { countBoardRoots } from '../../lib/wipBoard';
import { ProjectTaskNestedBoard } from './ProjectTaskNestedViews';
import { Plus } from 'lucide-react';

interface ProjectBoardViewProps {
  sections: Section[];
  projectId: string;
  kanbanWipEnforcement?: KanbanWipEnforcement;
  onSelectTask: (taskId: string) => void;
}

function BoardColumnHeader({ section, projectId }: { section: Section; projectId: string }) {
  const roots = countBoardRoots(section);
  const limit = section.wipLimit;
  const { mutateAsync: updateSection, isPending } = useUpdateSection();
  const [draft, setDraft] = useState(() => (limit != null ? String(limit) : ''));

  useEffect(() => {
    setDraft(limit != null ? String(limit) : '');
  }, [limit]);

  const persistLimit = async () => {
    const t = draft.trim();
    if (t === '') {
      if (limit != null) {
        await updateSection({ projectId, sectionId: section.id, wipLimit: null });
      }
      return;
    }
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1) {
      setDraft(limit != null ? String(limit) : '');
      return;
    }
    if (n !== limit) {
      await updateSection({ projectId, sectionId: section.id, wipLimit: n });
    }
  };

  const over = limit != null && roots > limit;
  const atCap = limit != null && roots === limit;

  return (
    <div className="flex flex-col gap-1.5 flex-shrink-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 leading-tight">{section.name}</h3>
        <span
          className={clsx(
            'text-xs tabular-nums px-2 py-1 rounded-full border flex-shrink-0',
            over
              ? 'text-red-700 bg-red-50 border-red-200'
              : atCap
                ? 'text-amber-800 bg-amber-50 border-amber-200'
                : 'text-gray-500 bg-white border-gray-100',
          )}
          title="Root tasks only (subtasks do not count toward WIP)"
        >
          {limit != null ? `${roots}/${limit}` : roots}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <label className="sr-only" htmlFor={`wip-${section.id}`}>
          WIP limit for {section.name}
        </label>
        <span className="text-gray-400 shrink-0">WIP cap</span>
        <input
          id={`wip-${section.id}`}
          type="number"
          min={1}
          placeholder="—"
          disabled={isPending}
          className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-gray-800 text-xs bg-white"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void persistLimit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void persistLimit();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </div>
  );
}

function BoardColumnBody({
  section,
  taskMap,
  onSelectTask,
}: {
  section: Section;
  taskMap: Map<string, Task>;
  onSelectTask: (taskId: string) => void;
}) {
  const taskIds = useMemo(
    () =>
      [...(section.tasks ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => t.id),
    [section.tasks],
  );

  const { setNodeRef, isOver } = useDroppable({
    id: `column:${section.id}`,
    data: { type: 'column', sectionId: section.id },
  });

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={clsx(
          'space-y-2 flex-1 overflow-y-auto min-h-[120px] scrollbar-thin pr-0.5 rounded-lg p-1 -m-1 transition-colors',
          isOver && 'bg-brand-50/60 ring-2 ring-brand-200 ring-inset',
        )}
      >
        <ProjectTaskNestedBoard
          sectionId={section.id}
          roots={taskIds.map((id) => taskMap.get(id)).filter((t): t is Task => Boolean(t))}
          onSelectTask={onSelectTask}
        />
      </div>
    </SortableContext>
  );
}

export function ProjectBoardView({
  sections,
  projectId,
  kanbanWipEnforcement = 'OFF',
  onSelectTask,
}: ProjectBoardViewProps) {
  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.sortOrder - b.sortOrder),
    [sections],
  );

  const {
    taskMap,
    draggingTask,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useProjectTaskDragHandlers(projectId, sortedSections);

  const { mutateAsync: createSection, isPending: isCreatingSection } = useCreateSection();
  const [addingSectionOpen, setAddingSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const sectionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSectionOpen) sectionInputRef.current?.focus();
  }, [addingSectionOpen]);

  const submitSection = async () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) {
      setAddingSectionOpen(false);
      return;
    }
    await createSection({ projectId, name: trimmed });
    setNewSectionName('');
    setAddingSectionOpen(false);
  };

  const handleSectionKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSection();
    }
    if (e.key === 'Escape') {
      setAddingSectionOpen(false);
      setNewSectionName('');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={preferTaskHitOverColumnCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full min-h-0 bg-gray-100/80">
        {kanbanWipEnforcement !== 'OFF' && (
          <p className="text-xs text-gray-600 px-6 pt-3 shrink-0">
            Kanban WIP ({kanbanWipEnforcement === 'STRICT' ? 'strict' : 'warn'}): counts are
            root-level tasks per column.
            {kanbanWipEnforcement === 'WARN' &&
              ' You will be asked to confirm moves that exceed a cap.'}
            {kanbanWipEnforcement === 'STRICT' &&
              ' Moves and new cards that exceed a cap are blocked by the server.'}
          </p>
        )}
        <div className="flex gap-4 p-6 overflow-x-auto flex-1 min-h-0">
        {sortedSections.map((section) => (
          <div
            key={section.id}
            className="flex-shrink-0 w-72 bg-gray-50 rounded-xl p-4 space-y-3 max-h-full flex flex-col border border-gray-200/80 shadow-sm"
          >
            <BoardColumnHeader section={section} projectId={projectId} />

            <BoardColumnBody
              section={section}
              taskMap={taskMap}
              onSelectTask={onSelectTask}
            />

            <div className="flex-shrink-0 pt-1 border-t border-gray-200/80">
              <TaskCreate projectId={projectId} sectionId={section.id} />
            </div>
          </div>
        ))}

        <div className="flex-shrink-0 w-72 flex flex-col">
          {addingSectionOpen ? (
            <div className="bg-white rounded-xl border border-brand-200 p-3 shadow-sm space-y-2">
              <input
                ref={sectionInputRef}
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={handleSectionKey}
                onBlur={() => {
                  if (!newSectionName.trim()) setAddingSectionOpen(false);
                }}
                placeholder="Section name"
                disabled={isCreatingSection}
                className="w-full text-sm px-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAddingSectionOpen(false);
                    setNewSectionName('');
                  }}
                  className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitSection}
                  disabled={isCreatingSection || !newSectionName.trim()}
                  className="text-xs px-3 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSectionOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:bg-white/80 rounded-xl border border-dashed border-gray-300 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add section
            </button>
          )}
        </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingTask ? (
          <div className="w-72 opacity-95 shadow-xl rotate-1">
            <TaskCard task={draggingTask} onSelect={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
