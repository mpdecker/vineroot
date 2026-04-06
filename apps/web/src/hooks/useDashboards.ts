import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Dashboard, DashboardWidget, DashboardWidgetType } from '../types';

export function useDashboards(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['dashboards', workspaceId],
    queryFn: async () => {
      const res = await api.get<Dashboard[]>(`/workspaces/${workspaceId}/dashboards`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useDashboard(
  workspaceId: string | undefined,
  dashboardId: string | undefined,
  options?: { withResolved?: boolean },
) {
  const withResolved = options?.withResolved !== false;
  return useQuery({
    queryKey: ['dashboards', 'one', workspaceId, dashboardId, withResolved],
    queryFn: async () => {
      const q = withResolved ? '' : '?resolved=0';
      const res = await api.get<Dashboard | null>(
        `/workspaces/${workspaceId}/dashboards/${dashboardId}${q}`,
      );
      return res.data;
    },
    enabled: !!workspaceId && !!dashboardId,
  });
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      name: string;
      description?: string;
      color?: string;
    }) => {
      const { workspaceId, ...body } = data;
      const res = await api.post<Dashboard>(`/workspaces/${workspaceId}/dashboards`, body);
      return res.data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', d.workspaceId] });
    },
  });
}

export function useUpdateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      dashboardId: string;
      name?: string;
      description?: string;
      color?: string;
    }) => {
      const { workspaceId, dashboardId, ...body } = data;
      const res = await api.patch<Dashboard>(
        `/workspaces/${workspaceId}/dashboards/${dashboardId}`,
        body,
      );
      return res.data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', d.workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ['dashboards', 'one', d.workspaceId, d.id],
      });
    },
  });
}

export function useDeleteDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workspaceId: string; dashboardId: string }) => {
      await api.delete(`/workspaces/${data.workspaceId}/dashboards/${data.dashboardId}`);
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', d.workspaceId] });
      queryClient.removeQueries({
        queryKey: ['dashboards', 'one', d.workspaceId, d.dashboardId],
      });
    },
  });
}

export function useAddDashboardWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      dashboardId: string;
      type: DashboardWidgetType;
      title: string;
      gridW?: number;
      gridH?: number;
      config?: Record<string, unknown>;
    }) => {
      const { workspaceId, dashboardId, ...body } = data;
      const res = await api.post<DashboardWidget>(
        `/workspaces/${workspaceId}/dashboards/${dashboardId}/widgets`,
        body,
      );
      return { widget: res.data, workspaceId, dashboardId };
    },
    onSuccess: ({ workspaceId, dashboardId }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ['dashboards', 'one', workspaceId, dashboardId],
      });
    },
  });
}

export function useDeleteDashboardWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      dashboardId: string;
      widgetId: string;
    }) => {
      await api.delete(
        `/workspaces/${data.workspaceId}/dashboards/${data.dashboardId}/widgets/${data.widgetId}`,
      );
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', d.workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ['dashboards', 'one', d.workspaceId, d.dashboardId],
      });
    },
  });
}
