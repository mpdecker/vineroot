import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useSprintBurndown,
  useSprintBurnup,
  useProjectCfd,
  useProjectEpicRollups,
  useProjectSprintVelocity,
  useCreateSprint,
} from './useProjects';
import type { Project, Sprint } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const sampleProject: Project = {
  id: 'p1',
  workspaceIds: ['ws-a', 'ws-b'],
  name: 'Proj',
  color: 'BLUE',
  status: 'ACTIVE',
  isPrivate: false,
  isArchived: false,
  defaultView: 'list',
};

describe('useProjects hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useProjects loads workspace-scoped project list', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleProject] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjects('ws-a'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-a/projects');
    expect(result.current.data).toEqual([sampleProject]);
  });

  it('useProjects injects workspace id when API returns empty workspaceIds', async () => {
    const bare: Project = { ...sampleProject, workspaceIds: [] };
    mockedApi.get.mockResolvedValue({ data: [bare] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjects('ws-injected'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].workspaceIds).toContain('ws-injected');
  });

  it('useProject loads single project', async () => {
    mockedApi.get.mockResolvedValue({ data: sampleProject });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProject('p1'), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1');
  });

  it('useCreateProject posts workspaceIds array', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleProject });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateProject(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      name: 'N',
      workspaceIds: ['ws-a', 'ws-b'],
      description: 'd',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-a/projects', {
      name: 'N',
      workspaceIds: ['ws-b'],
      description: 'd',
    });
  });

  it('useCreateProject ensures primary workspace on returned dto', async () => {
    mockedApi.post.mockResolvedValue({
      data: { ...sampleProject, workspaceIds: [] },
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateProject(), { wrapper: wrapper(client) });

    const created = await result.current.mutateAsync({
      name: 'N',
      workspaceIds: ['ws-a'],
    });

    expect(created.workspaceIds).toContain('ws-a');
  });

  it('useUpdateProject patches project including workspaceIds', async () => {
    mockedApi.patch.mockResolvedValue({
      data: { ...sampleProject, workspaceIds: ['ws-b'] },
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useUpdateProject(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      projectId: 'p1',
      name: 'Renamed',
      workspaceIds: ['ws-b'],
    });

    expect(mockedApi.patch).toHaveBeenCalledWith('/projects/p1', {
      name: 'Renamed',
      workspaceIds: ['ws-b'],
    });
  });

  it('useSprintBurndown fetches burndown for project and sprint', async () => {
    const dto = {
      sprintId: 'sp1',
      projectId: 'p1',
      totalScope: 10,
      days: [{ date: '2024-01-01', remaining: 10, ideal: 10 }],
    };
    mockedApi.get.mockResolvedValue({ data: dto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSprintBurndown('p1', 'sp1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1/sprints/sp1/burndown');
    expect(result.current.data).toEqual(dto);
  });

  it('useProjectCfd fetches CFD endpoint with optional query string', async () => {
    const dto = {
      projectId: 'p1',
      days: [{ date: '2026-01-01', byStatus: { BACKLOG: 1 } }],
      statusOrder: ['BACKLOG'],
    };
    mockedApi.get.mockResolvedValue({ data: dto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjectCfd('p1', '2026-01-01', '2026-01-07'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1/cfd?from=2026-01-01&to=2026-01-07');
    expect(result.current.data).toEqual(dto);
  });

  it('useProjectCfd stays idle when projectId is missing', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjectCfd(undefined), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('useProjectEpicRollups fetches epic-rollups endpoint', async () => {
    const dto = {
      projectId: 'p1',
      epics: [
        {
          epicId: 'e1',
          title: 'Epic',
          storyPointsTotal: 5,
          storyPointsDone: 3,
          taskCount: 2,
          doneCount: 1,
        },
      ],
    };
    mockedApi.get.mockResolvedValue({ data: dto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjectEpicRollups('p1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1/epic-rollups');
    expect(result.current.data).toEqual(dto);
  });

  it('useSprintBurndown stays idle when sprintId is missing', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSprintBurndown('p1', undefined), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('useSprintBurnup fetches burnup endpoint', async () => {
    const dto = {
      sprintId: 'sp1',
      projectId: 'p1',
      totalScope: 4,
      days: [{ date: '2024-01-01', completedCumulative: 0, scopeTotal: 4 }],
    };
    mockedApi.get.mockResolvedValue({ data: dto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSprintBurnup('p1', 'sp1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1/sprints/sp1/burnup');
    expect(result.current.data).toEqual(dto);
  });

  it('useProjectSprintVelocity fetches velocity with take query', async () => {
    const dto = {
      projectId: 'p1',
      sprints: [
        {
          sprintId: 'sp1',
          name: 'S1',
          startDate: '2024-06-01',
          endDate: '2024-06-14',
          state: 'CLOSED' as const,
          completedPoints: 5,
          completedTaskCount: 2,
        },
      ],
      averageCompletedPoints: 5,
    };
    mockedApi.get.mockResolvedValue({ data: dto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjectSprintVelocity('p1', 4), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/p1/sprints/velocity?take=4');
    expect(result.current.data).toEqual(dto);
  });

  it('useProjectSprintVelocity does not fetch when disabled', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProjectSprintVelocity('p1', 6, false), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('useCreateSprint posts to project sprints and invalidates project query', async () => {
    const sprint: Sprint = {
      id: 'sp1',
      projectId: 'p1',
      name: 'Sprint 1',
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-14T00:00:00.000Z',
      state: 'PLANNED',
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    mockedApi.post.mockResolvedValue({ data: sprint });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSprint('p1'), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      name: 'Sprint 1',
      startDate: '2024-01-01',
      endDate: '2024-01-14',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/projects/p1/sprints', {
      name: 'Sprint 1',
      startDate: '2024-01-01',
      endDate: '2024-01-14',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects', 'p1'] });
  });
});
