import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  usePortfolios,
  usePortfolio,
  useCreatePortfolio,
  useAddPortfolioProject,
  useRemovePortfolioProject,
  useDeletePortfolio,
} from './usePortfolios';
import type { Portfolio } from '../types';

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
  delete: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const samplePortfolio: Portfolio = {
  id: 'pf-1',
  workspaceId: 'ws-1',
  name: 'Roadmap',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  itemCount: 0,
};

describe('usePortfolios hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usePortfolios fetches nested workspace route', async () => {
    mockedApi.get.mockResolvedValue({ data: [samplePortfolio] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePortfolios('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/portfolios');
  });

  it('usePortfolio fetches global portfolio by id when workspace omitted', async () => {
    mockedApi.get.mockResolvedValue({ data: samplePortfolio });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePortfolio('pf-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/portfolios/pf-1');
  });

  it('usePortfolio uses workspace-nested route when workspaceId is set', async () => {
    mockedApi.get.mockResolvedValue({ data: samplePortfolio });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePortfolio('pf-1', 'ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/portfolios/pf-1');
  });

  it('useCreatePortfolio posts to workspace portfolios', async () => {
    mockedApi.post.mockResolvedValue({ data: samplePortfolio });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreatePortfolio(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      workspaceId: 'ws-1',
      name: 'N',
      description: 'd',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/portfolios', {
      name: 'N',
      description: 'd',
    });
  });

  it('useAddPortfolioProject posts items', async () => {
    mockedApi.post.mockResolvedValue({ data: samplePortfolio });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useAddPortfolioProject(), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({
      workspaceId: 'ws-1',
      portfolioId: 'pf-1',
      projectId: 'p1',
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/workspaces/ws-1/portfolios/pf-1/items',
      { projectId: 'p1' },
    );
  });

  it('useRemovePortfolioProject deletes item route', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useRemovePortfolioProject(), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({
      workspaceId: 'ws-1',
      portfolioId: 'pf-1',
      projectId: 'p1',
    });

    expect(mockedApi.delete).toHaveBeenCalledWith(
      '/workspaces/ws-1/portfolios/pf-1/items/p1',
    );
  });

  it('useDeletePortfolio deletes portfolio', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useDeletePortfolio(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ workspaceId: 'ws-1', portfolioId: 'pf-1' });

    expect(mockedApi.delete).toHaveBeenCalledWith('/workspaces/ws-1/portfolios/pf-1');
  });
});
