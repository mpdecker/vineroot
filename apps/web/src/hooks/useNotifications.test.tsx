import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
} from './useNotifications';
import type { Notification } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
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

const note: Notification = {
  id: 'n1',
  type: 'TASK_ASSIGNED',
  title: 'Hi',
  isRead: false,
  createdAt: new Date().toISOString(),
};

describe('useNotifications hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useNotifications maps notifications array from API envelope', async () => {
    mockedApi.get.mockResolvedValue({
      data: { notifications: [note], unreadCount: 1 },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useNotifications(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([note]);
  });

  it('useMarkNotificationRead posts read endpoint', async () => {
    mockedApi.post.mockResolvedValue({ data: { ...note, isRead: true } });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync('n1');

    expect(mockedApi.post).toHaveBeenCalledWith('/notifications/n1/read', {});
  });

  it('useMarkAllRead posts read-all', async () => {
    mockedApi.post.mockResolvedValue({ data: { count: 2 } });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useMarkAllRead(), { wrapper: wrapper(client) });

    await result.current.mutateAsync();

    expect(mockedApi.post).toHaveBeenCalledWith('/notifications/read-all', {});
  });
});
