import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  GoalDto,
  CreateGoalRequest,
  UpdateGoalRequest,
  CreateGoalMetricRequest,
} from '@vineroot/shared-types';

export function useGoals(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['goals', workspaceId],
    queryFn: async () => {
      const res = await api.get<GoalDto[]>(`/workspaces/${workspaceId}/goals`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateGoal(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateGoalRequest) => {
      const res = await api.post<GoalDto>(`/workspaces/${workspaceId}/goals`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', workspaceId] });
    },
  });
}

export function useUpdateGoal(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, body }: { goalId: string; body: UpdateGoalRequest }) => {
      const res = await api.patch<GoalDto>(`/workspaces/${workspaceId}/goals/${goalId}`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', workspaceId] });
    },
  });
}

export function useDeleteGoal(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      await api.delete(`/workspaces/${workspaceId}/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', workspaceId] });
    },
  });
}

export function useCreateGoalMetric(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      body,
    }: {
      goalId: string;
      body: CreateGoalMetricRequest;
    }) => {
      const res = await api.post<GoalDto>(
        `/workspaces/${workspaceId}/goals/${goalId}/metrics`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', workspaceId] });
    },
  });
}

export function useRecomputeGoalMetric(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (metricId: string) => {
      const res = await api.post<GoalDto>(
        `/workspaces/${workspaceId}/goals/metrics/${metricId}/recompute`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', workspaceId] });
    },
  });
}
