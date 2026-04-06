import { Section, Task } from '../../types';
import { ProjectTaskNestedList } from './ProjectTaskNestedViews';
import { TaskCreate } from '../task/TaskCreate';
import { useUpdateTask } from '../../hooks/useTasks';
import { useCreateSection } from '../../hooks/useSections';
import { useProjectTaskDragHandlers } from '../../hooks/useProjectTaskDragHandlers';
import { preferTaskHitOverColumnCollision } from '../../lib/boardListDnDCollision';
import { ChevronDown, Plus, GripVertical } from 'lucide-react';
import { useMemo, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { clsx } from 'clsx';

interface ProjectListViewProps {
  sections: Section[];
  projectId: string;
  onSelectTask: (taskId: string) => void;
}

function ListSectionTaskList({
  section,
  taskMap,
  onSelectTask,
  onStatusChange,
}: {
  section: Section;
  taskMap: Map<string, Task>;
  onSelectTask: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
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
          'min-h-[48px] transition-colors rounded-sm -mx-1 px-1',
          isOver && 'bg-brand-50/80 ring-1 ring-brand-200 ring-inset',
        )}
      >
        <ProjectTaskNestedList
          sectionId={section.id}
          roots={taskIds.map((id) => taskMap.get(id)).filter((t): t is Task => Boolean(t))}
          onSelectTask={onSelectTask}
          onStatusChange={onStatusChange}
        />
      </div>
    </SortableContext>
  );
}

export function ProjectListView({ sections, projectId, onSelectTask }: ProjectListViewProps) {
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

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id)),
  );

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      for (const s of sortedSections) {
        if (!next.has(s.id)) next.add(s.id);
      }
      return next;
    });
  }, [sortedSections]);

  const { mutate: updateTask } = useUpdateTask();
  const { mutateAsync: createSection, isPending: isCreatingSection } = useCreateSection();

  const [addingSectionOpen, setAddingSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const sectionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSectionOpen) sectionInputRef.current?.focus();
  }, [addingSectionOpen]);

  const toggleSection = (sectionId: string) => {
    const next = new Set(expandedSections);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    setExpandedSections(next);
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask({ taskId, status: newStatus });
  };

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
      <div className="w-full bg-white">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 text-sm font-medium text-gray-600 z-10">
          <div className="w-6 flex-shrink-0 flex justify-center" title="Drag to reorder">
            <GripVertical className="w-4 h-4 text-gray-300" aria-hidden />
          </div>
          <div className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">Name</div>
          <div className="w-24">Assignee</div>
          <div className="w-24">Due Date</div>
          <div className="w-20">Priority</div>
        </div>

        {sortedSections.map((section) => (
          <div key={section.id}>
            <div
              onClick={() => toggleSection(section.id)}
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform flex-shrink-0 ${
                  expandedSections.has(section.id) ? '' : '-rotate-90'
                }`}
              />
              <h3 className="font-semibold text-sm text-gray-900">{section.name}</h3>
              <span className="text-xs text-gray-500 ml-auto">
                {section.tasks?.length || 0} tasks
              </span>
            </div>

            {expandedSections.has(section.id) && (
              <ListSectionTaskList
                section={section}
                taskMap={taskMap}
                onSelectTask={onSelectTask}
                onStatusChange={handleStatusChange}
              />
            )}

            {expandedSections.has(section.id) && (
              <div className="px-4 py-2 border-b border-gray-100 pl-[3.25rem]">
                <TaskCreate projectId={projectId} sectionId={section.id} />
              </div>
            )}
          </div>
        ))}

        {addingSectionOpen ? (
          <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
            <Plus className="w-5 h-5 text-brand-500 flex-shrink-0" />
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
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={submitSection}
                disabled={isCreatingSection || !newSectionName.trim()}
                className="text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setAddingSectionOpen(false);
                  setNewSectionName('');
                }}
                className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setAddingSectionOpen(true)}
            className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-600 cursor-pointer"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span>Add section</span>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingTask ? (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white shadow-lg border border-gray-200 rounded-lg opacity-95 max-w-lg">
            <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900 truncate">{draggingTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
