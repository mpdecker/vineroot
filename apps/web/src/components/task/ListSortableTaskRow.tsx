import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskRow } from './TaskRow';
import type { Task } from '../../types';

export function ListSortableTaskRow({
  task,
  sectionId,
  onSelect,
  onStatusChange,
  leading,
  isSubtask,
}: {
  task: Task;
  sectionId: string;
  onSelect: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  leading?: ReactNode;
  isSubtask?: boolean;
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
    <TaskRow
      task={task}
      isSubtask={isSubtask}
      onSelect={onSelect}
      onStatusChange={onStatusChange}
      leading={leading}
      sortable={{
        ref: setNodeRef,
        style,
        attributes,
        listeners,
        isDragging,
      }}
    />
  );
}
