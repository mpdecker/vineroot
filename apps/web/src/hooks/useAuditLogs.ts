import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AuditLogRow {
  id: string;
  workspaceId: string;
  taskId?: string;
  actorId?: string;
  actorTier?: string;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function useTaskAuditLogs(taskId: string | undefined) {
  return useQuery({
    queryKey: ['audit-logs', 'task', taskId],
    queryFn: async () => {
      const res = await api.get<AuditLogRow[]>(`/tasks/${taskId}/audit-logs`);
      return res.data;
    },
    enabled: !!taskId,
  });
}

export function useWorkspaceAuditLogs(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['audit-logs', 'workspace', workspaceId],
    queryFn: async () => {
      const res = await api.get<AuditLogRow[]>(
        `/workspaces/${workspaceId}/audit-logs`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}
