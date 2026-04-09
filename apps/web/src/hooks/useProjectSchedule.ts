import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  OverallocationBucketDto,
  ProjectLevelRequest,
  ProjectLevelResultDto,
  ScheduleOverallocationsQueryDto,
} from '@vineroot/shared-types';

function overallocationsKey(
  workspaceId: string,
  projectId: string,
  query?: ScheduleOverallocationsQueryDto,
) {
  return ['projects', projectId, 'schedule', 'overallocations', workspaceId, query ?? {}] as const;
}

function overallocationsQueryString(q?: ScheduleOverallocationsQueryDto): string {
  if (!q || Object.keys(q).length === 0) return '';
  const p = new URLSearchParams();
  if (q.granularity) p.set('granularity', q.granularity);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.scope) p.set('scope', q.scope);
  if (q.limit != null) p.set('limit', String(q.limit));
  if (q.offset != null) p.set('offset', String(q.offset));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useProjectOverallocations(
  workspaceId: string | undefined,
  projectId: string | undefined,
  query?: ScheduleOverallocationsQueryDto,
) {
  return useQuery({
    queryKey:
      workspaceId && projectId
        ? overallocationsKey(workspaceId, projectId, query)
        : ['projects', 'schedule', 'overallocations', 'disabled'],
    queryFn: async () => {
      const qs = overallocationsQueryString(query);
      const { data } = await api.get<OverallocationBucketDto[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/overallocations${qs}`,
      );
      return data;
    },
    enabled: Boolean(workspaceId && projectId),
    staleTime: 15_000,
  });
}

export function useLevelProject(workspaceId: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: ProjectLevelRequest) => {
      const { data } = await api.post<ProjectLevelResultDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/level`,
        body ?? {},
      );
      return data;
    },
    onSuccess: () => {
      if (!workspaceId || !projectId) return;
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'projects' &&
          q.queryKey[1] === projectId &&
          q.queryKey[2] === 'schedule' &&
          q.queryKey[3] === 'overallocations',
      });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'workload'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}
