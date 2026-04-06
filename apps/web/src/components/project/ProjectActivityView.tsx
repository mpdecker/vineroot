import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useProjectActivity } from '../../hooks/useProjects';
import { useUIStore } from '../../stores/ui.store';

interface ProjectActivityViewProps {
  projectId: string;
}

export function ProjectActivityView({ projectId }: ProjectActivityViewProps) {
  const openTask = useUIStore((s) => s.openTask);
  const { data: rows = [], isLoading, isError } = useProjectActivity(projectId, 150);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" aria-hidden />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-red-600">Could not load project activity.</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500 max-w-md mx-auto">
        No activity yet. Changes to tasks in this project will appear here.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Project activity</h2>
      <ul className="space-y-3 text-sm">
        {rows.map((log) => (
          <li
            key={log.id}
            className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm"
          >
            <div className="text-gray-900">{log.description}</div>
            <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-gray-600">
                {log.actor?.displayName ?? 'Someone'}
              </span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
              <span>·</span>
              <span className="text-gray-400">{log.eventType}</span>
              {log.task && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => openTask(log.task!.id)}
                    className="text-brand-600 hover:text-brand-700 font-medium text-left"
                  >
                    {log.task.title}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
