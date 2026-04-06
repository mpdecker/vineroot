import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { TaskCard } from '../task/TaskCard';
import type { Task } from '../../types';

export function BoardSortableTaskCard({
  task,
  sectionId,
  onSelect,
  depth = 0,
  leading,
}: {
  task: Task;
  sectionId: string;
  onSelect: (taskId: string) => void;
  /** Nesting level for board subtasks (visual indent). */
  depth?: number;
  leading?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', sectionId, parentTaskId: task.parentTaskId ?? null },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={clsx(
        depth > 0 && 'ml-2 border-l-2 border-gray-200/90 pl-2',
      )}
    >
      <TaskCard
        task={task}
        leading={leading}
        onSelect={onSelect}
        sortable={{
          ref: setNodeRef,
          style,
          attributes,
          listeners,
          isDragging,
          gripOnly: true,
        }}
      />
    </div>
  );
}
