import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProjectCreateModal } from './ProjectCreateModal';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateProject = vi.fn();
const mockResetCreateProject = vi.fn();
const mockWorkspacesData = [
  { id: 'ws1', name: 'Acme', slug: 'acme', memberCount: 2 },
] as const;
const mockCreateWorkspaceMutate = vi
  .fn()
  .mockResolvedValue({ id: 'new-ws', name: 'New', slug: 'new' });
const mockResetWorkspace = vi.fn();

vi.mock('../../hooks/useProjects', () => ({
  useCreateProject: () => ({
    mutateAsync: mockCreateProject,
    isPending: false,
    error: null,
    reset: mockResetCreateProject,
  }),
}));

vi.mock('../../hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({ data: mockWorkspacesData }),
  useCreateWorkspace: () => ({
    mutateAsync: mockCreateWorkspaceMutate,
    isPending: false,
    error: null,
    reset: mockResetWorkspace,
  }),
}));

vi.mock('../../stores/workspace.store', () => {
  const cw = { id: 'ws1', name: 'Acme', slug: 'acme' };
  const setWs = vi.fn();
  return {
    useWorkspaceStore: () => ({
      currentWorkspace: cw,
      setCurrentWorkspace: setWs,
    }),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(isOpen = true, onClose = vi.fn()) {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProjectCreateModal isOpen={isOpen} onClose={onClose} />, { wrapper: Wrapper });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderModal(false);
    expect(screen.queryByRole('heading', { name: /create project/i })).not.toBeInTheDocument();
  });

  it('renders the form when open', () => {
    renderModal(true);
    expect(screen.getByRole('heading', { name: /create project/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/q3 launch/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('submit button is disabled when name is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /create project/i })).toBeDisabled();
  });

  it('submit button enables once name is typed', async () => {
    renderModal();
    const input = screen.getByPlaceholderText(/q3 launch/i);
    await userEvent.type(input, 'My Project');
    expect(screen.getByRole('button', { name: /create project/i })).toBeEnabled();
  });

  it('calls createProject with correct payload on submit', async () => {
    mockCreateProject.mockResolvedValue({ id: 'new-proj' });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/q3 launch/i), 'Sprint 1');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        workspaceIds: ['ws1'],
        name: 'Sprint 1',
        description: undefined,
        color: 'BLUE',
      });
    });
  });

  it('navigates to new project after creation', async () => {
    mockCreateProject.mockResolvedValue({ id: 'proj-xyz' });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/q3 launch/i), 'New Project');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-xyz');
    });
  });

  it('calls onClose after successful creation', async () => {
    const onClose = vi.fn();
    mockCreateProject.mockResolvedValue({ id: 'proj-abc' });
    renderModal(true, onClose);

    await userEvent.type(screen.getByPlaceholderText(/q3 launch/i), 'Close Me');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error message when API call fails', async () => {
    mockCreateProject.mockRejectedValue(new Error('Server error'));
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/q3 launch/i), 'Bad Project');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('does not navigate when API call fails', async () => {
    mockCreateProject.mockRejectedValue(new Error('Oops'));
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/q3 launch/i), 'Bad');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => screen.getByRole('alert'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('sends description when provided', async () => {
    mockCreateProject.mockResolvedValue({ id: 'p2' });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/q3 launch/i), 'Proj');
    await userEvent.type(screen.getByPlaceholderText(/what's this project about/i), 'A great one');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'A great one' }),
      );
    });
  });
});
