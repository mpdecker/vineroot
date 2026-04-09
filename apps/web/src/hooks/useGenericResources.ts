import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  CreateGenericResourceRequest,
  GenericResourceDto,
  UpdateGenericResourceRequest,
} from '@vineroot/shared-types';

export function genericResourcesQueryKey(workspaceId: string | undefined) {
  return ['generic-resources', workspaceId] as const;
}

export function useGenericResources(workspaceId: string | undefined) {
  return useQuery({
    queryKey: genericResourcesQueryKey(workspaceId),
    queryFn: async () => {
      const { data } = await api.get<GenericResourceDto[]>(
        `/workspaces/${workspaceId}/generic-resources`,
      );
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateGenericResource(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateGenericResourceRequest) => {
      const { data } = await api.post<GenericResourceDto>(
        `/workspaces/${workspaceId}/generic-resources`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: genericResourcesQueryKey(workspaceId) });
    },
  });
}

export function useUpdateGenericResource(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      resourceId,
      body,
    }: {
      resourceId: string;
      body: UpdateGenericResourceRequest;
    }) => {
      const { data } = await api.patch<GenericResourceDto>(
        `/workspaces/${workspaceId}/generic-resources/${resourceId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: genericResourcesQueryKey(workspaceId) });
    },
  });
}

export function useDeleteGenericResource(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      await api.delete(`/workspaces/${workspaceId}/generic-resources/${resourceId}`);
    },
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: genericResourcesQueryKey(workspaceId) });
    },
  });
}
