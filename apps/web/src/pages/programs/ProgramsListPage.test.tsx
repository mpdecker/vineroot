import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProgramsListPage from './ProgramsListPage';

const mockUseWorkspaceStore = vi.fn();
vi.mock('../../stores/workspace.store', () => ({
  useWorkspaceStore: () => mockUseWorkspaceStore(),
}));

const mockUseSchedulePrograms = vi.fn();
vi.mock('../../hooks/useSchedulePrograms', () => ({
  useSchedulePrograms: (wid: string | undefined) => mockUseSchedulePrograms(wid),
}));

describe('ProgramsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspaceStore.mockReturnValue({
      currentWorkspace: { id: 'ws-1', name: 'Acme' },
    });
    mockUseSchedulePrograms.mockReturnValue({
      data: [{ id: 'prog-1', name: 'Roadmap', projectIds: ['p1', 'p2'] }],
      isLoading: false,
      error: null,
    });
  });

  it('prompts when no workspace', () => {
    mockUseWorkspaceStore.mockReturnValue({ currentWorkspace: null });
    render(
      <MemoryRouter>
        <ProgramsListPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/select a workspace/i)).toBeInTheDocument();
  });

  it('lists programs with command center link', () => {
    render(
      <MemoryRouter>
        <ProgramsListPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open command center/i })).toHaveAttribute(
      'href',
      '/programs/prog-1?ws=ws-1',
    );
  });
});
