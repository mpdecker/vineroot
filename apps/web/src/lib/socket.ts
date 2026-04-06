import { io, Socket } from 'socket.io-client';
import type { SocketEvent } from '@vineroot/shared-types';

let socket: Socket | null = null;
let boundToken: string | null = null;

function socketBaseUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * Returns a Socket.IO client for the `/events` namespace, recreated when the JWT changes.
 */
export function ensureRealtimeSocket(token: string): Socket {
  if (socket && boundToken !== token) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    boundToken = null;
  }
  if (!socket) {
    const url = socketBaseUrl();
    socket = io(`${url}/events`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
    boundToken = token;
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  boundToken = null;
}

export function invalidateQueriesFromSocketEvent(
  queryClient: import('@tanstack/react-query').QueryClient,
  event: SocketEvent,
): void {
  const t = event.type;
  const taskLike =
    t.startsWith('task:') ||
    t === 'agent:started' ||
    t === 'agent:completed' ||
    t === 'agent:failed';

  if (taskLike) {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    queryClient.invalidateQueries({ queryKey: ['reporting'] });
    queryClient.invalidateQueries({ queryKey: ['automations'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    queryClient.invalidateQueries({ queryKey: ['comments'] });
    const data = event.data as { task?: { id?: string; projectId?: string }; taskId?: string };
    if (data?.task?.id) {
      queryClient.invalidateQueries({ queryKey: ['task-detail', data.task.id] });
    }
    if (data?.taskId) {
      queryClient.invalidateQueries({ queryKey: ['task-detail', data.taskId] });
    }
    if (data?.task?.projectId) {
      queryClient.invalidateQueries({ queryKey: ['projects', data.task.projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', data.task.projectId] });
    }
    return;
  }

  if (t.startsWith('section:') || t === 'project:updated') {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    return;
  }

  if (t.startsWith('comment:')) {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    const c = (event.data as { comment?: { taskId?: string } })?.comment;
    if (c?.taskId) queryClient.invalidateQueries({ queryKey: ['task-detail', c.taskId] });
    return;
  }

  if (t === 'notification:new' || t === 'notification:created') {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications:unread'] });
  }
}
