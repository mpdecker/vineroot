import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Workspace, WorkspaceRole } from '../types';

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId],
    queryFn: async () => {
      const res = await api.get<Workspace>(`/workspaces/${workspaceId}`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

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

export function useInviteMember(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; role: WorkspaceRole }) => {
      if (!workspaceId) throw new Error('No workspace');
      const res = await api.post<Workspace>(`/workspaces/${workspaceId}/members`, body);
      return res.data;
    },
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', ws.id] });
    },
  });
}

export function useRemoveMember(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!workspaceId) throw new Error('No workspace');
      const res = await api.delete<Workspace>(`/workspaces/${workspaceId}/members/${userId}`);
      return res.data;
    },
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', ws.id] });
    },
  });
}

export function useUpdateMemberRole(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WorkspaceRole }) => {
      if (!workspaceId) throw new Error('No workspace');
      const res = await api.patch<Workspace>(`/workspaces/${workspaceId}/members/${userId}`, {
        role,
      });
      return res.data;
    },
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', ws.id] });
    },
  });
}
