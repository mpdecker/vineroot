import { clsx } from 'clsx';
import { TaskStatus, TaskPriority } from '../../types';

const priorityColors = {
  NONE: 'bg-gray-100 text-gray-800',
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

const statusColors: Record<TaskStatus, string> = {
  BACKLOG: 'bg-gray-100 text-gray-800',
  READY: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  BLOCKED: 'bg-red-100 text-red-800',
  IN_REVIEW: 'bg-orange-100 text-orange-800',
  DONE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  ESCALATION_PENDING: 'bg-red-100 text-red-800',
  BLOCKED_AWAITING_HUMAN: 'bg-orange-100 text-orange-800',
  BLOCKED_HUMAN_REROUTE: 'bg-orange-100 text-orange-800',
  REROUTED_READY: 'bg-blue-100 text-blue-800',
};

interface BadgeProps {
  type: 'priority' | 'status';
  value: TaskPriority | TaskStatus;
  size?: 'sm' | 'md';
}

export function Badge({ type, value, size = 'sm' }: BadgeProps) {
  const colors = type === 'priority' ? priorityColors[value as TaskPriority] : statusColors[value as TaskStatus];
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  const displayValue = value.split('_').join(' ').charAt(0) + value.split('_').join(' ').slice(1).toLowerCase();

  return <span className={clsx('rounded-full font-medium', colors, sizeClass)}>{displayValue}</span>;
}
