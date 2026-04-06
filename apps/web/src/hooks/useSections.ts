import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Section } from '../types';

export function useProjectSections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sections', projectId],
    queryFn: async () => {
      const res = await api.get<Section[]>(`/projects/${projectId}/sections`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      name: string;
      wipLimit?: number | null;
    }) => {
      const res = await api.post<Section>(
        `/projects/${data.projectId}/sections`,
        { name: data.name, ...(data.wipLimit !== undefined && { wipLimit: data.wipLimit }) },
      );
      return res.data;
    },
    onSuccess: (_section, variables) => {
      // Refresh the full project so the new section appears in the list
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      sectionId: string;
      name?: string;
      color?: string | null;
      wipLimit?: number | null;
    }) => {
      const { projectId, sectionId, ...body } = data;
      const res = await api.patch<Section>(
        `/projects/${projectId}/sections/${sectionId}`,
        body,
      );
      return res.data;
    },
    onSuccess: (_section, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['sections', variables.projectId] });
    },
  });
}
