import { MessageCircle, GripVertical } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { Task } from '../../types';
import { summarizeCustomFieldsForList } from '../../lib/formatTaskCustomFields';
import { Avatar } from '../ui';
import { formatDistanceToNow, isPast } from 'date-fns';
import { clsx } from 'clsx';

const priorityBorderColor = {
  NONE: 'border-gray-300',
  LOW: 'border-blue-400',
  MEDIUM: 'border-yellow-400',
  HIGH: 'border-orange-400',
  URGENT: 'border-red-500',
};

export interface TaskCardSortableProps {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging?: boolean;
  /** Drag starts from the grip only (collapse / open task without dragging). */
  gripOnly?: boolean;
}

interface TaskCardProps {
  task: Task;
  onSelect: (taskId: string) => void;
  /** Legacy HTML5 drag (e.g. list view). Ignored when `sortable` is set. */
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** @dnd-kit sortable — use activation distance on pointer sensor so clicks still open the task */
  sortable?: TaskCardSortableProps;
  /** Shown before title (e.g. subtask expand chevron). */
  leading?: ReactNode;
}

export function TaskCard({ task, onSelect, onDragStart, sortable, leading }: TaskCardProps) {
  const customFieldLines = summarizeCustomFieldsForList(task.customFields, 3);
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'DONE';

  const gripOnly = Boolean(sortable?.gripOnly);
  const dragListeners = sortable && !gripOnly ? sortable.listeners : undefined;

  return (
    <div
      ref={sortable?.ref}
      style={sortable?.style}
      {...(sortable ? sortable.attributes : {})}
      {...(dragListeners ?? {})}
      draggable={!sortable}
      onDragStart={!sortable ? onDragStart : undefined}
      onClick={() => onSelect(task.id)}
      className={clsx(
        'bg-white rounded-lg shadow-sm hover:shadow-md border-l-4 p-3 transition-all text-left w-full',
        sortable && !gripOnly ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-default',
        !sortable && 'cursor-grab active:cursor-grabbing',
        sortable?.isDragging && 'opacity-40 ring-2 ring-brand-400',
        priorityBorderColor[task.priority],
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        {gripOnly && sortable && (
          <span
            {...sortable.listeners}
            className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 mt-0.5"
            aria-hidden
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}
        {leading}
        {/* Title */}
        <h4 className="font-medium text-sm text-gray-900 line-clamp-2 flex-1 min-w-0">{task.title}</h4>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {task.workItemType && task.workItemType !== 'TASK' && (
          <span className="text-[10px] font-medium text-violet-800 bg-violet-50 rounded px-1.5 py-0.5 uppercase">
            {task.workItemType}
          </span>
        )}
        {task.storyPoints != null && (
          <span className="text-[10px] text-gray-700 bg-gray-100 rounded px-1.5 py-0.5 tabular-nums">
            {task.storyPoints} pt
          </span>
        )}
        {task.sprint?.name && (
          <span
            className="text-[10px] text-sky-800 bg-sky-50 rounded px-1.5 py-0.5 max-w-[140px] truncate"
            title={task.sprint.name}
          >
            {task.sprint.name}
          </span>
        )}
      </div>

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {customFieldLines.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {customFieldLines.map((c) => (
            <span
              key={c.key}
              title={c.line}
              className="text-[11px] leading-tight text-gray-600 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 max-w-[160px] truncate"
            >
              {c.line}
            </span>
          ))}
        </div>
      )}

      {/* Bottom */}
      <div className="flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-2">
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 2).map((assignee) => (
                <Avatar key={assignee.id} name={assignee.user.displayName} size="xs" />
              ))}
            </div>
          )}
          {task.dueDate && (
            <span
              className={clsx(
                'text-xs',
                isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
              )}
            >
              {formatDistanceToNow(new Date(task.dueDate), { addSuffix: false })}
            </span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 text-gray-400 text-xs">
          {(task.subtaskCount ?? task.subtasks?.length ?? 0) > 0 && (
            <span className="text-gray-600">
              {task.subtaskCount ?? task.subtasks?.length ?? 0}
            </span>
          )}
          {task.commentCount && task.commentCount > 0 && (
            <>
              <MessageCircle className="w-3 h-3" />
              <span>{task.commentCount}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
