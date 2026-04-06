import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useTaskAuditLogs, useWorkspaceAuditLogs } from './useAuditLogs';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const row = {
  id: 'log-1',
  workspaceId: 'ws-1',
  taskId: 't1',
  eventType: 'AGENT_COMPLETED',
  description: 'Done',
  createdAt: new Date().toISOString(),
};

describe('useAuditLogs hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useTaskAuditLogs fetches task audit trail', async () => {
    mockedApi.get.mockResolvedValue({ data: [row] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useTaskAuditLogs('t1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/tasks/t1/audit-logs');
  });

  it('useWorkspaceAuditLogs fetches workspace audit trail', async () => {
    mockedApi.get.mockResolvedValue({ data: [row] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useWorkspaceAuditLogs('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/audit-logs');
  });
});
