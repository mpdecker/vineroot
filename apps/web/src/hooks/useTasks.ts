import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  applyTaskReorderToProject,
  flattenProjectTasks,
} from '../lib/applyTaskReorderToProject';
import type { ReorderTaskItem } from '../lib/projectTaskDnD';
import { Project, Task } from '../types';

export type { ReorderTaskItem } from '../lib/projectTaskDnD';

export const taskDetailQueryKey = (taskId: string) => ['task-detail', taskId] as const;

export function useTasks(projectId?: string, sectionId?: string) {
  return useQuery({
    queryKey: ['tasks', projectId, sectionId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await api.get<Task[]>(`/projects/${projectId}/tasks`);
      let tasks = res.data;
      if (sectionId) {
        tasks = tasks.filter((t) => t.sectionId === sectionId);
      }
      return tasks;
    },
    enabled: !!projectId,
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: ['tasks:me'],
    queryFn: async () => {
      const res = await api.get<Task[]>('/tasks/mine');
      return res.data;
    },
  });
}

/** Full task payload (nested subtasks, dependencies, custom fields, attachments, activity). */
export function useTask(
  taskId: string | undefined,
  options?: { enabled?: boolean; placeholderData?: Task },
) {
  return useQuery({
    queryKey: taskId ? taskDetailQueryKey(taskId) : ['task-detail', ''],
    queryFn: async () => {
      const res = await api.get<Task>(`/tasks/${taskId}`);
      return res.data;
    },
    enabled: !!taskId && (options?.enabled ?? true),
    placeholderData: options?.placeholderData,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId?: string;
      title: string;
      description?: string;
      sectionId?: string;
      parentTaskId?: string;
      priority?: string;
      dueDate?: string;
      startDate?: string;
      /** Omit for default (assign creator). Pass [] for no assignees. */
      assigneeIds?: string[];
    }) => {
      if (data.projectId) {
        const { projectId, ...body } = data;
        const res = await api.post<Task>(`/projects/${projectId}/tasks`, body);
        return res.data;
      }
      const res = await api.post<Task>(`/tasks`, data);
      return res.data;
    },
    onSuccess: (_task, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (variables.parentTaskId) {
        queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(variables.parentTaskId) });
      }
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', variables.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
        queryClient.invalidateQueries({
          queryKey: ['projects', variables.projectId, 'activity'],
        });
        queryClient.invalidateQueries({
          queryKey: ['projects', variables.projectId, 'epic-rollups'],
        });
        queryClient.invalidateQueries({
          queryKey: ['projects', variables.projectId, 'cfd'],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { taskId: string } & Record<string, unknown>) => {
      const { taskId, ...data } = payload;
      const res = await api.patch<Task>(`/tasks/${taskId}`, data);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({
          queryKey: ['projects', task.projectId, 'activity'],
        });
        queryClient.invalidateQueries({
          queryKey: ['projects', task.projectId, 'epic-rollups'],
        });
        queryClient.invalidateQueries({
          queryKey: ['projects', task.projectId, 'cfd'],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    },
  });
}

export function useDuplicateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      taskId: string;
      projectId?: string;
      sectionId?: string;
      title?: string;
    }) => {
      const { taskId, ...body } = payload;
      const res = await api.post<Task>(`/tasks/${taskId}/duplicate`, body);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({
          queryKey: ['projects', task.projectId, 'activity'],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    },
  });
}

export function useMoveTask() {
  return useMutation({
    mutationFn: async ({
      taskId,
      sectionId,
      sortOrder,
    }: {
      taskId: string;
      sectionId?: string;
      sortOrder?: number;
    }) => {
      const res = await api.patch<Task>(`/tasks/${taskId}`, { sectionId, sortOrder });
      return res.data;
    },
  });
}

/** Batch update task order / sections (board + list drag-and-drop). Optimistic cache; rolls back on error. */
export function useReorderTasks(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: ReorderTaskItem[]) => {
      await api.patch('/tasks/reorder', { items });
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ['projects', projectId] });
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });

      const previousProject = queryClient.getQueryData<Project>(['projects', projectId]);
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', projectId]);

      if (previousProject) {
        const nextProject = applyTaskReorderToProject(previousProject, items);
        queryClient.setQueryData(['projects', projectId], nextProject);
        queryClient.setQueryData(['tasks', projectId], flattenProjectTasks(nextProject));
      }

      return { previousProject, previousTasks };
    },
    onError: (_err, _items, context) => {
      if (context?.previousProject !== undefined) {
        queryClient.setQueryData(['projects', projectId], context.previousProject);
      }
      if (context?.previousTasks !== undefined) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

export function useAssignTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      userId,
      unitsPercent,
    }: {
      taskId: string;
      userId: string;
      unitsPercent?: number;
    }) => {
      const res = await api.post<Task>(`/tasks/${taskId}/assignees`, {
        userId,
        ...(unitsPercent !== undefined ? { unitsPercent } : {}),
      });
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId, 'workload'] });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    },
  });
}

