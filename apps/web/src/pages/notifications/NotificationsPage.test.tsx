import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationsPage from './NotificationsPage';
import type { Notification } from '../../types';

const mockNavigate = vi.fn();
const mockOpenTask = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockUseNotifications = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: (unreadOnly?: boolean) => mockUseNotifications(unreadOnly),
  useMarkNotificationRead: () => ({ mutate: mockMarkRead }),
  useMarkAllRead: () => ({ mutate: mockMarkAllRead, isPending: false }),
}));

vi.mock('../../stores/ui.store', () => ({
  useUIStore: (sel: (s: { openTask: typeof mockOpenTask }) => unknown) =>
    sel({ openTask: mockOpenTask }),
}));

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../../lib/api';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const baseNote: Notification = {
  id: 'n1',
  type: 'TASK_ASSIGNED',
  title: 'Assigned',
  isRead: false,
  createdAt: new Date().toISOString(),
};

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({
      data: { notifications: [], unreadCount: 0 },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('shows loading state', () => {
    mockUseNotifications.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: true,
      refetch: vi.fn(),
    });

    renderPage();

    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows empty state when no notifications', () => {
    renderPage();

    expect(screen.getByText(/caught up/i)).toBeInTheDocument();
  });

  it('lists notifications', () => {
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [baseNote],
        unreadCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText(/1 unread/i)).toBeInTheDocument();
  });

  it('unread filter calls hook with true', async () => {
    const user = userEvent.setup();
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [baseNote],
        unreadCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderPage();

    await user.click(screen.getByRole('button', { name: /^All$/i }));

    expect(mockUseNotifications).toHaveBeenLastCalledWith(true);
  });

  it('mark all read triggers mutation', async () => {
    const user = userEvent.setup();
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [baseNote],
        unreadCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderPage();

    await user.click(screen.getByRole('button', { name: /mark all read/i }));

    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it('clicking task notification fetches task and navigates', async () => {
    const user = userEvent.setup();
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            ...baseNote,
            resourceId: 't1',
            resourceType: 'TASK',
            isRead: true,
          },
        ],
        unreadCount: 0,
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    mockedApi.get.mockResolvedValue({
      data: { id: 't1', projectId: 'p1', title: 'T' },
    });

    renderPage();

    await user.click(screen.getByRole('button', { name: /assigned/i }));

    expect(mockedApi.get).toHaveBeenCalledWith('/tasks/t1');
    expect(mockOpenTask).toHaveBeenCalledWith('t1');
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1/list');
  });
});
