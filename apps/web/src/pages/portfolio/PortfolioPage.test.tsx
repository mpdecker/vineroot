import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PortfolioPage from './PortfolioPage';

const mockUsePortfolio = vi.fn();
const mockUseProjects = vi.fn();
const mockAddProject = vi.fn();
const mockRemoveProject = vi.fn();
const mockDeletePortfolio = vi.fn();

vi.mock('../../hooks/usePortfolios', () => ({
  usePortfolio: (id: string | undefined) => mockUsePortfolio(id),
  useAddPortfolioProject: () => ({
    mutateAsync: mockAddProject,
    isPending: false,
  }),
  useRemovePortfolioProject: () => ({
    mutateAsync: mockRemoveProject,
    isPending: false,
  }),
  useDeletePortfolio: () => ({
    mutateAsync: mockDeletePortfolio,
    isPending: false,
  }),
}));

vi.mock('../../hooks/useProjects', () => ({
  useProjects: (ws: string) => mockUseProjects(ws),
}));

vi.stubGlobal('confirm', vi.fn(() => true));

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portfolios" element={<div data-testid="portfolio-list-fallback" />} />
          <Route path="/portfolios/:portfolioId" element={<PortfolioPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortfolioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePortfolio.mockReturnValue({
      data: {
        id: 'pf-1',
        workspaceId: 'ws-1',
        name: 'Roadmap',
        description: 'Plan',
        items: [
          {
            portfolioId: 'pf-1',
            projectId: 'p1',
            sortOrder: 0,
            addedAt: new Date().toISOString(),
            project: {
              id: 'p1',
              name: 'Alpha',
              color: 'BLUE',
              workspaceIds: ['ws-1'],
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    mockUseProjects.mockReturnValue({
      data: [
        {
          id: 'p1',
          name: 'Alpha',
          workspaceIds: ['ws-1'],
          color: 'BLUE',
          status: 'ACTIVE',
          isPrivate: false,
          isArchived: false,
          defaultView: 'list',
        },
        {
          id: 'p2',
          name: 'Beta',
          workspaceIds: ['ws-1'],
          color: 'GREEN',
          status: 'ACTIVE',
          isPrivate: false,
          isArchived: false,
          defaultView: 'list',
        },
      ],
    });
    mockAddProject.mockResolvedValue({});
    mockRemoveProject.mockResolvedValue({});
    mockDeletePortfolio.mockResolvedValue({});
  });

  it('shows error when portfolio cannot be loaded', () => {
    mockUsePortfolio.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('nope'),
    });
    renderAt('/portfolios/pf-1');
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('lists projects in portfolio and addable options', () => {
    renderAt('/portfolios/pf-1');

    expect(screen.getByRole('heading', { name: 'Roadmap' })).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /beta/i })).toBeInTheDocument();
  });

  it('includes workspace-scoped projects in add picker even if workspaceIds is empty on dto', () => {
    mockUseProjects.mockReturnValue({
      data: [
        {
          id: 'p1',
          name: 'Alpha',
          workspaceIds: [],
          color: 'BLUE',
          status: 'ACTIVE',
          isPrivate: false,
          isArchived: false,
          defaultView: 'list',
        },
        {
          id: 'p2',
          name: 'Beta',
          workspaceIds: [],
          color: 'GREEN',
          status: 'ACTIVE',
          isPrivate: false,
          isArchived: false,
          defaultView: 'list',
        },
      ],
      isLoading: false,
      error: null,
    });

    renderAt('/portfolios/pf-1');

    expect(screen.getByRole('option', { name: /beta/i })).toBeInTheDocument();
  });

  it('adds project when picker and button used', async () => {
    renderAt('/portfolios/pf-1');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: /add to portfolio/i }));

    await waitFor(() => {
      expect(mockAddProject).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        portfolioId: 'pf-1',
        projectId: 'p2',
      });
    });
  });

  it('removes project from portfolio', async () => {
    renderAt('/portfolios/pf-1');

    await userEvent.click(screen.getByRole('button', { name: /remove from portfolio/i }));

    await waitFor(() => {
      expect(mockRemoveProject).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        portfolioId: 'pf-1',
        projectId: 'p1',
      });
    });
  });

  it('deletes portfolio when confirmed', async () => {
    renderAt('/portfolios/pf-1');

    await userEvent.click(screen.getByRole('button', { name: /delete portfolio/i }));

    await waitFor(() => {
      expect(mockDeletePortfolio).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        portfolioId: 'pf-1',
      });
    });
  });
});
