import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useTaskComments, useCreateComment } from './useComments';
import type { Comment } from '../types';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const comment: Comment = {
  id: 'c1',
  taskId: 't1',
  authorId: 'u1',
  body: 'Hello',
  isAgentComment: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: { id: 'u1', email: 'a@b.c', displayName: 'Author', isAgent: false, timezone: 'UTC' },
};

describe('useComments hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useTaskComments loads list', async () => {
    mockedApi.get.mockResolvedValue({ data: [comment] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useTaskComments('t1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/tasks/t1/comments');
    expect(result.current.data).toEqual([comment]);
  });

  it('useCreateComment posts body and invalidates', async () => {
    mockedApi.post.mockResolvedValue({ data: comment });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const inv = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateComment('t1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({ body: 'Nice work' });

    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/t1/comments', { body: 'Nice work' });
    expect(inv).toHaveBeenCalledWith({ queryKey: ['comments', 't1'] });
    expect(inv).toHaveBeenCalledWith({ queryKey: ['tasks', 't1'] });
  });
});
