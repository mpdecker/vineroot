import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Workspace } from '../types';

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await api.get<Workspace[]>('/workspaces');
      return res.data;
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post<Workspace>('/workspaces', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      ...body
    }: {
      workspaceId: string;
      name?: string;
      description?: string;
      logoUrl?: string;
      slackIncomingWebhookUrl?: string | null;
    }) => {
      const res = await api.patch<Workspace>(`/workspaces/${workspaceId}`, body);
      return res.data;
    },
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', ws.id] });
    },
  });
}
