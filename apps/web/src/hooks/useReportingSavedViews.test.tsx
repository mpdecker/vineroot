import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useReportingSavedViews,
  useCreateReportingView,
  useUpdateReportingView,
  useDeleteReportingView,
} from './useReportingSavedViews';

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

describe('useReportingSavedViews hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches saved views when workspace is selected', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'v1', name: 'Main' }] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReportingSavedViews('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/reporting/views');
    expect(result.current.data).toEqual([{ id: 'v1', name: 'Main' }]);
  });

  it('create/update/delete mutations call expected endpoints', async () => {
    mockedApi.post.mockResolvedValue({ data: { id: 'v1', name: 'Created' } });
    mockedApi.patch.mockResolvedValue({ data: { id: 'v1', name: 'Updated' } });
    mockedApi.delete.mockResolvedValue({ data: undefined });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const createHook = renderHook(() => useCreateReportingView('ws-1'), {
      wrapper: wrapper(client),
    });
    const updateHook = renderHook(() => useUpdateReportingView('ws-1'), {
      wrapper: wrapper(client),
    });
    const deleteHook = renderHook(() => useDeleteReportingView('ws-1'), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await createHook.result.current.mutateAsync({
        name: 'Created',
        config: {},
      });
    });
    await act(async () => {
      await updateHook.result.current.mutateAsync({
        viewId: 'v1',
        body: { name: 'Updated' },
      });
    });
    await act(async () => {
      await deleteHook.result.current.mutateAsync('v1');
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/reporting/views', {
      name: 'Created',
      config: {},
    });
    expect(mockedApi.patch).toHaveBeenCalledWith('/workspaces/ws-1/reporting/views/v1', {
      name: 'Updated',
    });
    expect(mockedApi.delete).toHaveBeenCalledWith('/workspaces/ws-1/reporting/views/v1');
  });

  it('mutations fail fast without workspaceId', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCreateReportingView(undefined), {
      wrapper: wrapper(client),
    });
    await expect(
      result.current.mutateAsync({ name: 'x', config: {} }),
    ).rejects.toThrow('No workspace');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