export function usePatchAssigneeUnits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      userId,
      unitsPercent,
      workMinutes,
      costPerUse,
    }: {
      taskId: string;
      userId: string;
      unitsPercent?: number;
      workMinutes?: number | null;
      costPerUse?: number | null;
    }) => {
      const body: Record<string, unknown> = {};
      if (unitsPercent !== undefined) body.unitsPercent = unitsPercent;
      if (workMinutes !== undefined) body.workMinutes = workMinutes;
      if (costPerUse !== undefined) body.costPerUse = costPerUse;
      if (Object.keys(body).length === 0) {
        throw new Error('Provide unitsPercent, workMinutes, and/or costPerUse');
      }
      const res = await api.patch<Task>(`/tasks/${taskId}/assignees/${userId}`, body);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId, 'workload'] });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    },
  });
}

export function useRemoveAssignee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const res = await api.delete<Task>(`/tasks/${taskId}/assignees/${userId}`);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: string; projectId?: string }) => {
      await api.delete(`/tasks/${taskId}`);
      return { taskId, projectId };
    },
    onSuccess: ({ taskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(taskId) });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'epic-rollups'],
        });
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'cfd'],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks:me'] });
    },
  });
}

export function useAddTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      blockingTaskId,
      lagDays,
    }: {
      taskId: string;
      blockingTaskId: string;
      lagDays?: number;
    }) => {
      const res = await api.post<Task>(`/tasks/${taskId}/dependencies`, {
        blockingTaskId,
        ...(lagDays !== undefined ? { lagDays } : {}),
      });
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
    },
  });
}

export function useRemoveTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      blockingTaskId,
    }: {
      taskId: string;
      blockingTaskId: string;
    }) => {
      const res = await api.delete<Task>(`/tasks/${taskId}/dependencies/${blockingTaskId}`);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
    },
  });
}

export function useUpdateTaskDependencyLag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      blockingTaskId,
      ...patch
    }: {
      taskId: string;
      blockingTaskId: string;
      lagDays?: number;
      linkType?: string;
      lagIsElapsed?: boolean;
    }) => {
      const res = await api.patch<Task>(
        `/tasks/${taskId}/dependencies/${blockingTaskId}`,
        patch,
      );
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
    },
  });
}

export function useAddTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      ...body
    }: {
      taskId: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
      storageKey?: string;
    }) => {
      const res = await api.post<Task>(`/tasks/${taskId}/attachments`, body);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
    },
  });
}

export function useUploadTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<Task>(`/tasks/${taskId}/attachments/upload`, fd, {
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData) {
              delete (headers as Record<string, unknown>)['Content-Type'];
            }
            return data;
          },
        ],
      });
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
    },
  });
}

export function useDeleteTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, attachmentId }: { taskId: string; attachmentId: string }) => {
      const res = await api.delete<Task>(`/tasks/${taskId}/attachments/${attachmentId}`);
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(task.id), task);
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
      }
    },
  });
}

export function useSetTaskCustomFieldValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      taskId,
      fieldId,
      value,
    }: {
      workspaceId: string;
      taskId: string;
      fieldId: string;
      value: Record<string, unknown>;
    }) => {
      const res = await api.put(`/workspaces/${workspaceId}/custom-fields/tasks/${taskId}/fields/${fieldId}`, {
        value,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(variables.taskId) });
    },
  });
}

export function useAddTaskGenericResourceAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      genericResourceId,
      unitsPercent,
    }: {
      taskId: string;
      genericResourceId: string;
      unitsPercent?: number;
    }) => {
      const res = await api.post<Task>(`/tasks/${taskId}/generic-resource-assignments`, {
        genericResourceId,
        ...(unitsPercent !== undefined ? { unitsPercent } : {}),
      });
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId, 'workload'] });
      }
    },
  });
}

export function usePatchTaskGenericResourceAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      genericResourceId,
      unitsPercent,
    }: {
      taskId: string;
      genericResourceId: string;
      unitsPercent: number;
    }) => {
      const res = await api.patch<Task>(
        `/tasks/${taskId}/generic-resource-assignments/${genericResourceId}`,
        { unitsPercent },
      );
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId, 'workload'] });
      }
    },
  });
}

export function useRemoveTaskGenericResourceAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      genericResourceId,
    }: {
      taskId: string;
      genericResourceId: string;
    }) => {
      const res = await api.delete<Task>(
        `/tasks/${taskId}/generic-resource-assignments/${genericResourceId}`,
      );
      return res.data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(task.id) });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', task.projectId, 'workload'] });
      }
    },
  });
}
