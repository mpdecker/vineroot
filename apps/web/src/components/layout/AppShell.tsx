import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { GlobalSearchModal } from './GlobalSearchModal';
import { RealtimeSync } from './RealtimeSync';
import { useUIStore } from '../../stores/ui.store';
import { useWorkspaceInit } from '../../hooks/useWorkspaceInit';

export function AppShell() {
  const { sidebarCollapsed } = useUIStore();
  useWorkspaceInit();

  return (
    <div className="flex h-screen bg-white">
      <RealtimeSync />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <GlobalSearchModal />
    </div>
  );
}
