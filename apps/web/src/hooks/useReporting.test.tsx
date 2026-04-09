import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { downloadReportingCsv, useReportingSummary } from './useReporting';
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
  period: { from: '2026-01-01', to: '2026-01-31' },
  appliedFilters: {},
  tasksByStatus: { BACKLOG: 2 },
  openTaskCount: 2,
  completedLast30Days: 1,
  createdLast30Days: 3,
  throughputByWeek: [],
  flowMetrics: {
    leadTimeDays: { avg: 3, median: 3, sampleSize: 1 },
    cycleTimeDays: { avg: null, median: null, sampleSize: 0 },
  },
  workload: [{ userId: 'u1', displayName: 'A', openTaskCount: 2 }],
};

describe('useReportingSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches reporting summary for workspace', async () => {
    mockedApi.get.mockResolvedValue({ data: summary });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useReportingSummary('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/reporting/summary');
    expect(result.current.data?.period).toBeDefined();
    expect(result.current.data).toEqual(summary);
  });

  it('serializes filters into summary query string', async () => {
    mockedApi.get.mockResolvedValue({ data: summary });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(
      () =>
        useReportingSummary('ws-1', {
          from: '2026-01-01',
          to: '2026-01-31',
          portfolioId: 'pf1',
          projectIds: ['p1', 'p2'],
          assigneeIds: ['u1', 'u2'],
          statuses: ['DONE', 'BACKLOG'],
          tagIds: ['t1', 't2'],
        }),
      {
        wrapper: wrapper(client),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith(
      '/workspaces/ws-1/reporting/summary?from=2026-01-01&to=2026-01-31&portfolioId=pf1&projectIds=p1%2Cp2&assigneeIds=u1%2Cu2&statuses=DONE%2CBACKLOG&tagIds=t1%2Ct2',
    );
  });

  it('does not fetch when workspaceId is undefined', () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useReportingSummary(undefined), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('downloadReportingCsv fetches blob and triggers anchor download', async () => {
    const blob = new Blob(['a,b\n1,2'], { type: 'text/csv' });
    mockedApi.get.mockResolvedValue({ data: blob });
    const createObjectURL = vi.fn(() => 'blob:abc');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ href: '', download: '', click } as unknown as HTMLAnchorElement);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    await downloadReportingCsv('ws-1', { projectIds: ['p1'] });

    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/reporting/export.csv?projectIds=p1', {
      responseType: 'blob',
    });
    expect(createElement).toHaveBeenCalledWith('a');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:abc');
  });
});
