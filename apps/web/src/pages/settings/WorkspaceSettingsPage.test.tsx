import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WorkspaceSettingsPage from './WorkspaceSettingsPage';
import type { Workspace, User } from '../../types';

const mockUseWorkspace = vi.fn();
const mockSave = vi.fn();
const mockInvite = vi.fn();
const mockRemove = vi.fn();
const mockUpdateRole = vi.fn();

vi.mock('../../hooks/useWorkspaces', () => ({
  useWorkspace: (id: string | undefined) => mockUseWorkspace(id),
  useUpdateWorkspace: () => ({ mutate: mockSave, isPending: false }),
  useInviteMember: () => ({ mutate: mockInvite, isPending: false, error: null }),
  useRemoveMember: () => ({ mutate: mockRemove, isPending: false }),
  useUpdateMemberRole: () => ({ mutate: mockUpdateRole, isPending: false }),
}));

vi.mock('../../hooks/useWorkCalendars', () => ({
  useWorkCalendars: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreateWorkCalendar: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateWorkCalendar: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteWorkCalendar: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useGenericResources', () => ({
  useGenericResources: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreateGenericResource: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateGenericResource: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteGenericResource: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useSchedulePrograms', () => ({
  useSchedulePrograms: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreateScheduleProgram: () => ({ mutate: vi.fn(), isPending: false }),
  useAddProjectToScheduleProgram: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveProjectFromScheduleProgram: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useProjects', () => ({
  useProjects: () => ({ data: [] }),
}));

const mockUseWorkspaceStore = vi.fn();
vi.mock('../../stores/workspace.store', () => ({
  useWorkspaceStore: () => mockUseWorkspaceStore(),
}));

const mockUseAuthStore = vi.fn();
vi.mock('../../stores/auth.store', () => ({
  useAuthStore: (sel: (s: { user: User | null }) => unknown) =>
    sel({
      user: mockUseAuthStore(),
    }),
}));

const adminUser: User = {
  id: 'u-admin',
  email: 'admin@x.com',
  displayName: 'Admin',
  isAgent: false,
  timezone: 'UTC',
};

const memberUser: User = {
  id: 'u2',
  email: 'b@b.com',
  displayName: 'Bob',
  isAgent: false,
  timezone: 'UTC',
};

const workspace: Workspace = {
  id: 'ws-1',
  name: 'Acme',
  slug: 'acme',
  description: 'desc',
  members: [
    {
      id: 'm1',
      userId: 'u-admin',
      role: 'OWNER',
      user: adminUser,
      joinedAt: new Date().toISOString(),
    },
    {
      id: 'm2',
      userId: 'u2',
      role: 'MEMBER',
      user: memberUser,
      joinedAt: new Date().toISOString(),
    },
  ],
};

function renderPage(initialPath = '/settings/workspace') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <WorkspaceSettingsPage />
    </MemoryRouter>,
  );
}

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspaceStore.mockReturnValue({
      currentWorkspace: { id: 'ws-1', name: 'Acme', slug: 'acme' },
    });
    mockUseAuthStore.mockReturnValue(adminUser);
    mockUseWorkspace.mockReturnValue({
      data: workspace,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('prompts when no workspace selected', () => {
    mockUseWorkspaceStore.mockReturnValue({ currentWorkspace: null });
    renderPage();

    expect(screen.getByText(/select a workspace/i)).toBeInTheDocument();
  });

  it('general tab saves workspace', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), 'Renamed');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockSave).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      name: 'Renamed',
      description: 'desc',
    });
  });

  it('people tab shows members', () => {
    renderPage('/settings/workspace?tab=people');

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/colleague@/i)).toBeInTheDocument();
  });

  it('invite submits email and role', async () => {
    const user = userEvent.setup();
    renderPage('/settings/workspace?tab=people');

    await user.type(screen.getByPlaceholderText(/colleague@/i), 'new@x.com');
    await user.click(screen.getByRole('button', { name: /^invite$/i }));

    expect(mockInvite).toHaveBeenCalledWith(
      { email: 'new@x.com', role: 'MEMBER' },
      expect.any(Object),
    );
  });
});
