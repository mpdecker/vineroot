import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  AddProjectToScheduleProgramRequest,
  CreateScheduleProgramRequest,
  ScheduleProgramDto,
  ScheduleProgramRollupDto,
} from '@vineroot/shared-types';

export function useSchedulePrograms(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'schedule-programs'],
    queryFn: async () => {
      const { data } = await api.get<ScheduleProgramDto[]>(
        `/workspaces/${workspaceId}/schedule-programs`,
      );
      return data;
    },
    enabled: Boolean(workspaceId),
  });
}

export function useScheduleProgram(
  workspaceId: string | undefined,
  programId: string | undefined,
) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'schedule-programs', programId, 'one'],
    queryFn: async () => {
      const { data } = await api.get<ScheduleProgramDto>(
        `/workspaces/${workspaceId}/schedule-programs/${programId}`,
      );
      return data;
    },
    enabled: Boolean(workspaceId && programId),
  });
}

export function useScheduleProgramRollup(
  workspaceId: string | undefined,
  programId: string | undefined,
) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'schedule-programs', programId, 'rollup'],
    queryFn: async () => {
      const { data } = await api.get<ScheduleProgramRollupDto>(
        `/workspaces/${workspaceId}/schedule-programs/${programId}/schedule-rollup`,
      );
      return data;
    },
    enabled: Boolean(workspaceId && programId),
  });
}

export function useCreateScheduleProgram(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateScheduleProgramRequest) => {
      const { data } = await api.post<ScheduleProgramDto>(
        `/workspaces/${workspaceId}/schedule-programs`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'schedule-programs'] });
    },
  });
}

export function useAddProjectToScheduleProgram(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      programId,
      body,
    }: {
      programId: string;
      body: AddProjectToScheduleProgramRequest;
    }) => {
      const { data } = await api.post<ScheduleProgramDto>(
        `/workspaces/${workspaceId}/schedule-programs/${programId}/projects`,
        body,
      );
      return data;
    },
    onSuccess: (_, { programId }) => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'schedule-programs'] });
      qc.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'schedule-programs', programId],
      });
    },
  });
}

export function useRemoveProjectFromScheduleProgram(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      programId,
      projectId,
    }: {
      programId: string;
      projectId: string;
    }) => {
      const { data } = await api.delete<ScheduleProgramDto>(
        `/workspaces/${workspaceId}/schedule-programs/${programId}/projects/${projectId}`,
      );
      return data;
    },
    onSuccess: (_, { programId }) => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'schedule-programs'] });
      qc.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'schedule-programs', programId],
      });
    },
  });
}
