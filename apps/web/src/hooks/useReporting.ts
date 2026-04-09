import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  WorkspaceReportingSummaryDto,
  WorkspaceReportingFilters,
} from '@vineroot/shared-types';

function buildReportingQueryString(f?: WorkspaceReportingFilters): string {
  if (!f) return '';
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.portfolioId) p.set('portfolioId', f.portfolioId);
  if (f.projectIds?.length) p.set('projectIds', f.projectIds.join(','));
  if (f.assigneeIds?.length) p.set('assigneeIds', f.assigneeIds.join(','));
  if (f.statuses?.length) p.set('statuses', f.statuses.join(','));
  if (f.tagIds?.length) p.set('tagIds', f.tagIds.join(','));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useReportingSummary(
  workspaceId: string | undefined,
  filters?: WorkspaceReportingFilters,
) {
  return useQuery({
    queryKey: ['reporting', workspaceId, filters],
    queryFn: async () => {
      const q = buildReportingQueryString(filters);
      const res = await api.get<WorkspaceReportingSummaryDto>(
        `/workspaces/${workspaceId}/reporting/summary${q}`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export async function downloadReportingCsv(
  workspaceId: string,
  filters?: WorkspaceReportingFilters,
): Promise<void> {
  const q = buildReportingQueryString(filters);
  const res = await api.get(`/workspaces/${workspaceId}/reporting/export.csv${q}`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workspace-reporting.csv';
  a.click();
  URL.revokeObjectURL(url);
}
