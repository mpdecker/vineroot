import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  OutboundWebhookDto,
  CreateOutboundWebhookRequest,
  CreateOutboundWebhookResponse,
} from '@vineroot/shared-types';

export function useOutboundWebhooks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['outbound-webhooks', workspaceId],
    queryFn: async () => {
      const res = await api.get<OutboundWebhookDto[]>(
        `/workspaces/${workspaceId}/outbound-webhooks`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateOutboundWebhook(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateOutboundWebhookRequest) => {
      const res = await api.post<CreateOutboundWebhookResponse>(
        `/workspaces/${workspaceId}/outbound-webhooks`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-webhooks', workspaceId] });
    },
  });
}

export function useDeleteOutboundWebhook(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (webhookId: string) => {
      await api.delete(`/workspaces/${workspaceId}/outbound-webhooks/${webhookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-webhooks', workspaceId] });
    },
  });
}
