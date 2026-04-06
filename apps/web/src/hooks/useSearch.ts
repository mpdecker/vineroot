import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { SearchResponseDto } from '@vineroot/shared-types';

/** Debounced query should be passed in (≥2 chars). Optional workspace narrows to linked projects. */
export function useWorkspaceSearch(debouncedQuery: string, workspaceId?: string) {
  const q = debouncedQuery.trim();
  return useQuery({
    queryKey: ['search', workspaceId ?? 'all', q],
    queryFn: async () => {
      const res = await api.get<SearchResponseDto>('/search', {
        params: {
          q,
          ...(workspaceId ? { workspaceId } : {}),
        },
      });
      return res.data;
    },
    enabled: q.length >= 2,
    staleTime: 20_000,
  });
}
