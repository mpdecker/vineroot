import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WorkspaceReportingSummaryDto } from '@vineroot/shared-types';

export function useReportingSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['reporting', workspaceId],
    queryFn: async () => {
      const res = await api.get<WorkspaceReportingSummaryDto>(
        `/workspaces/${workspaceId}/reporting/summary`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}
