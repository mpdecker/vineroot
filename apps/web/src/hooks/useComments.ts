import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Comment } from '../types';

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const res = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
      return res.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      body: string;
      parentCommentId?: string;
      mentionedUserIds?: string[];
    }) => {
      const res = await api.post<Comment>(`/tasks/${taskId}/comments`, payload);
      return res.data;
    },
    onSuccess: () => {
      if (!taskId) return;
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
