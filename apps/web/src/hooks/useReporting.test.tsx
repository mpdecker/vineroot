import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useReportingSummary } from './useReporting';
import type { WorkspaceReportingSummaryDto } from '@vineroot/shared-types';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const summary: WorkspaceReportingSummaryDto = {
  workspaceId: 'ws-1',
  tasksByStatus: { BACKLOG: 2 },
  openTaskCount: 2,
  completedLast30Days: 1,
  createdLast30Days: 3,
  workload: [{ userId: 'u1', displayName: 'A', openTaskCount: 2 }],
};

describe('useReportingSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches reporting summary for workspace', async () => {
    mockedApi.get.mockResolvedValue({ data: summary });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useReportingSummary('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/reporting/summary');
    expect(result.current.data).toEqual(summary);
  });

  it('does not fetch when workspaceId is undefined', () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useReportingSummary(undefined), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});
