import { useMyProjects } from '../../hooks/useMyProjects';
import { useProjects } from '../../hooks/useProjects';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAuthStore } from '../../stores/auth.store';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const HOME_COLOR: Record<string, string> = {
  BLUE: '#3b82f6',
  GREEN: '#22c55e',
  RED: '#ef4444',
  ORANGE: '#f97316',
  YELLOW: '#eab308',
  TEAL: '#14b8a6',
  INDIGO: '#6366f1',
  PURPLE: '#a855f7',
  PINK: '#ec4899',
  GRAY: '#6b7280',
};

export default function HomePage() {
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { data: mineProjects } = useMyProjects();
  const { data: workspaceProjects } = useProjects(currentWorkspace?.id ?? '');
  const projects = currentWorkspace ? workspaceProjects : mineProjects;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {getGreeting()}, {user?.displayName}
        </h1>
        <p className="text-gray-600">
          {currentWorkspace
            ? `Here's what's happening in ${currentWorkspace.name} today`
            : "Here's what's happening across your work today"}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 mb-1">Projects</div>
          <div className="text-3xl font-bold text-gray-900">{projects?.length || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 mb-1">Team Members</div>
          <div className="text-3xl font-bold text-gray-900">
            {currentWorkspace?.memberCount || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 mb-1">Active Tasks</div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Projects</h2>
          <Link
            to="/projects"
            className="text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 text-sm"
          >
            View all projects <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.slice(0, 6).map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-4 h-4 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: HOME_COLOR[project.color] ?? '#3b82f6',
                  }}
                />
                <h3 className="font-semibold text-gray-900 flex-1">
                  {project.name}
                </h3>
              </div>
              {project.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {project.taskCount ?? project._count?.tasks ?? 0} active ·{' '}
                  {project.completedTaskCount ?? 0} completed
                </span>
                <span className="text-gray-400">{project.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
