import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SocketEvent } from '@vineroot/shared-types';
import { useAuthStore } from '../../stores/auth.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import {
  ensureRealtimeSocket,
  disconnectSocket,
  invalidateQueriesFromSocketEvent,
} from '../../lib/socket';

/** Joins workspace rooms and syncs React Query when the API broadcasts Socket.IO events. */
export function RealtimeSync() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  useEffect(() => {
    const workspaceId = currentWorkspace?.id;
    const userId = user?.id;
    const token = accessToken;

    if (!workspaceId || !userId || !token) {
      disconnectSocket();
      return;
    }

    const s = ensureRealtimeSocket(token);

    const onEvent = (ev: SocketEvent) => {
      invalidateQueriesFromSocketEvent(queryClient, ev);
    };

    const onConnect = () => {
      s.emit('join:workspace', { workspaceId, userId });
    };

    s.on('event', onEvent);
    s.on('connect', onConnect);

    if (s.connected) {
      onConnect();
    } else {
      s.connect();
    }

    return () => {
      s.off('event', onEvent);
      s.off('connect', onConnect);
      if (s.connected) {
        s.emit('leave:workspace', { workspaceId, userId });
      }
    };
  }, [currentWorkspace?.id, user?.id, accessToken, queryClient]);

  return null;
}
