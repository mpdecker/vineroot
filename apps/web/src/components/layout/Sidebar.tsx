import { useMemo, useState } from 'react';
import {
  Home,
  CheckSquare,
  Bell,
  Plus,
  Settings,
  LogOut,
  Building2,
  FolderKanban,
  FolderGit2,
  LayoutDashboard,
  Target,
  BarChart3,
  Zap,
  Bot,
  Plug,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMyProjects } from '../../hooks/useMyProjects';
import { useProjects } from '../../hooks/useProjects';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { disconnectSocket } from '../../lib/socket';
import { ProjectCreateModal } from '../project/ProjectCreateModal';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import { clsx } from 'clsx';

const PROJECT_DOT: Record<string, string> = {
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

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const { sidebarCollapsed } = useUIStore();
  const { logout } = useAuthStore();
  const handleLogout = () => {
    disconnectSocket();
    logout();
  };
  const { data: mineProjects } = useMyProjects();
  const { data: workspaceScopedProjects } = useProjects(currentWorkspace?.id ?? '');
  const { data: workspaces } = useWorkspaces();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  /** Same source as Projects tab when a workspace is selected; avoids fragile workspaceIds-only filtering. */
  const workspaceProjects = useMemo(
    () => (currentWorkspace ? workspaceScopedProjects ?? [] : mineProjects ?? []),
    [currentWorkspace, workspaceScopedProjects, mineProjects],
  );

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/my-tasks', icon: CheckSquare, label: 'My Tasks' },
    { path: '/inbox', icon: Bell, label: 'Inbox' },
    { path: '/projects', icon: FolderGit2, label: 'Projects' },
    { path: '/dashboards', icon: LayoutDashboard, label: 'Dashboards' },
    { path: '/workspaces', icon: Building2, label: 'Workspaces' },
    { path: '/portfolios', icon: FolderKanban, label: 'Portfolios' },
    { path: '/goals', icon: Target, label: 'Goals' },
    { path: '/reporting', icon: BarChart3, label: 'Reporting' },
    { path: '/automations', icon: Zap, label: 'Automations' },
    { path: '/integrations', icon: Plug, label: 'Integrations' },
    { path: '/pm', icon: Bot, label: 'ModelT PM' },
  ];

  return (
    <div
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } h-screen bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300`}
    >
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold">
            V
          </div>
          {!sidebarCollapsed && <h1 className="font-bold text-gray-900">Vineroot</h1>}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive(item.path)
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}

        {!sidebarCollapsed && (
          <>
            <div className="mt-6">
              <div className="flex items-center justify-between px-3 mb-3">
                <h3 className="text-xs font-semibold text-gray-600 uppercase">Workspaces</h3>
                <Plus
                  className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600"
                  onClick={() => setShowCreateWorkspace(true)}
                  aria-label="Create workspace"
                />
              </div>
              <div className="space-y-1">
                {workspaces?.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      setCurrentWorkspace(ws);
                      navigate('/home');
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                      currentWorkspace?.id === ws.id
                        ? 'bg-white border border-brand-200 text-gray-900 shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    <Building2 className="w-4 h-4 flex-shrink-0 text-brand-600" />
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}
                {!workspaces?.length && (
                  <p className="px-3 text-xs text-gray-500">No workspaces yet</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between px-3 mb-3">
                <h3 className="text-xs font-semibold text-gray-600 uppercase">Projects</h3>
                <Plus
                  className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600"
                  onClick={() => setShowCreateProject(true)}
                  aria-label="Create project"
                />
              </div>
              <div className="space-y-1">
                {workspaceProjects?.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                      isActive(`/projects/${project.id}`)
                        ? 'bg-gray-200 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: PROJECT_DOT[project.color] ?? '#3b82f6',
                      }}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
                {!workspaceProjects?.length && (
                  <p className="px-3 text-xs text-gray-500">
                    {currentWorkspace ? 'No projects in this workspace' : 'No projects yet'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">Settings</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">Log out</span>}
        </button>
      </div>

      <ProjectCreateModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
      />
      <CreateWorkspaceModal
        isOpen={showCreateWorkspace}
        onClose={() => setShowCreateWorkspace(false)}
        onCreated={(ws) => setCurrentWorkspace(ws)}
      />
    </div>
  );
}
