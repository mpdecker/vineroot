import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  ReportingSavedViewDto,
  CreateReportingSavedViewRequest,
  UpdateReportingSavedViewRequest,
} from '@vineroot/shared-types';

export function useReportingSavedViews(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['reporting-views', workspaceId],
    queryFn: async () => {
      const res = await api.get<ReportingSavedViewDto[]>(
        `/workspaces/${workspaceId}/reporting/views`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateReportingView(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReportingSavedViewRequest) => {
      if (!workspaceId) throw new Error('No workspace');
      const res = await api.post<ReportingSavedViewDto>(
        `/workspaces/${workspaceId}/reporting/views`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reporting-views', workspaceId] });
    },
  });
}

export function useUpdateReportingView(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      viewId,
      body,
    }: {
      viewId: string;
      body: UpdateReportingSavedViewRequest;
    }) => {
      if (!workspaceId) throw new Error('No workspace');
      const res = await api.patch<ReportingSavedViewDto>(
        `/workspaces/${workspaceId}/reporting/views/${viewId}`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reporting-views', workspaceId] });
    },
  });
}

export function useDeleteReportingView(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (viewId: string) => {
      if (!workspaceId) throw new Error('No workspace');
      await api.delete(`/workspaces/${workspaceId}/reporting/views/${viewId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reporting-views', workspaceId] });
    },
  });
}
