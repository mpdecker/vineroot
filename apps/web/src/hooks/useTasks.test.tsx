import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useTasks,
  useMyTasks,
  useCreateTask,
  useAssignTask,
  useMoveTask,
  useReorderTasks,
  useTask,
  taskDetailQueryKey,
  useAddTaskDependency,
  useRemoveTaskDependency,
  useAddTaskAttachment,
  useDeleteTaskAttachment,
  useSetTaskCustomFieldValue,
  useUpdateTask,
} from './useTasks';
import { flattenProjectTasks } from '../lib/applyTaskReorderToProject';
import type { Project, Task } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const sampleTask = {
  id: 't1',
  projectId: 'p1',
  createdById: 'u1',
  title: 'Task',
  status: 'BACKLOG',
  priority: 'NONE',
  sortOrder: 0,
  actorTier: 'HUMAN',
  domain: 'GENERAL',
  complexity: 'LOW',
  reviewGate: 'NONE',
  retryCount: 0,
  isArchived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as Task;

function reorderSampleProject(): Project {
  return {
    id: 'p1',
    workspaceIds: ['w1'],
    name: 'P',
    color: 'BLUE',
    status: 'ACTIVE',
    isPrivate: false,
    isArchived: false,
    defaultView: 'list',
    sections: [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [
          { ...sampleTask, id: 't1', sectionId: 's1', title: 'One', sortOrder: 0 },
          { ...sampleTask, id: 't2', sectionId: 's1', title: 'Two', sortOrder: 1 },
        ],
      },
      {
        id: 's2',
        projectId: 'p1',
        name: 'B',
        sortOrder: 1,
        tasks: [{ ...sampleTask, id: 't3', sectionId: 's2', title: 'Three', sortOrder: 0 }],
      },
    ],
  };
}

