import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useCreateSection } from './useSections';
import type { Section } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const sampleSection: Section = {
  id: 'sec1',
  projectId: 'p1',
  name: 'To Do',
  sortOrder: 0,
  tasks: [],
};

describe('useSections hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useCreateSection posts to /projects/:id/sections', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleSection });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateSection(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ projectId: 'p1', name: 'To Do' });

    expect(mockedApi.post).toHaveBeenCalledWith('/projects/p1/sections', { name: 'To Do' });
  });

  it('useCreateSection returns the created section', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleSection });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateSection(), { wrapper: wrapper(client) });

    const section = await result.current.mutateAsync({ projectId: 'p1', name: 'To Do' });

    expect(section).toEqual(sampleSection);
  });

  it('useCreateSection propagates API errors', async () => {
    const apiError = new Error('Network Error');
    mockedApi.post.mockRejectedValue(apiError);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateSection(), { wrapper: wrapper(client) });

    await expect(result.current.mutateAsync({ projectId: 'p1', name: 'Broken' })).rejects.toThrow(
      'Network Error',
    );
  });
});
