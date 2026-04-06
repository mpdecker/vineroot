import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useDashboards,
  useDashboard,
  useCreateDashboard,
  useAddDashboardWidget,
} from './useDashboards';
import type { Dashboard } from '../types';

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
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const sampleDash: Dashboard = {
  id: 'd1',
  workspaceId: 'ws1',
  name: 'Ops',
  createdById: 'u1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  widgetCount: 0,
};

describe('useDashboards hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useDashboards loads workspace dashboards', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleDash] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDashboards('ws1'), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws1/dashboards');
    expect(result.current.data).toEqual([sampleDash]);
  });

  it('useDashboard requests resolved data by default', async () => {
    mockedApi.get.mockResolvedValue({ data: { ...sampleDash, widgets: [] } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDashboard('ws1', 'd1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws1/dashboards/d1');
  });

  it('useDashboard can skip resolved payload', async () => {
    mockedApi.get.mockResolvedValue({ data: sampleDash });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(
      () => useDashboard('ws1', 'd1', { withResolved: false }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws1/dashboards/d1?resolved=0');
  });

  it('useCreateDashboard posts and invalidates list', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleDash });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useCreateDashboard(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      workspaceId: 'ws1',
      name: 'New',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws1/dashboards', { name: 'New' });
  });

  it('useAddDashboardWidget posts widget route', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        id: 'w1',
        dashboardId: 'd1',
        type: 'TEXT_NOTE',
        title: 'T',
        sortOrder: 0,
        gridX: 0,
        gridY: 0,
        gridW: 4,
        gridH: 2,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useAddDashboardWidget(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      workspaceId: 'ws1',
      dashboardId: 'd1',
      type: 'TEXT_NOTE',
      title: 'Hello',
      config: { body: 'x' },
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws1/dashboards/d1/widgets', {
      type: 'TEXT_NOTE',
      title: 'Hello',
      config: { body: 'x' },
    });
  });
});
