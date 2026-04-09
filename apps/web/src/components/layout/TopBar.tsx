import { Link } from 'react-router-dom';
import { Menu, Search, Bell, Share2 } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useUnreadCount } from '../../hooks/useNotifications';
import { Avatar } from '../ui';
import { useAuthStore } from '../../stores/auth.store';
import { useEffect } from 'react';

export function TopBar() {
  const { toggleSidebar, openSearch } = useUIStore();
  const { user } = useAuthStore();
  const { data: unreadCount } = useUnreadCount();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Center */}
      <div className="flex items-center gap-1"></div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => openSearch()}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          title="Search (Ctrl+K)"
          aria-label="Open search"
        >
          <Search className="w-5 h-5" />
        </button>

        <Link
          to="/notifications"
          className="relative p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount && unreadCount > 0 && (
            <span className="absolute top-0 right-0 min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <Link
          to="/settings/workspace?tab=people"
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          title="Workspace people"
          aria-label="Workspace people"
        >
          <Share2 className="w-5 h-5" />
        </Link>

        {user && (
          <Link
            to="/settings/profile"
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="Profile"
            aria-label="Profile settings"
          >
            <Avatar name={user.displayName} size="sm" />
          </Link>
        )}
      </div>
    </div>
  );
}
