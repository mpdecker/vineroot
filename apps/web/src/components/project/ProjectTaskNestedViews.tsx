import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { Task } from '../../types';
import { ListSortableTaskRow } from '../task/ListSortableTaskRow';
import { BoardSortableTaskCard } from './BoardSortableTaskCard';
import { subtasksDropId } from '../../lib/projectTaskDnD';

function SubtasksDropZone({ parentId, children }: { parentId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: subtasksDropId(parentId),
    data: { type: 'subtasks', parentId },
  });
  return (
    <div
      ref={setNodeRef}
      className={clsx('min-h-[12px] rounded-sm', isOver && 'bg-brand-50/60 ring-1 ring-brand-200/80 ring-inset')}
    >
      {children}
    </div>
  );
}

function expandToggle(
  hasSubs: boolean,
  isCollapsed: boolean,
  onToggle: () => void,
): ReactNode {
  if (!hasSubs) {
    return <span className="w-4 h-4 inline-block shrink-0" aria-hidden />;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="p-0.5 rounded hover:bg-gray-200 text-gray-500 shrink-0"
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? 'Expand subtasks' : 'Collapse subtasks'}
    >
      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );
}

function NestedListRow({
  task,
  sectionId,
  depth,
  collapsed,
  onToggle,
  onSelectTask,
  onStatusChange,
}: {
  task: Task;
  sectionId: string;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelectTask: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const subs = [...(task.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasSubs = subs.length > 0;
  const isCollapsed = collapsed.has(task.id);

  return (
    <div>
      <ListSortableTaskRow
        task={task}
        sectionId={sectionId}
        isSubtask={depth > 0}
        leading={expandToggle(hasSubs, isCollapsed, () => onToggle(task.id))}
        onSelect={onSelectTask}
        onStatusChange={onStatusChange}
      />
      {hasSubs && !isCollapsed && (
        <SubtasksDropZone parentId={task.id}>
          <SortableContext items={subs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="pl-2 border-l border-gray-100 ml-3">
              {subs.map((st) => (
                <NestedListRow
                  key={st.id}
                  task={st}
                  sectionId={sectionId}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onSelectTask={onSelectTask}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </SortableContext>
        </SubtasksDropZone>
      )}
    </div>
  );
}

/** Renders root tasks and nested subtasks (list) with per-parent drag scopes. */
export function ProjectTaskNestedList({
  sectionId,
  roots,
  onSelectTask,
  onStatusChange,
}: {
  sectionId: string;
  roots: Task[];
  onSelectTask: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const sortedRoots = useMemo(
    () => [...roots].sort((a, b) => a.sortOrder - b.sortOrder),
    [roots],
  );

  return (
    <>
      {sortedRoots.map((t) => (
        <NestedListRow
          key={t.id}
          task={t}
          sectionId={sectionId}
          depth={0}
          collapsed={collapsed}
          onToggle={toggle}
          onSelectTask={onSelectTask}
          onStatusChange={onStatusChange}
        />
      ))}
    </>
  );
}

function NestedBoardCard({
  task,
  sectionId,
  depth,
  collapsed,
  onToggle,
  onSelectTask,
}: {
  task: Task;
  sectionId: string;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelectTask: (taskId: string) => void;
}) {
  const subs = [...(task.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasSubs = subs.length > 0;
  const isCollapsed = collapsed.has(task.id);

  return (
    <div className="space-y-2">
      <BoardSortableTaskCard
        task={task}
        sectionId={sectionId}
        depth={depth}
        leading={expandToggle(hasSubs, isCollapsed, () => onToggle(task.id))}
        onSelect={onSelectTask}
      />
      {hasSubs && !isCollapsed && (
        <SubtasksDropZone parentId={task.id}>
          <SortableContext items={subs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pl-1">
              {subs.map((st) => (
                <NestedBoardCard
                  key={st.id}
                  task={st}
                  sectionId={sectionId}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onSelectTask={onSelectTask}
                />
              ))}
            </div>
          </SortableContext>
        </SubtasksDropZone>
      )}
    </div>
  );
}

/** Renders root tasks and nested subtasks (board). */
export function ProjectTaskNestedBoard({
  sectionId,
  roots,
  onSelectTask,
}: {
  sectionId: string;
  roots: Task[];
  onSelectTask: (taskId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const sortedRoots = useMemo(
    () => [...roots].sort((a, b) => a.sortOrder - b.sortOrder),
    [roots],
  );

  return (
    <div className="space-y-2">
      {sortedRoots.map((t) => (
        <NestedBoardCard
          key={t.id}
          task={t}
          sectionId={sectionId}
          depth={0}
          collapsed={collapsed}
          onToggle={toggle}
          onSelectTask={onSelectTask}
        />
      ))}
    </div>
  );
}
