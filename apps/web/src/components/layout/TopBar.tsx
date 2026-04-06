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

        <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-gray-600" />
          {unreadCount && unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {Math.min(unreadCount, 9)}
            </span>
          )}
        </button>

        <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
          <Share2 className="w-5 h-5" />
        </button>

        {user && <Avatar name={user.displayName} size="sm" />}
      </div>
    </div>
  );
}
