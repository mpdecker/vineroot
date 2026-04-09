import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Mail,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Filter,
} from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
} from '../../hooks/useNotifications';
import { Button } from '../../components/ui';
import { useUIStore } from '../../stores/ui.store';
import { api } from '../../lib/api';
import type { Task } from '../../types';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const openTask = useUIStore((s) => s.openTask);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useNotifications(unreadOnly);
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const getIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'TASK_COMMENTED':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'TASK_DUE_SOON':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Mail className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleRowClick = async (n: (typeof notifications)[0]) => {
    if (!n.isRead) {
      markRead(n.id);
    }
    const rt = (n.resourceType || '').toUpperCase();
    if (n.resourceId && rt.includes('TASK')) {
      try {
        const res = await api.get<Task>(`/tasks/${n.resourceId}`);
        const t = res.data;
        if (t?.projectId) {
          openTask(t.id);
          navigate(`/projects/${t.projectId}/list`);
          return;
        }
      } catch {
        /* ignore */
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">
            {unreadCount} unread · {notifications.length} shown
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
              unreadOnly
                ? 'border-brand-300 bg-brand-50 text-brand-800'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {unreadOnly ? 'Unread only' : 'All'}
          </button>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              disabled={markingAll}
              onClick={() => markAllRead()}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {unreadOnly ? 'No unread notifications' : "You're all caught up"}
          </h2>
          <p className="text-gray-600">
            {unreadOnly ? 'Switch to All to see older items.' : 'Notifications will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden divide-y divide-gray-200 border border-gray-200">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleRowClick(notification)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                !notification.isRead ? 'bg-blue-50/80' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">{notification.title}</h3>
                  {notification.body && (
                    <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
