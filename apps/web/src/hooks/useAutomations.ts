import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AutomationDto, CreateAutomationRequest, UpdateAutomationRequest } from '@vineroot/shared-types';

export function useAutomations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['automations', workspaceId],
    queryFn: async () => {
      const res = await api.get<AutomationDto[]>(`/workspaces/${workspaceId}/automations`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateAutomation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateAutomationRequest) => {
      const res = await api.post<AutomationDto>(`/workspaces/${workspaceId}/automations`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', workspaceId] });
    },
  });
}

export function useUpdateAutomation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateAutomationRequest }) => {
      const res = await api.patch<AutomationDto>(
        `/workspaces/${workspaceId}/automations/${id}`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', workspaceId] });
    },
  });
}

export function useDeleteAutomation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workspaces/${workspaceId}/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', workspaceId] });
    },
  });
}

export function useToggleAutomation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AutomationDto>(
        `/workspaces/${workspaceId}/automations/${id}/toggle`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', workspaceId] });
    },
  });
}
