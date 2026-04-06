import { useState } from 'react';
import { useMyTasks, useUpdateTask } from '../../hooks/useTasks';
import { TaskRow } from '../../components/task/TaskRow';
import { AddTaskModal } from '../../components/task/AddTaskModal';
import { useUIStore } from '../../stores/ui.store';
import { isToday, isAfter, isBefore, addDays } from 'date-fns';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '../../components/ui';

export default function MyTasksPage() {
  const [addOpen, setAddOpen] = useState(false);
  const { data: tasks, isLoading } = useMyTasks();
  const { openTask } = useUIStore();
  const { mutate: updateTask } = useUpdateTask();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const groupTasks = () => {
    const today: typeof tasks = [];
    const upcoming: typeof tasks = [];
    const later: typeof tasks = [];
    const noDueDate: typeof tasks = [];

    tasks?.forEach((task) => {
      if (!task.dueDate) {
        noDueDate.push(task);
        return;
      }

      const dueDate = new Date(task.dueDate);
      if (isToday(dueDate)) {
        today.push(task);
      } else if (isAfter(dueDate, new Date()) && isBefore(dueDate, addDays(new Date(), 7))) {
        upcoming.push(task);
      } else {
        later.push(task);
      }
    });

    return { today, upcoming, later, noDueDate };
  };

  const { today, upcoming, later, noDueDate } = groupTasks();

  const renderGroup = (title: string, items: typeof tasks, count: number) => (
    <div key={title} className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 px-4 py-2 bg-gray-50">
        {title} ({count})
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {items && items.length > 0 ? (
          items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onSelect={openTask}
              onStatusChange={(taskId, status) =>
                updateTask({ taskId, status })
              }
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
          <p className="text-gray-600">
            {tasks?.length || 0} task{tasks?.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <Button
          type="button"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setAddOpen(true)}
          className="shrink-0"
        >
          Add task
        </Button>
      </div>

      <AddTaskModal isOpen={addOpen} onClose={() => setAddOpen(false)} />

      {renderGroup('Today', today, today.length)}
      {renderGroup('Upcoming', upcoming, upcoming.length)}
      {renderGroup('Later', later, later.length)}
      {renderGroup('No due date', noDueDate, noDueDate.length)}
    </div>
  );
}
