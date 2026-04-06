import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectFlowView } from './ProjectFlowView';

vi.mock('../../hooks/useProjects', () => ({
  useProjectCfd: vi.fn(),
}));

import { useProjectCfd } from '../../hooks/useProjects';

const mockedCfd = vi.mocked(useProjectCfd);

describe('ProjectFlowView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chart when data loads', () => {
    mockedCfd.mockReturnValue({
      data: {
        projectId: 'p1',
        days: [
          { date: '2026-01-01', byStatus: { BACKLOG: 2, DONE: 1 } },
          { date: '2026-01-02', byStatus: { BACKLOG: 2, DONE: 1 } },
        ],
        statusOrder: ['BACKLOG', 'DONE'],
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      isPending: false,
      isLoadingError: false,
      isRefetchError: false,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      status: 'success',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProjectCfd>);

    render(<ProjectFlowView projectId="p1" />);

    expect(screen.getByText(/Cumulative flow/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /cumulative flow diagram/i })).toBeInTheDocument();
    expect(screen.getByText(/backlog/i)).toBeInTheDocument();
  });

  it('shows error state when query fails', () => {
    mockedCfd.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fail'),
      isFetching: false,
      isPending: false,
      isLoadingError: true,
      isRefetchError: false,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 1,
      failureReason: null,
      fetchStatus: 'idle',
      status: 'error',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProjectCfd>);

    render(<ProjectFlowView projectId="p1" />);

    expect(screen.getByText(/Could not load cumulative flow/i)).toBeInTheDocument();
  });
});
