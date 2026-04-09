import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useWorkspace,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
} from './useWorkspaces';
import type { Workspace } from '../types';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const sampleWs: Workspace = {
  id: 'ws-1',
  name: 'W',
  slug: 'w',
  members: [],
};

describe('useWorkspace and member mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useWorkspace GET /workspaces/:id', async () => {
    mockedApi.get.mockResolvedValue({ data: sampleWs });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useWorkspace('ws-1'), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1');
    expect(result.current.data).toEqual(sampleWs);
  });

  it('useWorkspace disabled without id', () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useWorkspace(undefined), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('useInviteMember posts members', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleWs });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useInviteMember('ws-1'), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ email: 'x@y.com', role: 'MEMBER' });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/members', {
      email: 'x@y.com',
      role: 'MEMBER',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces', 'ws-1'] });
  });

  it('useInviteMember throws without workspaceId', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useInviteMember(undefined), { wrapper: wrapper(client) });

    await expect(
      result.current.mutateAsync({ email: 'x@y.com', role: 'MEMBER' }),
    ).rejects.toThrow('No workspace');
  });

  it('useRemoveMember deletes member', async () => {
    mockedApi.delete.mockResolvedValue({ data: sampleWs });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useRemoveMember('ws-1'), { wrapper: wrapper(client) });

    await result.current.mutateAsync('u2');

    expect(mockedApi.delete).toHaveBeenCalledWith('/workspaces/ws-1/members/u2');
  });

  it('useUpdateMemberRole patches role', async () => {
    mockedApi.patch.mockResolvedValue({ data: sampleWs });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useUpdateMemberRole('ws-1'), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ userId: 'u2', role: 'ADMIN' });

    expect(mockedApi.patch).toHaveBeenCalledWith('/workspaces/ws-1/members/u2', {
      role: 'ADMIN',
    });
  });
});