describe('useTasks hooks (API wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useTasks loads /projects/:id/tasks', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleTask] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useTasks('p1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1/tasks');
    expect(result.current.data).toEqual([sampleTask]);
  });

  it('useTasks filters by sectionId client-side', async () => {
    mockedApi.get.mockResolvedValue({
      data: [
        { ...sampleTask, id: 'a', sectionId: 's1' },
        { ...sampleTask, id: 'b', sectionId: 's2' },
      ],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useTasks('p1', 's1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((t) => t.id)).toEqual(['a']);
  });

  it('useMyTasks loads /tasks/mine', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleTask] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useMyTasks(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/tasks/mine');
  });

  it('useCreateTask posts to /projects/:id/tasks when projectId set', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleTask });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateTask(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      projectId: 'p1',
      title: 'New',
      sectionId: 's1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/projects/p1/tasks', {
      title: 'New',
      sectionId: 's1',
    });
  });

  it('useCreateTask posts to /tasks when no projectId', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleTask });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateTask(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      title: 'Personal',
      description: 'Note',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/tasks', {
      title: 'Personal',
      description: 'Note',
    });
  });

  it('useAssignTask posts to /tasks/:id/assignees', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleTask });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useAssignTask(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ taskId: 't1', userId: 'u2' });

    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/t1/assignees', { userId: 'u2' });
  });

  it('useMoveTask patches task (section + order)', async () => {
    mockedApi.patch.mockResolvedValue({ data: sampleTask });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useMoveTask(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ taskId: 't1', sectionId: 's9', sortOrder: 3 });

    expect(mockedApi.patch).toHaveBeenCalledWith('/tasks/t1', {
      sectionId: 's9',
      sortOrder: 3,
    });
  });

  it('useReorderTasks PATCHes /tasks/reorder with items', async () => {
    mockedApi.patch.mockResolvedValue({ data: undefined });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const items = [
      { taskId: 't1', sortOrder: 0, sectionId: 's1' },
      { taskId: 't2', sortOrder: 1, sectionId: 's1' },
    ];

    const { result } = renderHook(() => useReorderTasks('p1'), { wrapper: wrapper(client) });

    await result.current.mutateAsync(items);

    expect(mockedApi.patch).toHaveBeenCalledWith('/tasks/reorder', { items });
  });

  it('useReorderTasks updates cached project and flat tasks optimistically', async () => {
    mockedApi.patch.mockResolvedValue({ data: undefined });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const project = reorderSampleProject();
    client.setQueryData(['projects', 'p1'], project);
    client.setQueryData(['tasks', 'p1'], flattenProjectTasks(project));

    const items = [
      { taskId: 't2', sortOrder: 0, sectionId: 's1' },
      { taskId: 't3', sortOrder: 0, sectionId: 's2' },
      { taskId: 't1', sortOrder: 1, sectionId: 's2' },
    ];

    const { result } = renderHook(() => useReorderTasks('p1'), { wrapper: wrapper(client) });

    await result.current.mutateAsync(items);

    const updated = client.getQueryData<Project>(['projects', 'p1']);
    expect(updated?.sections?.find((s) => s.id === 's1')?.tasks?.map((t) => t.id)).toEqual(['t2']);
    expect(updated?.sections?.find((s) => s.id === 's2')?.tasks?.map((t) => t.id)).toEqual([
      't3',
      't1',
    ]);
    const flat = client.getQueryData<Task[]>(['tasks', 'p1']);
    expect(flat?.map((t) => t.id)).toEqual(['t2', 't3', 't1']);
  });

  it('useReorderTasks rolls back cache when PATCH fails', async () => {
    mockedApi.patch.mockRejectedValue(new Error('network'));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const project = reorderSampleProject();
    client.setQueryData(['projects', 'p1'], project);
    const prevTasks = flattenProjectTasks(project);
    client.setQueryData(['tasks', 'p1'], prevTasks);

    const items = [
      { taskId: 't2', sortOrder: 0, sectionId: 's1' },
      { taskId: 't3', sortOrder: 0, sectionId: 's2' },
      { taskId: 't1', sortOrder: 1, sectionId: 's2' },
    ];

    const { result } = renderHook(() => useReorderTasks('p1'), { wrapper: wrapper(client) });

    await expect(result.current.mutateAsync(items)).rejects.toThrow('network');

    expect(client.getQueryData(['projects', 'p1'])).toEqual(project);
    expect(client.getQueryData(['tasks', 'p1'])).toEqual(prevTasks);
  });

  it('useTask loads /tasks/:id with task-detail query key', async () => {
    const detail = { ...sampleTask, id: 't99', waitingOn: [] };
    mockedApi.get.mockResolvedValue({ data: detail });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useTask('t99'), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/tasks/t99');
    expect(result.current.data).toEqual(detail);
  });

  it('useTask can be disabled and use placeholderData', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () =>
        useTask('t1', {
          enabled: false,
          placeholderData: sampleTask,
        }),
      { wrapper: wrapper(client) },
    );

    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(sampleTask);
  });

  it('useCreateTask invalidates task-detail for parent when parentTaskId set', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleTask });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTask(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      projectId: 'p1',
      title: 'Sub',
      parentTaskId: 'parent-99',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDetailQueryKey('parent-99') });
  });

  it('useAddTaskDependency posts and seeds task-detail cache', async () => {
    const next = { ...sampleTask, id: 't1', waitingOn: [{ id: 'd1', blockingId: 't2' }] };
    mockedApi.post.mockResolvedValue({ data: next });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useAddTaskDependency(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ taskId: 't1', blockingTaskId: 't2' });

    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/t1/dependencies', {
      blockingTaskId: 't2',
    });
    expect(client.getQueryData(taskDetailQueryKey('t1'))).toEqual(next);
  });

  it('useRemoveTaskDependency deletes and seeds task-detail cache', async () => {
    const next = { ...sampleTask, id: 't1', waitingOn: [] };
    mockedApi.delete.mockResolvedValue({ data: next });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useRemoveTaskDependency(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ taskId: 't1', blockingTaskId: 't2' });

    expect(mockedApi.delete).toHaveBeenCalledWith('/tasks/t1/dependencies/t2');
    expect(client.getQueryData(taskDetailQueryKey('t1'))).toEqual(next);
  });

  it('useAddTaskAttachment posts and seeds task-detail cache', async () => {
    const next = {
      ...sampleTask,
      id: 't1',
      attachments: [
        {
          id: 'a1',
          taskId: 't1',
          filename: 'f',
          mimeType: 'text/plain',
          sizeBytes: 0,
          url: 'https://x',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    mockedApi.post.mockResolvedValue({ data: next });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useAddTaskAttachment(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      taskId: 't1',
      filename: 'f',
      mimeType: 'text/plain',
      sizeBytes: 0,
      url: 'https://x',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/t1/attachments', {
      filename: 'f',
      mimeType: 'text/plain',
      sizeBytes: 0,
      url: 'https://x',
    });
    expect(client.getQueryData(taskDetailQueryKey('t1'))).toEqual(next);
  });

  it('useDeleteTaskAttachment deletes and seeds task-detail cache', async () => {
    const next = { ...sampleTask, id: 't1', attachments: [] };
    mockedApi.delete.mockResolvedValue({ data: next });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useDeleteTaskAttachment(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ taskId: 't1', attachmentId: 'a1' });

    expect(mockedApi.delete).toHaveBeenCalledWith('/tasks/t1/attachments/a1');
    expect(client.getQueryData(taskDetailQueryKey('t1'))).toEqual(next);
  });

  it('useSetTaskCustomFieldValue puts custom-field route and invalidates task-detail', async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSetTaskCustomFieldValue(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      workspaceId: 'ws1',
      taskId: 't1',
      fieldId: 'f1',
      value: { text: 'x' },
    });

    expect(mockedApi.put).toHaveBeenCalledWith(
      '/workspaces/ws1/custom-fields/tasks/t1/fields/f1',
      { value: { text: 'x' } },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDetailQueryKey('t1') });
  });

  it('useUpdateTask invalidates task-detail for updated task', async () => {
    mockedApi.patch.mockResolvedValue({ data: sampleTask });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateTask(), { wrapper: wrapper(client) });
    await result.current.mutateAsync({ taskId: 't1', title: 'Renamed' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDetailQueryKey('t1') });
  });
});
