import type { CSSProperties, ReactNode } from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { Check, MessageCircle, GripVertical } from 'lucide-react';
import { Task } from '../../types';
import { summarizeCustomFieldsForList } from '../../lib/formatTaskCustomFields';
import { Badge, Avatar, Tooltip } from '../ui';
import { formatDistanceToNow, isPast, isToday } from 'date-fns';
import { clsx } from 'clsx';

export interface TaskRowSortableProps {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging?: boolean;
}

interface TaskRowProps {
  task: Task;
  isSubtask?: boolean;
  onSelect: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  /** Legacy HTML5 drag; ignored when `sortable` is set. */
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** List view: drag handle uses @dnd-kit listeners only on the grip. */
  sortable?: TaskRowSortableProps;
  /** Extra control before the grip (e.g. expand/collapse subtasks). */
  leading?: ReactNode;
}

export function TaskRow({
  task,
  isSubtask = false,
  onSelect,
  onStatusChange,
  onDragStart,
  sortable,
  leading,
}: TaskRowProps) {
  const customFieldLines = summarizeCustomFieldsForList(task.customFields, 2);
  const isDone = task.status === 'DONE';
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isDone;
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));

  return (
    <div
      ref={sortable?.ref}
      style={sortable?.style}
      {...(sortable ? sortable.attributes : {})}
      className={clsx(
        'flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors group',
        sortable ? 'cursor-default' : 'cursor-move',
        sortable?.isDragging && 'opacity-50 bg-gray-50',
        isSubtask && 'ml-8 bg-gray-50',
      )}
      draggable={!sortable}
      onDragStart={!sortable ? onDragStart : undefined}
    >
      {leading != null && leading !== false && (
        <span className="flex-shrink-0 flex items-center justify-center w-6">{leading}</span>
      )}
      {sortable && (
        <span
          {...sortable.listeners}
          className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-0.5 -ml-1 rounded hover:bg-gray-100"
          aria-hidden
        >
          <GripVertical className="w-4 h-4" />
        </span>
      )}

      {/* Checkbox */}
      <button
        onClick={() => onStatusChange(task.id, isDone ? 'BACKLOG' : 'DONE')}
        className={clsx(
          'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          isDone
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        {isDone && <Check className="w-3 h-3 text-white stroke-[3]" />}
      </button>

      {/* Title */}
      <button
        onClick={() => onSelect(task.id)}
        className={clsx(
          'flex-1 text-left text-sm truncate',
          isDone && 'text-gray-400 line-through'
        )}
      >
        {task.title}
      </button>

      {/* Assignees */}
      {task.assignees && task.assignees.length > 0 && (
        <div className="flex -space-x-1 flex-shrink-0">
          {task.assignees.slice(0, 3).map((assignee) => (
            <Tooltip key={assignee.id} content={assignee.user.displayName}>
              <Avatar name={assignee.user.displayName} size="xs" />
            </Tooltip>
          ))}
        </div>
      )}

      {/* Priority */}
      {task.priority !== 'NONE' && (
        <div className="flex-shrink-0">
          <Badge type="priority" value={task.priority} />
        </div>
      )}

      {task.workItemType && task.workItemType !== 'TASK' && (
        <span className="text-[10px] font-medium text-violet-800 bg-violet-50 rounded px-1 py-0.5 flex-shrink-0 uppercase">
          {task.workItemType.slice(0, 3)}
        </span>
      )}
      {task.storyPoints != null && (
        <span className="text-[10px] text-gray-700 bg-gray-100 rounded px-1 py-0.5 flex-shrink-0 tabular-nums">
          {task.storyPoints} pt
        </span>
      )}
      {task.sprint?.name && (
        <span
          className="text-[10px] text-sky-800 bg-sky-50 rounded px-1 py-0.5 max-w-[88px] truncate flex-shrink-0"
          title={task.sprint.name}
        >
          {task.sprint.name}
        </span>
      )}

      {/* Due Date */}
      {task.dueDate && (
        <div className={clsx('text-xs flex-shrink-0', isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-orange-600' : 'text-gray-500')}>
          {isToday(new Date(task.dueDate))
            ? 'Today'
            : formatDistanceToNow(new Date(task.dueDate), { addSuffix: false })}
        </div>
      )}

      {customFieldLines.length > 0 && (
        <div className="hidden md:flex items-center gap-1 flex-shrink-0 max-w-[200px]">
          {customFieldLines.map((c) => (
            <span
              key={c.key}
              title={c.line}
              className="text-[10px] text-gray-500 truncate border border-gray-100 bg-gray-50/80 rounded px-1 py-0.5"
            >
              {c.line}
            </span>
          ))}
        </div>
      )}

      {/* Comments & Subtasks */}
      <div className="flex items-center gap-1 text-gray-400 text-xs flex-shrink-0">
        {(task.subtaskCount ?? task.subtasks?.length ?? 0) > 0 && (
          <span>{task.subtaskCount ?? task.subtasks?.length}</span>
        )}
        {task.commentCount && task.commentCount > 0 && (
          <>
            <MessageCircle className="w-4 h-4" />
            <span>{task.commentCount}</span>
          </>
        )}
      </div>

    </div>
  );
}
