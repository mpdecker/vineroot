import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Tag } from '../types';

export function useWorkspaceTags(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['tags', workspaceId],
    queryFn: async () => {
      const res = await api.get<Tag[]>(`/workspaces/${workspaceId}/tags`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}
