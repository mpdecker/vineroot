import { useNotifications, useMarkAllRead } from '../../hooks/useNotifications';
import { Button } from '../../components/ui';
import { Mail, AlertCircle, MessageSquare, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function InboxPage() {
  const { data: notifications, isLoading } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          You're all caught up!
        </h2>
        <p className="text-gray-600">
          No new notifications. Keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600">
            {unreadCount} new {unreadCount === 1 ? 'notification' : 'notifications'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => markAllRead()}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden divide-y divide-gray-200">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
              !notification.isRead ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">
                  {notification.title}
                </h3>
                {notification.body && (
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.body}
                  </p>
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
          </div>
        ))}
      </div>
    </div>
  );
}
