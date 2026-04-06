import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CustomFieldDefinition } from '../types';

export function useWorkspaceCustomFields(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields', workspaceId],
    queryFn: async () => {
      const res = await api.get<CustomFieldDefinition[]>(
        `/workspaces/${workspaceId}/custom-fields`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useProjectCustomFields(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-custom-fields', projectId],
    queryFn: async () => {
      const res = await api.get<CustomFieldDefinition[]>(
        `/projects/${projectId}/custom-fields`,
      );
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      fieldId,
    }: {
      projectId: string;
      fieldId: string;
    }) => {
      const res = await api.post<CustomFieldDefinition>(
        `/projects/${projectId}/custom-fields`,
        { fieldId },
      );
      return res.data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project-custom-fields', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
}
