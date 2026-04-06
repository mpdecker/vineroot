import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ensureWorkspaceOnProject } from '../lib/projectWorkspace';
import type {
  ProjectCfdDto,
  ProjectEpicRollupsDto,
  ProjectIntakeFormDto,
  ProjectSavedViewConfigDto,
  ProjectSavedViewDto,
  ProjectSprintVelocityDto,
  ProjectWorkloadDto,
  SprintBurnupDto,
  SprintBurndownDto,
  UpsertProjectIntakeFormRequest,
} from '@vineroot/shared-types';
import { Project, Sprint, TaskActivityLog } from '../types';

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      const res = await api.get<Project[]>(`/workspaces/${workspaceId}/projects`);
      const list = res.data ?? [];
      return list.map((p) => ensureWorkspaceOnProject(p, workspaceId));
    },
    enabled: !!workspaceId,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const res = await api.get<Project>(`/projects/${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useProjectActivity(projectId: string | undefined, take = 100) {
  return useQuery({
    queryKey: ['projects', projectId, 'activity', take],
    queryFn: async () => {
      const res = await api.get<TaskActivityLog[]>(
        `/projects/${projectId}/activity-logs?take=${take}`,
      );
      return res.data;
    },
    enabled: !!projectId,
  });
}

function invalidateProjectQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  project: Project,
) {
  queryClient.invalidateQueries({ queryKey: ['projects', 'mine'] });
  queryClient.invalidateQueries({ queryKey: ['projects'] });
  queryClient.invalidateQueries({ queryKey: ['projects', project.id] });
  for (const wid of project.workspaceIds ?? []) {
    queryClient.invalidateQueries({ queryKey: ['projects', wid] });
  }
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      color?: string;
      emoji?: string;
      /** At least one workspace id required. */
      workspaceIds: string[];
    }) => {
      const ids = data.workspaceIds;
      if (ids.length === 0) {
        throw new Error('At least one workspace is required');
      }
      const [primaryWorkspaceId, ...extraWorkspaceIds] = ids;
      const res = await api.post<Project>(
        `/workspaces/${primaryWorkspaceId}/projects`,
        {
          name: data.name,
          description: data.description,
          color: data.color,
          emoji: data.emoji,
          ...(extraWorkspaceIds.length > 0
            ? { workspaceIds: extraWorkspaceIds }
            : {}),
        },
      );
      return ensureWorkspaceOnProject(res.data, primaryWorkspaceId);
    },
    onSuccess: (project) => {
      invalidateProjectQueries(queryClient, project);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      ...data
    }: {
      projectId: string;
      name?: string;
      description?: string;
      color?: string;
      emoji?: string;
      status?: string;
      workspaceIds?: string[];
      teamId?: string | null;
      kanbanWipEnforcement?: string;
    }) => {
      const res = await api.patch<Project>(`/projects/${projectId}`, data);
      return res.data;
    },
    onSuccess: (project) => {
      invalidateProjectQueries(queryClient, project);
    },
  });
}

export function useDuplicateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      workspaceId: string;
      projectId: string;
      name?: string;
      workspaceIds?: string[];
    }) => {
      const { workspaceId, projectId, ...body } = args;
      const res = await api.post<Project>(
        `/workspaces/${workspaceId}/projects/${projectId}/duplicate`,
        body,
      );
      return ensureWorkspaceOnProject(res.data, workspaceId);
    },
    onSuccess: (project, variables) => {
      invalidateProjectQueries(queryClient, project);
      queryClient.invalidateQueries({
        queryKey: ['projects', project.id, 'activity'],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', variables.projectId, 'activity'],
      });
    },
  });
}

export function useSprintBurndown(projectId: string | undefined, sprintId: string | undefined) {
  return useQuery({
    queryKey: ['sprint-burndown', projectId, sprintId],
    queryFn: async () => {
      const res = await api.get<SprintBurndownDto>(
        `/projects/${projectId}/sprints/${sprintId}/burndown`,
      );
      return res.data;
    },
    enabled: Boolean(projectId && sprintId),
    staleTime: 30_000,
  });
}

export function useSprintBurnup(projectId: string | undefined, sprintId: string | undefined) {
  return useQuery({
    queryKey: ['sprint-burnup', projectId, sprintId],
    queryFn: async () => {
      const res = await api.get<SprintBurnupDto>(
        `/projects/${projectId}/sprints/${sprintId}/burnup`,
      );
      return res.data;
    },
    enabled: Boolean(projectId && sprintId),
    staleTime: 30_000,
  });
}

export function useProjectCfd(
  projectId: string | undefined,
  from?: string,
  to?: string,
) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return useQuery({
    queryKey: ['projects', projectId, 'cfd', from ?? '', to ?? ''],
    queryFn: async () => {
      const res = await api.get<ProjectCfdDto>(`/projects/${projectId}/cfd${suffix}`);
      return res.data;
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useProjectEpicRollups(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'epic-rollups'],
    queryFn: async () => {
      const res = await api.get<ProjectEpicRollupsDto>(
        `/projects/${projectId}/epic-rollups`,
      );
      return res.data;
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useProjectWorkload(
  projectId: string | undefined,
  weeks = 12,
  from?: string,
  sprintFilter?: string,
  epicFilter?: string,
) {
  const qs = new URLSearchParams();
  qs.set('weeks', String(weeks));
  if (from) qs.set('from', from);
  if (sprintFilter && sprintFilter !== 'all') {
    qs.set('sprintFilter', sprintFilter);
  }
  if (epicFilter && epicFilter !== 'all') {
    qs.set('epicFilter', epicFilter);
  }
  const q = qs.toString();
  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'workload',
      weeks,
      from ?? '',
      sprintFilter ?? 'all',
      epicFilter ?? 'all',
    ],
    queryFn: async () => {
      const res = await api.get<ProjectWorkloadDto>(
        `/projects/${projectId}/workload?${q}`,
      );
      return res.data;
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useProjectSavedViews(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'saved-views'],
    queryFn: async () => {
      const res = await api.get<ProjectSavedViewDto[]>(
        `/projects/${projectId}/saved-views`,
      );
      return res.data;
    },
    enabled: Boolean(projectId),
    staleTime: 15_000,
  });
}

export function useCreateProjectSavedView(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; config: ProjectSavedViewConfigDto }) => {
      if (!projectId) throw new Error('projectId required');
      const res = await api.post<ProjectSavedViewDto>(
        `/projects/${projectId}/saved-views`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'saved-views'] });
    },
  });
}

export function useDeleteProjectSavedView(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (viewId: string) => {
      if (!projectId) throw new Error('projectId required');
      await api.delete(`/projects/${projectId}/saved-views/${viewId}`);
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'saved-views'] });
    },
  });
}

export function useUpdateProjectSavedView(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      viewId: string;
      name?: string;
      config?: ProjectSavedViewConfigDto;
      sortOrder?: number;
    }) => {
      if (!projectId) throw new Error('projectId required');
      const { viewId, ...body } = args;
      const res = await api.patch<ProjectSavedViewDto>(
        `/projects/${projectId}/saved-views/${viewId}`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'saved-views'] });
    },
  });
}

export function useReorderProjectSavedViews(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!projectId) throw new Error('projectId required');
      const res = await api.patch<ProjectSavedViewDto[]>(
        `/projects/${projectId}/saved-views/reorder`,
        { orderedIds },
      );
      return res.data;
    },
    onSuccess: (data) => {
      if (!projectId) return;
      queryClient.setQueryData(['projects', projectId, 'saved-views'], data);
    },
  });
}

export function useProjectSprintVelocity(
  projectId: string | undefined,
  take = 6,
  enabled = true,
) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprint-velocity', take],
    queryFn: async () => {
      const res = await api.get<ProjectSprintVelocityDto>(
        `/projects/${projectId}/sprints/velocity?take=${take}`,
      );
      return res.data;
    },
    enabled: Boolean(projectId && enabled),
    staleTime: 30_000,
  });
}

export function useProjectIntakeForm(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'intake-form'],
    queryFn: async () => {
      const res = await api.get<ProjectIntakeFormDto | null>(
        `/projects/${projectId}/intake-form`,
      );
      return res.data;
    },
    enabled: Boolean(projectId),
  });
}

export function useUpsertProjectIntakeForm(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpsertProjectIntakeFormRequest) => {
      if (!projectId) throw new Error('projectId required');
      const res = await api.put<ProjectIntakeFormDto>(
        `/projects/${projectId}/intake-form`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'intake-form'] });
    },
  });
}

export function usePublishProjectIntakeForm(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('projectId required');
      const res = await api.post<ProjectIntakeFormDto>(
        `/projects/${projectId}/intake-form/publish`,
      );
      return res.data;
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'intake-form'] });
    },
  });
}

export function useUnpublishProjectIntakeForm(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('projectId required');
      const res = await api.post<ProjectIntakeFormDto>(
        `/projects/${projectId}/intake-form/unpublish`,
      );
      return res.data;
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'intake-form'] });
    },
  });
}

export function useCreateSprint(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      goal?: string;
      startDate: string;
      endDate: string;
      state?: string;
    }) => {
      if (!projectId) throw new Error('projectId required');
      const res = await api.post<Sprint>(`/projects/${projectId}/sprints`, body);
      return res.data;
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
}
