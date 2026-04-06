import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProjectEditModal } from './ProjectEditModal';
import type { Project } from '../../types';

const mockUpdateProject = vi.fn();
const mockResetUpdate = vi.fn();

const WORKSPACES = [
  { id: 'ws1', name: 'Acme', slug: 'acme', memberCount: 2 },
  { id: 'ws2', name: 'Beta', slug: 'beta', memberCount: 1 },
] as const;

vi.mock('../../hooks/useProjects', () => ({
  useUpdateProject: () => ({
    mutateAsync: mockUpdateProject,
    isPending: false,
    error: null,
    reset: mockResetUpdate,
  }),
}));

vi.mock('../../hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({ data: WORKSPACES }),
  useCreateWorkspace: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'nw', name: 'New', slug: 'new' }),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

const baseProject: Project = {
  id: 'p1',
  workspaceIds: ['ws1'],
  name: 'Original',
  description: 'Desc',
  color: 'BLUE',
  status: 'ACTIVE',
  isPrivate: false,
  isArchived: false,
  defaultView: 'list',
};

function renderModal(
  project: Project = baseProject,
  isOpen = true,
  onClose = vi.fn(),
) {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <ProjectEditModal isOpen={isOpen} onClose={onClose} project={project} />,
    { wrapper: Wrapper },
  );
}

describe('ProjectEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderModal(baseProject, false);
    expect(screen.queryByRole('heading', { name: /project settings/i })).not.toBeInTheDocument();
  });

  it('shows workspace checkboxes from project.workspaceIds', () => {
    renderModal({ ...baseProject, workspaceIds: ['ws1', 'ws2'] });

    const ws1 = screen.getByRole('checkbox', { name: /acme/i });
    const ws2 = screen.getByRole('checkbox', { name: /beta/i });
    expect(ws1).toBeChecked();
    expect(ws2).toBeChecked();
  });

  it('submits kanbanWipEnforcement when saving', async () => {
    mockUpdateProject.mockResolvedValue({});
    renderModal({ ...baseProject, kanbanWipEnforcement: 'WARN' });

    await userEvent.selectOptions(screen.getByRole('combobox'), 'STRICT');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p1',
          kanbanWipEnforcement: 'STRICT',
        }),
      );
    });
  });

  it('submits workspaceIds when saving', async () => {
    mockUpdateProject.mockResolvedValue({});
    const onClose = vi.fn();
    renderModal(baseProject, true, onClose);

    await userEvent.click(screen.getByRole('checkbox', { name: /beta/i }));

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p1',
          workspaceIds: expect.arrayContaining(['ws1', 'ws2']),
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not allow unchecking last workspace', async () => {
    renderModal(baseProject);

    const ws1 = screen.getByRole('checkbox', { name: /acme/i });
    await userEvent.click(ws1);
    expect(ws1).toBeChecked();
  });
});
