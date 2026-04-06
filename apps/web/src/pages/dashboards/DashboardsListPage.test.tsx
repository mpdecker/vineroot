import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DashboardsListPage from './DashboardsListPage';

const mockUseDashboards = vi.fn();
const mockUseWorkspaceStore = vi.fn();

vi.mock('../../hooks/useDashboards', () => ({
  useDashboards: (id: string | undefined) => mockUseDashboards(id),
}));

vi.mock('../../components/dashboard/CreateDashboardModal', () => ({
  CreateDashboardModal: () => null,
}));

vi.mock('../../stores/workspace.store', () => ({
  useWorkspaceStore: () => mockUseWorkspaceStore(),
}));

describe('DashboardsListPage (integration-style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DashboardsListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('prompts when no workspace selected', () => {
    mockUseWorkspaceStore.mockReturnValue({ currentWorkspace: null });
    mockUseDashboards.mockReturnValue({ data: undefined, isLoading: false });

    renderPage();

    expect(screen.getByText(/Select a workspace/i)).toBeInTheDocument();
  });

  it('lists dashboards for current workspace', () => {
    mockUseWorkspaceStore.mockReturnValue({
      currentWorkspace: { id: 'ws-1', name: 'Acme' },
    });
    mockUseDashboards.mockReturnValue({
      data: [
        {
          id: 'd1',
          workspaceId: 'ws-1',
          name: 'Sprint board',
          createdById: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          widgetCount: 2,
        },
      ],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.getByText('Sprint board')).toBeInTheDocument();
    expect(screen.getByText(/2 widgets/)).toBeInTheDocument();
  });

  it('shows empty state when no dashboards', () => {
    mockUseWorkspaceStore.mockReturnValue({
      currentWorkspace: { id: 'ws-1', name: 'Acme' },
    });
    mockUseDashboards.mockReturnValue({ data: [], isLoading: false });

    renderPage();

    expect(screen.getByText(/No dashboards yet/)).toBeInTheDocument();
  });
});
