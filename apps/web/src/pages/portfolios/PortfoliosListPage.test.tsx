import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import PortfoliosListPage from './PortfoliosListPage';

const mockUsePortfolios = vi.fn();

vi.mock('../../hooks/usePortfolios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/usePortfolios')>();
  return {
    ...actual,
    usePortfolios: (ws: string | undefined) => mockUsePortfolios(ws),
  };
});

vi.mock('../../stores/workspace.store', () => {
  const cw = { id: 'ws-1', name: 'Team A', slug: 'team-a', memberCount: 3 };
  return {
    useWorkspaceStore: () => ({
      currentWorkspace: cw,
      setCurrentWorkspace: vi.fn(),
    }),
  };
});

function queryWrapper(client: QueryClient) {
  return function Q({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

describe('PortfoliosListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePortfolios.mockReturnValue({
      data: [
        {
          id: 'pf-1',
          workspaceId: 'ws-1',
          name: 'Product bets',
          description: 'Strategic',
          color: '#6366f1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          itemCount: 2,
        },
      ],
      isLoading: false,
    });
  });

  it('renders empty state when no portfolios', () => {
    mockUsePortfolios.mockReturnValue({ data: [], isLoading: false });
    const client = new QueryClient();
    render(<PortfoliosListPage />, { wrapper: queryWrapper(client) });
    expect(screen.getByText(/no portfolios yet/i)).toBeInTheDocument();
  });

  it('renders portfolio cards with counts', () => {
    const client = new QueryClient();
    render(<PortfoliosListPage />, { wrapper: queryWrapper(client) });

    expect(screen.getByText('Product bets')).toBeInTheDocument();
    expect(screen.getByText(/2 projects/i)).toBeInTheDocument();
  });

  it('integration: portfolio card links to detail with workspace query', () => {
    const client = new QueryClient();
    render(<PortfoliosListPage />, { wrapper: queryWrapper(client) });

    const link = screen.getByRole('link', { name: /product bets/i });
    expect(link).toHaveAttribute('href', '/portfolios/pf-1?ws=ws-1');
  });
});
