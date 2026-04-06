import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useMyProjects } from './useMyProjects';
import { useWorkspaces } from './useWorkspaces';
import type { Project, Workspace } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('./useWorkspaces', () => ({
  useWorkspaces: vi.fn(),
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };
const mockedUseWorkspaces = vi.mocked(useWorkspaces);

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const ws1: Workspace = { id: 'w1', name: 'One', slug: 'one' };
const ws2: Workspace = { id: 'w2', name: 'Two', slug: 'two' };

const bareProject = (id: string): Project => ({
  id,
  workspaceIds: [],
  name: `Project ${id}`,
  color: 'BLUE',
  status: 'ACTIVE',
  isPrivate: false,
  isArchived: false,
  defaultView: 'list',
});

describe('useMyProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseWorkspaces.mockReturnValue({
      data: [ws1],
      isFetched: true,
      isError: false,
    } as unknown as ReturnType<typeof useWorkspaces>);
  });

  it('fetches per workspace and ensures workspace id on each project', async () => {
    mockedApi.get.mockResolvedValue({ data: [bareProject('p1')] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useMyProjects(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/w1/projects');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].workspaceIds).toEqual(['w1']);
  });

  it('returns empty array when user has no workspaces', async () => {
    mockedUseWorkspaces.mockReturnValue({
      data: [],
      isFetched: true,
      isError: false,
    } as unknown as ReturnType<typeof useWorkspaces>);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useMyProjects(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it('unions workspaceIds when the same project appears in multiple workspaces', async () => {
    mockedUseWorkspaces.mockReturnValue({
      data: [ws1, ws2],
      isFetched: true,
      isError: false,
    } as unknown as ReturnType<typeof useWorkspaces>);

    const shared = bareProject('p-shared');
    mockedApi.get
      .mockResolvedValueOnce({ data: [{ ...shared, workspaceIds: ['w1'] }] })
      .mockResolvedValueOnce({ data: [{ ...shared, workspaceIds: [] }] });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useMyProjects(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].workspaceIds.sort()).toEqual(['w1', 'w2'].sort());
  });

  it('does not run when workspaces query failed', () => {
    mockedUseWorkspaces.mockReturnValue({
      data: undefined,
      isFetched: true,
      isError: true,
    } as unknown as ReturnType<typeof useWorkspaces>);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useMyProjects(), { wrapper: wrapper(client) });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});
