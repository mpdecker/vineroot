import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from './ProfilePage';

const mockUpdateProfile = vi.fn();
const mockChangePassword = vi.fn();

vi.mock('../../hooks/useAuthProfile', () => ({
  useUpdateProfile: () => ({
    mutate: mockUpdateProfile,
    isPending: false,
    error: null,
  }),
  useChangePassword: () => ({
    mutate: mockChangePassword,
    isPending: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useWorkCalendars', () => ({
  useWorkCalendars: () => ({ data: [] }),
}));

vi.mock('../../stores/workspace.store', () => ({
  useWorkspaceStore: (
    sel: (s: { currentWorkspace: { id: string; name: string } | null }) => unknown,
  ) => sel({ currentWorkspace: { id: 'ws-1', name: 'Acme' } }),
}));

vi.mock('../../stores/auth.store', () => ({
  useAuthStore: (sel: (s: { user: unknown }) => unknown) =>
    sel({
      user: {
        id: 'u1',
        email: 'a@b.com',
        displayName: 'Alice',
        timezone: 'UTC',
        isAgent: false,
      },
    }),
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows email as read-only and display name', () => {
    render(<ProfilePage />);

    expect(screen.getByDisplayValue('a@b.com')).toBeDisabled();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('save profile calls updateProfile with trimmed display name and timezone', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Alice',
        timezone: 'UTC',
        workCalendarId: null,
        resourceStandardRatePerHour: null,
        resourceOvertimeRatePerHour: null,
      }),
    );
  });

  it('submits password form when valid', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.type(screen.getByLabelText(/^Current password$/i), 'oldpass');
    await user.type(screen.getByLabelText(/^New password$/i), 'newpass1234');
    await user.type(screen.getByLabelText(/^Confirm new password$/i), 'newpass1234');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(mockChangePassword).toHaveBeenCalledWith(
      { currentPassword: 'oldpass', newPassword: 'newpass1234' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
